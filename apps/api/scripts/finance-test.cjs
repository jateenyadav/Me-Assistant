const test = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
const { Types } = require("mongoose");
const { createTransactionSchema, importNotificationSchema, categorizeNotificationSchema, emailTextSchema, importEmailSchema, parseRupeeAmount, transactionListQuerySchema } = require("@lifeos/shared");
const { TransactionsService } = require("../dist/transactions/transactions.service");
const { TransactionSchema } = require("../dist/transactions/schemas/transaction.schema");
const { UpiMappingSchema } = require("../dist/transactions/schemas/upi-mapping.schema");
const { RefreshTokenSchema } = require("../dist/auth/schemas/refresh-token.schema");
const { GoogleLoginTicketSchema } = require("../dist/auth/schemas/google-auth-attempt.schema");
const { parseEmailPayment } = require("../dist/transactions/email-payment.parser");

test("finance and auth ownership fields use a real ObjectId schema type", () => {
  assert.equal(TransactionSchema.path("userId").instance, "ObjectId");
  assert.equal(UpiMappingSchema.path("userId").instance, "ObjectId");
  assert.equal(RefreshTokenSchema.path("userId").instance, "ObjectId");
  assert.equal(GoogleLoginTicketSchema.path("userId").instance, "ObjectId");
});

test("email parser accepts one completed INR payment and rejects ambiguous or unpaid messages", () => {
  assert.deepEqual(parseEmailPayment("Your bill payment was successful. Paid INR 1,234.50."), { amountMinor: 123450, type: "expense" });
  assert.deepEqual(parseEmailPayment("INR 200.00 credited to your account"), { amountMinor: 20000, type: "income" });
  for (const message of [
    "Your bill of INR 200 is due tomorrow", "OTP 123456 for paid INR 200", "INR 200 payment failed",
    "INR 200 refunded to your account", "Paid INR 200, balance INR 500", "Paid INR 200 and received INR 200",
    "Paid USD 200", "Paid INR 0", "Your payment of INR 200 is pending", "Paid INR 1,2,3", "Paid INR 2.345",
  ]) assert.equal(parseEmailPayment(message), null, message);
  assert.equal(emailTextSchema.safeParse({ text: "a".repeat(4001) }).success, false);
  assert.equal(importEmailSchema.safeParse({ text: "Paid INR 100", category: "food", occurredAt: new Date().toISOString(), userId: "someone" }).success, false);
});

test("email import hashes the message, never stores it and returns the same transaction on replay", async () => {
  const records = [];
  const model = {
    findOneAndUpdate: (selector, update) => ({ exec: async () => {
      let record = records.find((candidate) => candidate.userId.equals(selector.userId) && candidate.sourceEventId === selector.sourceEventId);
      if (!record) {
        record = { ...update.$setOnInsert, _id: new Types.ObjectId(), createdAt: new Date() };
        records.push(record);
      }
      return record;
    } }),
  };
  const service = new TransactionsService(model, null, { getOrThrow: () => "test-secret" });
  const owner = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const input = { text: "Your payment was successful: Paid INR 275.50", category: "food", occurredAt: new Date().toISOString() };
  const first = await service.importEmail(owner, input);
  assert.equal(first.amountMinor, 27550);
  assert.equal(first.source, "email_paste");
  assert.equal(first.userId, undefined);
  assert.equal((await service.importEmail(owner, { ...input, text: "  Your payment was successful:  Paid INR 275.50  " })).id, first.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].text, undefined);
  assert.match(records[0].sourceEventId, /^[a-f0-9]{64}$/);
  await assert.rejects(service.importEmail(owner, { ...input, category: "bills" }), { status: 409 });
  await service.importEmail(other, input);
  assert.equal(records.length, 2);
  assert.notEqual(records[0].sourceEventId, records[1].sourceEventId);
  const anotherPayment = await service.importEmail(owner, { ...input, occurredAt: new Date(Date.now() + 86400000).toISOString() });
  assert.notEqual(anotherPayment.id, first.id);
});

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

