const test = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
const { Types } = require("mongoose");
const { lifeSchemas } = require("@lifeos/shared");
const { LifeService } = require("../dist/life/life.service");
const { LifeRecordSchema } = require("../dist/life/life.schema");

test("life records have typed ownership, bounded kind and time index", () => {
  assert.equal(LifeRecordSchema.path("userId").instance, "ObjectId");
  assert.deepEqual(LifeRecordSchema.indexes()[0][0], { userId: 1, kind: 1, occurredAt: -1, _id: -1 });
});

test("medication schedules and intake reject unsafe or ambiguous inputs", () => {
  const daily = { name: "User-entered medication", dose: "1 tablet", timeOfDay: "08:30", timeZone: "Asia/Kolkata", recurrence: "daily" };
  assert.equal(lifeSchemas.medication.safeParse(daily).success, true);
  for (const invalid of [
    { ...daily, dose: "" }, { ...daily, timeOfDay: "25:00" },
    { ...daily, timeZone: "Fake/Zone" }, { ...daily, weekdays: [1] },
    { ...daily, recurrence: "weekly" }, { ...daily, dose: "1 tablet", userId: new Types.ObjectId().toString() },
  ]) assert.equal(lifeSchemas.medication.safeParse(invalid).success, false);
  assert.equal(lifeSchemas.medication.safeParse({ ...daily, recurrence: "weekly", weekdays: [1, 3] }).success, true);
  assert.equal(lifeSchemas["medication-intake"].safeParse({ medicationId: "not-an-id", outcome: "taken", loggedAt: new Date().toISOString() }).success, false);
  assert.equal(lifeSchemas.food.safeParse({ name: "Food", calories: -1 }).success, false);
  const catalog = { name: "Food", source: "usda", externalId: "123", calories: 100,
    proteinGrams: 2, carbohydratesGrams: 15, fatGrams: 1, loggedAt: new Date().toISOString() };
  assert.equal(lifeSchemas.food.safeParse(catalog).success, false);
  assert.equal(lifeSchemas.food.safeParse({ ...catalog, servingGrams: 100 }).success, true);
  assert.equal(lifeSchemas.workout.safeParse({ title: "A", structure: "straight", exercises: [], loggedAt: new Date().toISOString() }).success, false);
});

test("create scopes owner, validates payload, and hides private ownership", async () => {
  const owner = new Types.ObjectId().toString();
  let stored;
  const model = { create: async (input) => {
    stored = input;
    return { ...input, _id: new Types.ObjectId(), createdAt: new Date(), updatedAt: new Date() };
  } };
  const service = new LifeService(model);
  const entry = await service.create(owner, "note", { title: "Read", body: "Private", tags: ["work"] });
  assert.equal(stored.userId.toString(), owner);
  assert.equal(stored.kind, "note");
  assert.equal(entry.userId, undefined);
  assert.equal(entry.payload.body, "Private");
  await assert.rejects(service.create(owner, "note", { title: "Read", body: "Private", userId: owner }), { status: 400 });
  assert.throws(() => service.parseKind("__proto__"), { status: 400 });
});

test("intake must point to a medication owned by this user", async () => {
  const owner = new Types.ObjectId().toString();
  const medicationId = new Types.ObjectId().toString();
  let selector;
  const model = {
    exists: (query) => { selector = query; return null; },
    create: () => { throw new Error("Must not create an intake for another account"); },
  };
  const service = new LifeService(model);
  await assert.rejects(service.create(owner, "medication-intake", { medicationId, outcome: "taken", loggedAt: new Date().toISOString() }), { status: 404 });
  assert.equal(selector.userId.toString(), owner);
  assert.equal(selector._id.toString(), medicationId);
  assert.equal(selector.kind, "medication");
});

test("30-day food summary includes all owner logs, rejects future entries and rounds nutrients", async () => {
  const owner = new Types.ObjectId().toString();
  let pipeline;
  const records = { aggregate: (stages) => {
    pipeline = stages;
    return { exec: async () => [{ count: 2, calories: "225.125", proteinGrams: "12.345",
      carbohydratesGrams: "36.45", fatGrams: "4.2" }] };
  } };
  const summary = await new LifeService(records).foodSummary(owner);
  assert.equal(pipeline[0].$match.userId.toString(), owner);
  assert.equal(pipeline[0].$match.kind, "food");
  assert.equal(pipeline[0].$match.occurredAt.$gte.toISOString(), summary.from);
  assert.equal(pipeline[0].$match.occurredAt.$lte.toISOString(), summary.to);
  assert.equal(pipeline[1].$group.calories.$sum.$toDecimal, "$payload.calories");
  assert.equal(summary.count, 2);
  assert.equal(summary.calories, 225.13);
  assert.equal(summary.proteinGrams, 12.35);
  assert.equal(summary.carbohydratesGrams, 36.45);
  assert.deepEqual(await new LifeService({ aggregate: () => ({ exec: async () => [] }) }).foodSummary(owner).then(({ count, calories }) => ({ count, calories })), { count: 0, calories: 0 });
});

