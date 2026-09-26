const test = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
const { Types } = require("mongoose");
const { McpService } = require("../dist/mcp/mcp.service");
const { McpTokenSchema } = require("../dist/mcp/mcp-token.schema");

test("MCP token owner is a BSON ObjectId with an expiry index", () => {
  assert.equal(McpTokenSchema.path("userId").instance, "ObjectId");
  assert.ok(McpTokenSchema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test("MCP is off by default; short-lived opaque tokens are hashed at rest and read-only by scope", async () => {
  const owner = new Types.ObjectId().toString();
  let enabled = false;
  let stored;
  const users = {
    findById: async (id) => id === owner ? { mcpEnabled: enabled } : null,
    updateMcpEnabled: async (id, value) => { assert.equal(id, owner); enabled = value; return { mcpEnabled: enabled }; },
  };
  const tokens = {
    create: async (value) => { stored = { ...value, _id: new Types.ObjectId() }; return stored; },
    findOne: (filter) => ({ exec: async () => stored && filter.tokenHash === stored.tokenHash &&
      !stored.revokedAt && stored.expiresAt > filter.expiresAt.$gt ? stored : null }),
    updateMany: (filter) => { assert.equal(filter.userId.toString(), owner); return { exec: async () => { stored.revokedAt = new Date(); } }; },
  };
  const service = new McpService(tokens, users);
  await assert.rejects(service.createToken(owner, "Desktop", ["read"]), { status: 403 });
  await service.setEnabled(owner, true);
  const created = await service.createToken(owner, "Desktop", ["read"]);
  assert.match(created.token, /^mcp_[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.userId.toString(), owner);
  assert.match(stored.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(stored).includes(created.token), false);
  assert.deepEqual(await service.authenticate(`Bearer ${created.token}`), { userId: owner, scopes: ["read"] });
  await assert.rejects(service.authenticate("Bearer eyJnot-an-mcp-jwt"), { status: 401 });
  await assert.rejects(service.authenticate("Bearer mcp_not-a-valid-token"), { status: 401 });
  await service.setEnabled(owner, false);
  await assert.rejects(service.authenticate(`Bearer ${created.token}`), { status: 401 });
  await service.setEnabled(owner, true);
  await assert.rejects(service.authenticate(`Bearer ${created.token}`), { status: 401 });
});
