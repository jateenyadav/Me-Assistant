const test = require("node:test");
const assert = require("node:assert/strict");
require("reflect-metadata");
const { CatalogService } = require("../dist/catalog/catalog.service");

test("catalog validates query and barcode and refuses absent provider configuration", async () => {
  const service = new CatalogService({ get: () => undefined });
  assert.throws(() => service.validateQuery("x"), { status: 400 });
  assert.throws(() => service.validateBarcode("012abc"), { status: 400 });
  await assert.rejects(service.searchFoods("rice"), { status: 503 });
  await assert.rejects(service.barcode("8901234567890"), { status: 503 });
});

test("USDA search retains only real per-100g nutrients and limits upstream page size", async (context) => {
  const previous = global.fetch;
  context.after(() => { global.fetch = previous; });
  global.fetch = async (url) => {
    assert.equal(url.hostname, "api.nal.usda.gov");
    assert.equal(url.searchParams.get("pageSize"), "20");
    assert.equal(url.searchParams.get("query"), "rice");
    return { ok: true, json: async () => ({ foods: [{
      fdcId: 123, description: "Brown rice", foodNutrients: [
        { nutrientId: 1003, unitName: "G", value: 2.6 },
        { nutrientId: 1005, unitName: "G", value: 23 },
        { nutrientId: 1004, unitName: "G", value: 0.9 },
        { nutrientName: "Energy", unitName: "KCAL", value: 110 },
      ],
    }, { fdcId: 456, description: "Unreported food", foodNutrients: [] }] }) };
  };
  const foods = await new CatalogService({ get: () => "private-api-key" }).searchFoods("rice");
  assert.equal(foods[0].per100g.calories, 110);
  assert.equal(foods[0].per100g.proteinGrams, 2.6);
  assert.equal(foods[1].per100g.calories, null);
  assert.equal(foods[1].per100g.fatGrams, null);
  assert.equal(JSON.stringify(foods).includes("private-api-key"), false);
});

test("barcode lookup reads OFF per-100g fields without filling missing values", async (context) => {
  const previous = global.fetch;
  context.after(() => { global.fetch = previous; });
  global.fetch = async (url, options) => {
    assert.equal(url.hostname, "world.openfoodfacts.org");
    assert.match(options.headers["User-Agent"], /contact@example.com/);
    return { ok: true, json: async () => ({ status: 1, product: {
      product_name: "Sample oats", nutriments: { "energy-kcal_100g": 390, proteins_100g: 10 },
    } }) };
  };
  const food = await new CatalogService({ get: () => "contact@example.com" }).barcode("8901234567890");
  assert.equal(food.name, "Sample oats");
  assert.equal(food.per100g.calories, 390);
  assert.equal(food.per100g.fatGrams, null);
});

test("exercise search reads all public wger pages once and keeps English entries", async (context) => {
  const previous = global.fetch;
  context.after(() => { global.fetch = previous; });
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    assert.equal(url.hostname, "wger.de");
    const offset = Number(url.searchParams.get("offset"));
    return { ok: true, json: async () => ({ count: 101, results: Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({
      id: offset + index, category: { name: "Legs" }, equipment: [{ name: "Barbell" }],
      translations: [{ language: 2, name: index === 0 && offset > 0 ? "Barbell squat" : "Lunge" }],
    })) }) };
  };
  const service = new CatalogService({ get: () => undefined });
  const result = await service.searchExercises("squat");
  assert.deepEqual(result, [{ id: 100, name: "Barbell squat", category: "Legs", equipment: ["Barbell"] }]);
  assert.equal((await service.searchExercises("squat")).length, 1);
  assert.equal(calls, 2);
});
