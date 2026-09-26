const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
require("reflect-metadata");
const { Types } = require("mongoose");
const { AiKeyService } = require("../dist/ai/ai-key.service");
const { AiKeySchema } = require("../dist/ai/ai-key.schema");
const { AiService } = require("../dist/ai/ai.service");

test("AI key ownership uses BSON ObjectIds and a unique provider index", () => {
  assert.equal(AiKeySchema.path("userId").instance, "ObjectId");
  assert.ok(AiKeySchema.indexes().some(([fields, options]) => fields.userId === 1 && fields.provider === 1 && options.unique));
});

test("BYOK uses authenticated encryption with owner/provider binding; never exposes plaintext", async () => {
  const owner = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const master = randomBytes(32).toString("base64");
  let stored;
  const keys = {
    updateOne: (selector, update) => { stored = { ...selector, ...update.$set }; return { exec: async () => ({}) }; },
    findOne: (selector) => ({ exec: async () => stored && stored.provider === selector.provider ? stored : null }),
    find: (selector) => { assert.equal(selector.userId.toString(), owner); return { select: () => ({ exec: async () => [stored] }) }; },
  };
  const service = new AiKeyService(keys, { get: () => master });
  const secret = "sk-test-example-private-key-12345";
  assert.deepEqual(await service.save(owner, "openai", secret), { provider: "openai", configured: true });
  assert.equal(stored.userId.toString(), owner);
  assert.equal(stored.keyVersion, 1);
  assert.equal(JSON.stringify(stored).includes(secret), false);
  assert.equal((await service.list(owner))[0].ciphertext, undefined);
  assert.equal(await service.read(owner, "openai"), secret);
  await assert.rejects(service.read(other, "openai"), { status: 503 });
  stored.authTag = Buffer.alloc(16).toString("base64");
  await assert.rejects(service.read(owner, "openai"), { status: 503 });
});

test("chat fails closed before retrieving user data without a configured provider model", async () => {
  const owner = new Types.ObjectId().toString();
  const service = new AiService({ get: () => undefined }, { read: async () => null }, {
    getTransactions: () => { throw new Error("Should not retrieve private records"); },
  }, { findById: async () => ({ profile: {} }) });
  await assert.rejects(service.chat(owner, "bedrock", "How are my finances?"), { status: 503 });
  await assert.rejects(service.chat(owner, "openai", "How are my finances?"), { status: 503 });
});
