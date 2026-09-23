const test = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
const { Types } = require("mongoose");
const { createTransactionSchema, parseRupeeAmount } = require("@lifeos/shared");
const { TransactionsService } = require("../dist/transactions/transactions.service");

test("rupees convert to exact integer paise without floating-point rounding", () => {
  assert.equal(parseRupeeAmount("250.01"), 25001);
  assert.equal(parseRupeeAmount(" 0.05 "), 5);
  assert.equal(parseRupeeAmount("12.3"), 1230);
  assert.equal(parseRupeeAmount("999999999.99"), 99999999999);
  for (const invalid of ["0", "-1", "1.005", "12abc", "1e3", "1000000000", ""]) {
    assert.equal(parseRupeeAmount(invalid), null);
  }
});

test("transaction schema rejects invalid amounts, categories, and client-supplied user IDs", () => {
  const input = { amountMinor: 25001, type: "expense", category: "food", occurredAt: new Date().toISOString() };
  assert.equal(createTransactionSchema.safeParse(input).success, true);
  for (const invalid of [
    { ...input, amountMinor: 0 },
    { ...input, amountMinor: 250.5 },
    { ...input, category: "unknown" },
    { ...input, userId: new Types.ObjectId().toString() },
    { ...input, occurredAt: "yesterday" },
  ]) {
    assert.equal(createTransactionSchema.safeParse(invalid).success, false);
  }
});

test("list filters by authenticated user ID and limits results", async () => {
  const userId = new Types.ObjectId().toString();
  let filter;
  let sort;
  let limit;
  const model = {
    find: (query) => {
      filter = query;
      return {
        sort: (order) => { sort = order; return {
          limit: (count) => { limit = count; return { exec: async () => [] }; },
        }; },
      };
    },
  };
  const result = await new TransactionsService(model).list(userId);
  assert.deepEqual(result, []);
  assert.equal(filter.userId.toString(), userId);
  assert.deepEqual(sort, { occurredAt: -1, _id: -1 });
  assert.equal(limit, 50);
});

test("create ignores client ownership and stores only the authenticated user", async () => {
  const userId = new Types.ObjectId().toString();
  const input = { amountMinor: 125, type: "expense", category: "food", occurredAt: new Date().toISOString() };
  let stored;
  const model = { create: async (record) => {
    stored = record;
    return { ...record, _id: new Types.ObjectId(), createdAt: new Date() };
  } };
  const transaction = await new TransactionsService(model).create(userId, input);
  assert.equal(stored.userId.toString(), userId);
  assert.equal(transaction.amountMinor, 125);
  assert.equal(transaction.userId, undefined);
  assert.equal(transaction.source, "manual");
  assert.equal(transaction.currency, "INR");
});