test("list filters by authenticated user ID and uses an exclusive tie-break cursor", async () => {
  const userId = new Types.ObjectId().toString();
  const timestamp = new Date("2026-09-20T12:00:00.000Z");
  const documents = Array.from({ length: 51 }, () => ({
    _id: new Types.ObjectId(), occurredAt: timestamp, createdAt: timestamp,
    amountMinor: 100, type: "expense", category: "food", currency: "INR", source: "manual",
  }));
  let filter;
  let sort;
  let limit;
  const model = {
    find: (query) => {
      filter = query;
      return {
        sort: (order) => { sort = order; return {
          limit: (count) => { limit = count; return { exec: async () => documents }; },
        }; },
      };
    },
  };
  const service = new TransactionsService(model);
  const result = await service.list(userId);
  assert.equal(result.transactions.length, 50);
  assert.match(result.nextCursor, /^[A-Za-z0-9_-]+$/);
  assert.equal(filter.userId.toString(), userId);
  assert.deepEqual(filter.category, { $exists: true });
  assert.deepEqual(sort, { occurredAt: -1, _id: -1 });
  assert.equal(limit, 51);
  await service.list(userId, result.nextCursor);
  assert.equal(filter.userId.toString(), userId);
  assert.equal(filter.$or[0].occurredAt.$lt.toISOString(), timestamp.toISOString());
  assert.equal(filter.$or[1].occurredAt.toISOString(), timestamp.toISOString());
  assert.equal(filter.$or[1]._id.$lt.toString(), documents[49]._id.toString());
  assert.equal(transactionListQuerySchema.safeParse({ cursor: result.nextCursor, userId }).success, false);
  for (const invalid of ["bad!", "a".repeat(257), Buffer.from("not json").toString("base64url"),
    Buffer.from(JSON.stringify(["2026-02-30T12:00:00.000Z", documents[0]._id.toString()])).toString("base64url")]) {
    await assert.rejects(service.list(userId, invalid), { status: 400 });
  }
});