test("workout stats aggregate only owner sets and report volume and heaviest weight", async () => {
  const owner = new Types.ObjectId().toString();
  let pipeline;
  const records = { aggregate: (stages) => {
    pipeline = stages;
    return { exec: async () => [{ _id: "Squat", sets: 3, heaviestKg: 65,
      volumeKg: { toString: () => "975.125" } }] };
  } };
  const stats = await new LifeService(records).workoutStats(owner);
  assert.equal(pipeline[0].$match.userId.toString(), owner);
  assert.equal(pipeline[0].$match.kind, "workout");
  assert.equal(pipeline[1].$unwind, "$payload.exercises");
  assert.equal(pipeline[2].$unwind, "$payload.exercises.sets");
  assert.equal(pipeline[4].$sort.volumeKg, -1);
  assert.equal(pipeline[5].$limit, 30);
  assert.deepEqual(stats, [{ exercise: "Squat", sets: 3, heaviestKg: 65, volumeKg: 975.13 }]);
});

test("list, replacement and deletion always filter by token owner and kind", async () => {
  const owner = new Types.ObjectId().toString();
  const entryId = new Types.ObjectId().toString();
  const input = { title: "Later", body: "Memo" };
  const selectors = [];
  const model = {
    find: (query) => { selectors.push(query); return {
      sort: (order) => { assert.deepEqual(order, { occurredAt: -1, _id: -1 }); return {
        limit: (count) => { assert.equal(count, 100); return { exec: async () => [] }; },
      }; },
    }; },
    findOneAndUpdate: (query) => { selectors.push(query); return { exec: async () => null }; },
    deleteOne: (query) => { selectors.push(query); return { exec: async () => ({ deletedCount: 0 }) }; },
  };
  const service = new LifeService(model);
  assert.deepEqual(await service.list(owner, "note"), []);
  await assert.rejects(service.replace(owner, "note", entryId, input), { status: 404 });
  await assert.rejects(service.remove(owner, "note", entryId), { status: 404 });
  assert.equal(selectors.length, 3);
  assert.ok(selectors.every((selector) => selector.userId.toString() === owner && selector.kind === "note"));
  assert.equal(selectors[1]._id.toString(), entryId);
});

test("goal progress aggregates only the owner’s real module data and labels unsupported goals", async () => {
  const owner = new Types.ObjectId().toString();
  const started = new Date("2026-09-01T00:00:00.000Z");
  const goals = [
    { domain: "finance", unit: "INR", target: 2000 },
    { domain: "diet", unit: "kcal", target: 3000 },
    { domain: "workout", unit: "sessions", target: 5 },
    { domain: "medication", unit: "doses", target: 10 },
    { domain: "custom", unit: "pages", target: 100 },
  ].map((payload) => ({ _id: new Types.ObjectId(), createdAt: started, payload }));
  const selectors = [];
  const records = {
    find: (selector) => { selectors.push(selector); return { sort: () => ({ limit: () => ({ exec: async () => goals }) }) }; },
    countDocuments: (selector) => { selectors.push(selector); return { exec: async () => selector.kind === "workout" ? 3 : 6 }; },
    aggregate: (pipeline) => { selectors.push(pipeline[0].$match); return { exec: async () => [{ amount: { toString: () => "1200.5" } }] }; },
  };
  const transactions = { aggregate: (pipeline) => { selectors.push(pipeline[0].$match); return { exec: async () => [
    { _id: "income", amount: { toString: () => "25001" } },
    { _id: "expense", amount: { toString: () => "5001" } },
  ] }; } };
  const progress = await new LifeService(records, transactions).goalProgress(owner);
  assert.deepEqual(progress.map((goal) => goal.current), [200, 1200.5, 3, 6, null]);
  assert.equal(progress[4].status, "unsupported");
  assert.ok(selectors.every((selector) => selector.userId.toString() === owner));
});
