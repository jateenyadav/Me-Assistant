const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
require("reflect-metadata");
const { GoogleAuthService } = require("../dist/auth/google-auth.service");
const { UsersService } = require("../dist/users/users.service");

function fixture() {
  const attempts = [];
  const tickets = [];
  let exchangeCount = 0;
  const config = {
    get: (key) => ({
      GOOGLE_CLIENT_ID: "sample.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "not-a-real-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:4000/auth/google/callback",
    })[key],
    getOrThrow: (key) => ({
      GOOGLE_CLIENT_ID: "sample.apps.googleusercontent.com",
      WEB_ORIGIN: "http://localhost:3000",
    })[key],
  };
  const attemptModel = {
    create: async (attempt) => { attempts.push(attempt); return attempt; },
    findOneAndDelete: (filter) => ({ exec: async () => {
      const index = attempts.findIndex((attempt) => attempt.state === filter.state && attempt.expiresAt > filter.expiresAt.$gt);
      return index < 0 ? null : attempts.splice(index, 1)[0];
    } }),
  };
  const ticketModel = {
    create: async (ticket) => { tickets.push(ticket); return ticket; },
    findOneAndDelete: (filter) => ({ exec: async () => {
      const index = tickets.findIndex((ticket) => ticket.ticketHash === filter.ticketHash && ticket.expiresAt > filter.expiresAt.$gt);
      if (index >= 0) exchangeCount++;
      return index < 0 ? null : tickets.splice(index, 1)[0];
    } }),
  };
  const users = {
    findOrCreateGoogle: async (sub, email) => ({ _id: "user-123", sub, email }),
  };
  const auth = { issueForUserId: async (id) => ({ user: { id } }) };
  const service = new GoogleAuthService(config, users, auth, attemptModel, ticketModel);
  return { service, attempts, tickets, exchangeCount: () => exchangeCount };
}

test("starts Google authorization with PKCE, nonce and a short-lived state", async () => {
  const { service, attempts } = fixture();
  const clientState = "a".repeat(64);
  const { url, state } = await service.begin(clientState);
  const location = new URL(url);
  assert.equal(attempts[0].clientState, clientState);
  assert.equal(attempts[0].state, state);
  assert.equal(location.searchParams.get("state"), state);
  assert.equal(location.searchParams.get("nonce"), attempts[0].nonce);
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.ok(location.searchParams.get("code_challenge"));
  assert.ok(attempts[0].codeVerifier);
  assert.ok(attempts[0].expiresAt > new Date());
});

test("rejects missing browser state without consuming the authorization attempt", async () => {
  const { service, attempts } = fixture();
  const { state } = await service.begin("b".repeat(64));
  await assert.rejects(() => service.complete("code", state, "wrong"), /Invalid Google sign-in request/);
  assert.equal(attempts.length, 1);
});

test("accepts verified identity and consumes a ticket only once", async () => {
  const { service, attempts, tickets, exchangeCount } = fixture();
  const { state } = await service.begin("c".repeat(64));
  const nonce = attempts[0].nonce;
  const verifier = attempts[0].codeVerifier;
  service.client = () => ({
    getToken: async ({ code, codeVerifier }) => {
      assert.equal(code, "sample-code");
      assert.equal(codeVerifier, verifier);
      return { tokens: { id_token: "signed-token" } };
    },
    verifyIdToken: async ({ audience }) => {
      assert.equal(audience, "sample.apps.googleusercontent.com");
      return { getPayload: () => ({ sub: "google-sub", email: "new@example.com", email_verified: true, nonce }) };
    },
  });
  const redirect = await service.complete("sample-code", state, state);
  const fragment = new URLSearchParams(new URL(redirect).hash.slice(1));
  assert.equal(fragment.get("state"), "c".repeat(64));
  assert.equal(attempts.length, 0);
  assert.equal(tickets.length, 1);
  assert.equal(fragment.get("ticket").length, 64);
  assert.deepEqual(await service.exchange(fragment.get("ticket")), { user: { id: "user-123" } });
  await assert.rejects(() => service.exchange(fragment.get("ticket")), /expired or already used/);
  assert.equal(exchangeCount(), 1);
});

test("rejects an unverified or mismatched identity before creating a ticket", async () => {
  const { service, attempts, tickets } = fixture();
  const { state } = await service.begin("d".repeat(64));
  service.client = () => ({
    getToken: async () => ({ tokens: { id_token: "signed-token" } }),
    verifyIdToken: async () => ({ getPayload: () => ({ sub: "google-sub", email: "new@example.com", email_verified: false, nonce: attempts[0]?.nonce }) }),
  });
  await assert.rejects(() => service.complete("sample-code", state, state), /Invalid Google identity/);
  assert.equal(tickets.length, 0);
});

test("rejects a valid Google identity with the wrong nonce", async () => {
  const { service, tickets } = fixture();
  const { state } = await service.begin("f".repeat(64));
  service.client = () => ({
    getToken: async () => ({ tokens: { id_token: "signed-token" } }),
    verifyIdToken: async () => ({ getPayload: () => ({ sub: "google-sub", email: "new@example.com", email_verified: true, nonce: "wrong" }) }),
  });
  await assert.rejects(() => service.complete("sample-code", state, state), /Invalid Google identity/);
  assert.equal(tickets.length, 0);
});

test("rejects expired tickets and malformed handoffs", async () => {
  const { service, tickets } = fixture();
  const expiredTicket = "e".repeat(64);
  tickets.push({ ticketHash: createHash("sha256").update(expiredTicket).digest("hex"), userId: "user-123", expiresAt: new Date(0) });
  await assert.rejects(() => service.exchange("bad"), /Invalid Google login ticket/);
  await assert.rejects(() => service.exchange(expiredTicket), /expired or already used/);
  assert.equal(tickets.length, 1);
});

test("rejects expired authorization requests", async () => {
  const { service, attempts } = fixture();
  const { state } = await service.begin("e".repeat(64));
  attempts[0].expiresAt = new Date(0);
  await assert.rejects(() => service.complete("sample-code", state, state), /expired or already used/);
});

test("does not silently link Google to an existing password account", async () => {
  const existing = { email: "existing@example.com", passwordHash: "hash" };
  const model = {
    findOne: (filter) => ({ exec: async () => filter.email === existing.email ? existing : null }),
    create: async () => { throw new Error("Must not create a linked account"); },
  };
  await assert.rejects(() => new UsersService(model).findOrCreateGoogle("new-sub", existing.email), /already uses this email/);
});