test("six-month trend uses user-scoped UTC months, exact paise, and fills missing months", async () => {
  const userId = new Types.ObjectId().toString();
  const now = new Date("2026-09-26T10:00:00.000Z");
  let pipeline;
  const model = { aggregate: (query) => {
    pipeline = query;
    return { exec: async () => [
      { _id: { month: new Date("2026-04-01T00:00:00.000Z"), type: "expense" }, totalMinor: { toString: () => "12501" } },
      { _id: { month: new Date("2026-09-01T00:00:00.000Z"), type: "income" }, totalMinor: { toString: () => "501" } },
    ] };
  } };
  const trend = await new TransactionsService(model).trend(userId, now);
  assert.equal(pipeline[0].$match.userId.toString(), userId);
  assert.deepEqual(pipeline[0].$match.category, { $exists: true });
  assert.equal(pipeline[0].$match.occurredAt.$gte.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(pipeline[0].$match.occurredAt.$lte.toISOString(), now.toISOString());
  assert.equal(pipeline[1].$group._id.month.$dateTrunc.timezone, "UTC");
  assert.deepEqual(pipeline[1].$group.totalMinor, { $sum: { $toDecimal: "$amountMinor" } });
  assert.deepEqual(trend.months, [
    { month: "2026-04", expenseMinor: 12501, incomeMinor: 0 },
    { month: "2026-05", expenseMinor: 0, incomeMinor: 0 },
    { month: "2026-06", expenseMinor: 0, incomeMinor: 0 },
    { month: "2026-07", expenseMinor: 0, incomeMinor: 0 },
    { month: "2026-08", expenseMinor: 0, incomeMinor: 0 },
    { month: "2026-09", expenseMinor: 0, incomeMinor: 501 },
  ]);
  const overflow = { aggregate: () => ({ exec: async () => [
    { _id: { month: new Date("2026-09-01T00:00:00.000Z"), type: "expense" }, totalMinor: { toString: () => "9007199254740992" } },
  ] }) };
  await assert.rejects(new TransactionsService(overflow).trend(userId, now), { status: 500 });
});

test("30-day summary uses a user-scoped date window, excludes pending imports and sums exact paise", async () => {
  const userId = new Types.ObjectId().toString();
  const now = new Date("2026-09-24T10:00:00.000Z");
  let pipeline;
  const model = {
    aggregate: (query) => {
      pipeline = query;
      return { exec: async () => [
        { _id: { type: "expense", category: "food" }, totalMinor: { toString: () => "12501" } },
        { _id: { type: "expense", category: "bills" }, totalMinor: { toString: () => "999" } },
        { _id: { type: "income", category: "other" }, totalMinor: { toString: () => "8000" } },
      ] };
    },
  };
  const summary = await new TransactionsService(model).summary(userId, now);
  assert.equal(pipeline[0].$match.userId.toString(), userId);
  assert.deepEqual(pipeline[0].$match.category, { $exists: true });
  assert.equal(pipeline[0].$match.occurredAt.$gte.toISOString(), "2026-08-25T10:00:00.000Z");
  assert.equal(pipeline[0].$match.occurredAt.$lte.toISOString(), now.toISOString());
  assert.deepEqual(pipeline[1].$group.totalMinor, { $sum: { $toDecimal: "$amountMinor" } });
  assert.equal(summary.expenseMinor, 13500);
  assert.equal(summary.incomeMinor, 8000);
  assert.deepEqual(summary.expenseByCategory, [
    { category: "food", amountMinor: 12501 }, { category: "bills", amountMinor: 999 },
  ]);
  const overflow = { aggregate: () => ({ exec: async () => [
    { _id: { type: "expense", category: "food" }, totalMinor: { toString: () => "9007199254740992" } },
  ] }) };
  await assert.rejects(new TransactionsService(overflow).summary(userId, now), { status: 500 });
});

test("notification DTOs reject forged ownership, event IDs, and unexpected fields", () => {
  const input = { eventId: "a".repeat(64), amountMinor: 19900, type: "expense", occurredAt: new Date().toISOString(), upiId: "Merchant@UPI" };
  assert.equal(importNotificationSchema.parse(input).upiId, "merchant@upi");
  assert.equal(categorizeNotificationSchema.safeParse({ category: "food" }).success, true);
  for (const invalid of [
    { ...input, userId: new Types.ObjectId().toString() },
    { ...input, eventId: "short" },
    { ...input, amountMinor: 199.01 },
    { ...input, upiId: "not-a-upi-id" },
  ]) assert.equal(importNotificationSchema.safeParse(invalid).success, false);
  assert.equal(categorizeNotificationSchema.safeParse({ category: "food", userId: "other" }).success, false);
});

test("notification imports are user-scoped, replay-safe and learn UPI categories", async () => {
  const records = [];
  const mappings = [];
  const query = (value) => ({ exec: async () => value });
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === "category" && typeof value === "object") return value.$exists ? record.category !== undefined : record.category === undefined;
    return String(record[key]) === String(value);
  });
  const model = {
    findOneAndUpdate: (filter, change, options) => query((() => {
      const existing = records.find((record) => matches(record, filter));
      if (existing) {
        if (change.$set) Object.assign(existing, change.$set);
        return existing;
      }
      if (!options?.upsert) return null;
      const record = { ...change.$setOnInsert, _id: new Types.ObjectId(), createdAt: new Date() };
      records.push(record);
      return record;
    })()),
    findOne: (filter) => query(records.find((record) => matches(record, filter)) ?? null),
    find: (filter) => ({ sort: () => ({ limit: () => query(records.filter((record) => matches(record, filter))) }) }),
  };
  const mappingModel = {
    findOne: (filter) => query(mappings.find((mapping) => matches(mapping, filter)) ?? null),
    updateOne: (filter, change) => query((() => {
      const existing = mappings.find((mapping) => matches(mapping, filter));
      if (existing) Object.assign(existing, change.$set);
      else mappings.push({ ...change.$setOnInsert, ...change.$set });
      return { acknowledged: true };
    })()),
  };
  const service = new TransactionsService(model, mappingModel, { getOrThrow: () => "test-access-secret" });
  const owner = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const input = { eventId: "b".repeat(64), amountMinor: 5600, type: "expense", occurredAt: new Date().toISOString(), upiId: "vendor@upi" };
  const first = await service.importNotification(owner, input);
  assert.equal(first.status, "pending");
  assert.equal(records.length, 1);
  assert.equal((await service.importNotification(owner, input)).notification.id, first.notification.id);
  assert.equal(records.length, 1);
  await assert.rejects(service.importNotification(owner, { ...input, amountMinor: 1 }), { status: 409 });
  assert.equal((await service.pending(other)).length, 0);
  await assert.rejects(service.categorize(other, first.notification.id, "food"), { status: 404 });
  assert.equal((await service.categorize(owner, first.notification.id, "food")).category, "food");
  assert.equal((await service.importNotification(owner, input)).status, "categorized");
  assert.equal(mappings.length, 1);
  const next = await service.importNotification(owner, { ...input, eventId: "c".repeat(64) });
  assert.equal(next.status, "categorized");
  assert.equal(next.transaction.category, "food");
  assert.equal((await service.importNotification(other, input)).status, "pending");
  assert.equal((await service.pending(owner)).length, 0);
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
