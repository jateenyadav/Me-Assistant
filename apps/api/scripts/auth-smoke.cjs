const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { getModelToken } = require("@nestjs/mongoose");
const { AppModule } = require("../dist/app.module");
const { User } = require("../dist/users/schemas/user.schema");
const { RefreshToken } = require("../dist/auth/schemas/refresh-token.schema");
const { Transaction } = require("../dist/transactions/schemas/transaction.schema");
const { UpiMapping } = require("../dist/transactions/schemas/upi-mapping.schema");

async function main() {
  const email = `lifeos-smoke-${randomUUID()}@example.com`;
  const otherEmail = `lifeos-smoke-${randomUUID()}@example.com`;
  const password = randomUUID() + "Aa1!";
  let app;

  try {
    app = await NestFactory.create(AppModule, { logger: ["error"] });
    await app.listen(0, "127.0.0.1");
    const baseUrl = await app.getUrl();

    async function request(method, path, body, expectedStatus, accessToken) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, expectedStatus, `${method} ${path}: unexpected status`);
      return response.status === 204 ? undefined : response.json();
    }

    const health = await request("GET", "/health", null, 200);
    assert.equal(health.db, "up");

    await request("GET", "/auth/google?state=short", null, 400);
    await request("POST", "/auth/google/exchange", { ticket: "short" }, 400);
    await request("POST", "/auth/google/exchange", { ticket: "f".repeat(64) }, 401);

    const registered = await request("POST", "/auth/register", { email, password }, 201);
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.passwordHash, undefined);
    const currentUser = await request("GET", "/auth/me", null, 200, registered.accessToken);
    assert.equal(currentUser.user.id, registered.user.id);

    await request("GET", "/transactions", null, 401);
    const input = { amountMinor: 12501, type: "expense", category: "food", occurredAt: new Date().toISOString() };
    await request("POST", "/transactions", { ...input, amountMinor: 1.5 }, 400, registered.accessToken);
    await request("POST", "/transactions", { ...input, userId: registered.user.id }, 400, registered.accessToken);
    const created = await request("POST", "/transactions", input, 201, registered.accessToken);
    assert.equal(created.transaction.amountMinor, 12501);
    assert.equal(created.transaction.userId, undefined);
    assert.equal(created.transaction.source, "manual");
    const ownList = await request("GET", "/transactions", null, 200, registered.accessToken);
    assert.equal(ownList.transactions.length, 1);
    assert.equal(ownList.transactions[0].id, created.transaction.id);
    await request("GET", "/transactions/summary", null, 401);
    const ownSummary = await request("GET", "/transactions/summary", null, 200, registered.accessToken);
    assert.equal(ownSummary.summary.expenseMinor, 12501);
    assert.equal(ownSummary.summary.incomeMinor, 0);
    assert.deepEqual(ownSummary.summary.expenseByCategory, [{ category: "food", amountMinor: 12501 }]);
    const otherUser = await request("POST", "/auth/register", { email: otherEmail, password }, 201);
    const otherList = await request("GET", "/transactions", null, 200, otherUser.accessToken);
    assert.deepEqual(otherList.transactions, []);
    const otherSummary = await request("GET", "/transactions/summary", null, 200, otherUser.accessToken);
    assert.equal(otherSummary.summary.expenseMinor, 0);
    assert.deepEqual(otherSummary.summary.expenseByCategory, []);

    const emailImport = { text: "Your bill payment was successful. Paid INR 121.40", category: "bills", occurredAt: new Date().toISOString() };
    await request("POST", "/transactions/emails/preview", { text: emailImport.text }, 401);
    await request("POST", "/transactions/emails/preview", { text: "Your bill INR 121.40 is due" }, 400, registered.accessToken);
    await request("POST", "/transactions/emails", { ...emailImport, userId: registered.user.id }, 400, registered.accessToken);
    const preview = await request("POST", "/transactions/emails/preview", { text: emailImport.text }, 201, registered.accessToken);
    assert.equal(preview.payment.amountMinor, 12140);
    const emailResult = await request("POST", "/transactions/emails", emailImport, 201, registered.accessToken);
    assert.equal(emailResult.transaction.source, "email_paste");
    assert.equal(emailResult.transaction.text, undefined);
    assert.equal((await request("POST", "/transactions/emails", emailImport, 201, registered.accessToken)).transaction.id, emailResult.transaction.id);
    const concurrent = await Promise.all(Array.from({ length: 3 }, () => request("POST", "/transactions/emails", emailImport, 201, registered.accessToken)));
    assert.ok(concurrent.every((result) => result.transaction.id === emailResult.transaction.id));
    await request("POST", "/transactions/emails", { ...emailImport, category: "other" }, 409, registered.accessToken);
    assert.equal((await request("GET", "/transactions", null, 200, otherUser.accessToken)).transactions.length, 0);
    assert.notEqual((await request("POST", "/transactions/emails", emailImport, 201, otherUser.accessToken)).transaction.id, emailResult.transaction.id);

    const notification = { eventId: randomBytes(32).toString("hex"), amountMinor: 3500, type: "expense", occurredAt: new Date().toISOString(), upiId: "vendor@upi" };
    await request("POST", "/transactions/notifications", notification, 401);
    await request("POST", "/transactions/notifications", { ...notification, userId: otherUser.user.id }, 400, registered.accessToken);
    const imported = await request("POST", "/transactions/notifications", notification, 201, registered.accessToken);
    assert.equal(imported.status, "pending");
    assert.equal(imported.notification.upiId, undefined);
    const repeated = await request("POST", "/transactions/notifications", notification, 201, registered.accessToken);
    assert.equal(repeated.notification.id, imported.notification.id);
    await request("POST", "/transactions/notifications", { ...notification, amountMinor: 1 }, 409, registered.accessToken);
    const pending = await request("GET", "/transactions/notifications/pending", null, 200, registered.accessToken);
    assert.equal(pending.notifications.length, 1);
    await request("PATCH", `/transactions/notifications/${imported.notification.id}/category`, { category: "food" }, 404, otherUser.accessToken);
    const classified = await request("PATCH", `/transactions/notifications/${imported.notification.id}/category`, { category: "food" }, 200, registered.accessToken);
    assert.equal(classified.transaction.category, "food");
    const auto = await request("POST", "/transactions/notifications", { ...notification, eventId: randomBytes(32).toString("hex") }, 201, registered.accessToken);
    assert.equal(auto.status, "categorized");
    assert.equal(auto.transaction.category, "food");
    const otherImport = await request("POST", "/transactions/notifications", notification, 201, otherUser.accessToken);
    assert.equal(otherImport.status, "pending");

    await request("POST", "/auth/login", { email, password: "wrong-password" }, 401);
    const loggedIn = await request("POST", "/auth/login", { email, password }, 200);
    assert.equal(loggedIn.user.id, registered.user.id);

    const forgedToken = `${registered.refreshToken.split(".")[0]}.${"0".repeat(64)}`;
    await request("POST", "/auth/refresh", { refreshToken: forgedToken }, 401);
    const rotated = await request("POST", "/auth/refresh", {
      refreshToken: registered.refreshToken,
    }, 200);
    assert.notEqual(rotated.refreshToken, registered.refreshToken);

    const forgedRotated = `${rotated.refreshToken.split(".")[0]}.${"0".repeat(64)}`;
    await request("POST", "/auth/logout", { refreshToken: forgedRotated }, 204);
    const latest = await request("POST", "/auth/refresh", {
      refreshToken: rotated.refreshToken,
    }, 200);

    await request("POST", "/auth/refresh", { refreshToken: registered.refreshToken }, 401);
    await request("POST", "/auth/refresh", { refreshToken: latest.refreshToken }, 401);

    await request("POST", "/auth/logout", { refreshToken: loggedIn.refreshToken }, 204);
    await request("POST", "/auth/refresh", { refreshToken: loggedIn.refreshToken }, 401);
    console.log("Auth/finance smoke passed: health, Google validation, auth, email and notification replay, categorization and isolation.");
  } finally {
    if (app) {
      const users = app.get(getModelToken(User.name));
      const refreshTokens = app.get(getModelToken(RefreshToken.name));
      const transactions = app.get(getModelToken(Transaction.name));
      const mappings = app.get(getModelToken(UpiMapping.name));
      for (const testEmail of [email, otherEmail]) {
        const user = await users.findOne({ email: testEmail }).select("_id").lean().exec();
        if (user) {
          await transactions.deleteMany({ userId: user._id }).exec();
          await mappings.deleteMany({ userId: user._id }).exec();
          await refreshTokens.deleteMany({ userId: user._id }).exec();
          await users.deleteOne({ _id: user._id }).exec();
        }
      }
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error("Auth smoke failed:", error.message);
  process.exitCode = 1;
});
