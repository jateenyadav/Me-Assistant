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
const { LifeRecord } = require("../dist/life/life.schema");
const { McpToken } = require("../dist/mcp/mcp-token.schema");

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
    assert.equal(ownList.nextCursor, null);
    await request("GET", "/transactions?cursor=bad!", null, 400, registered.accessToken);
    await request("GET", "/transactions/summary", null, 401);
    await request("GET", "/transactions/trend", null, 401);
    const ownSummary = await request("GET", "/transactions/summary", null, 200, registered.accessToken);
    assert.equal(ownSummary.summary.expenseMinor, 12501);
    assert.equal(ownSummary.summary.incomeMinor, 0);
    assert.deepEqual(ownSummary.summary.expenseByCategory, [{ category: "food", amountMinor: 12501 }]);
    const ownTrend = await request("GET", "/transactions/trend", null, 200, registered.accessToken);
    assert.equal(ownTrend.trend.months.length, 6);
    assert.equal(ownTrend.trend.months.at(-1).expenseMinor, 12501);
    const otherUser = await request("POST", "/auth/register", { email: otherEmail, password }, 201);
    const otherList = await request("GET", "/transactions", null, 200, otherUser.accessToken);
    assert.deepEqual(otherList.transactions, []);
    assert.equal(otherList.nextCursor, null);
    const otherTrend = await request("GET", "/transactions/trend", null, 200, otherUser.accessToken);
    assert.ok(otherTrend.trend.months.every((month) => month.expenseMinor === 0 && month.incomeMinor === 0));

    await request("GET", "/life/note", null, 401);
    await request("GET", "/life/unknown", null, 400, registered.accessToken);
    const note = await request("POST", "/life/note", { title: "Private", body: "Daily note" }, 201, registered.accessToken);
    assert.equal(note.entry.userId, undefined);
    assert.equal(note.entry.payload.title, "Private");
    await request("POST", "/life/note", { title: "Invalid", body: "text", userId: registered.user.id }, 400, registered.accessToken);
    assert.deepEqual((await request("GET", "/life/note", null, 200, otherUser.accessToken)).entries, []);
    await request("PUT", `/life/note/${note.entry.id}`, { title: "Stolen", body: "text" }, 404, otherUser.accessToken);
    const updatedNote = await request("PUT", `/life/note/${note.entry.id}`, { title: "Updated", body: "text" }, 200, registered.accessToken);
    assert.equal(updatedNote.entry.payload.title, "Updated");
    await request("GET", "/life/food/summary", null, 401);
    const food = await request("POST", "/life/food", {
      name: "Test food", source: "manual", calories: 120.25, proteinGrams: 8.5,
      carbohydratesGrams: 12, fatGrams: 3.25, loggedAt: new Date().toISOString(),
    }, 201, registered.accessToken);
    assert.equal(food.entry.payload.calories, 120.25);
    const foodSummary = await request("GET", "/life/food/summary", null, 200, registered.accessToken);
    assert.equal(foodSummary.summary.count, 1);
    assert.equal(foodSummary.summary.calories, 120.25);
    assert.equal(foodSummary.summary.proteinGrams, 8.5);
    assert.equal((await request("GET", "/life/food/summary", null, 200, otherUser.accessToken)).summary.count, 0);
    const workout = await request("POST", "/life/workout", {
      title: "Strength", structure: "straight", loggedAt: new Date().toISOString(),
      exercises: [{ name: "Squat", sets: [{ reps: 8, weightKg: 20 }, { reps: 5, weightKg: 30 }] }],
    }, 201, registered.accessToken);
    assert.equal(workout.entry.payload.exercises.length, 1);
    const stats = await request("GET", "/life/workout/stats", null, 200, registered.accessToken);
    assert.deepEqual(stats.exercises, [{ exercise: "Squat", sets: 2, heaviestKg: 30, volumeKg: 310 }]);
    assert.deepEqual((await request("GET", "/life/workout/stats", null, 200, otherUser.accessToken)).exercises, []);
    const medicine = await request("POST", "/life/medication", {
      name: "User-entered medication", dose: "1 tablet", recurrence: "daily", timeOfDay: "08:00", timeZone: "Asia/Kolkata",
    }, 201, registered.accessToken);
    await request("POST", "/life/medication-intake", { medicationId: medicine.entry.id, outcome: "taken", loggedAt: new Date().toISOString() }, 404, otherUser.accessToken);
    await request("POST", "/life/medication-intake", { medicationId: medicine.entry.id, outcome: "taken", loggedAt: new Date().toISOString() }, 201, registered.accessToken);
    await request("DELETE", `/life/medication/${medicine.entry.id}`, null, 409, registered.accessToken);
    await request("DELETE", `/life/note/${note.entry.id}`, null, 404, otherUser.accessToken);
    await request("DELETE", `/life/note/${note.entry.id}`, null, 204, registered.accessToken);
    assert.deepEqual((await request("GET", "/life/note", null, 200, registered.accessToken)).entries, []);
    await request("GET", "/catalog/foods?q=x", null, 400, registered.accessToken);
    await request("GET", "/catalog/barcode/not-a-barcode", null, 400, registered.accessToken);

    assert.equal((await request("GET", "/mcp/settings", null, 200, registered.accessToken)).enabled, false);
    await request("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize" }, 401, registered.accessToken);
    await request("POST", "/mcp/tokens", { label: "Desktop", scopes: ["read"] }, 403, registered.accessToken);
    assert.equal((await request("PATCH", "/mcp/settings", { enabled: true }, 200, registered.accessToken)).enabled, true);
    const tokenResult = await request("POST", "/mcp/tokens", { label: "Desktop", scopes: ["read"] }, 201, registered.accessToken);
    assert.match(tokenResult.token.token, /^mcp_[A-Za-z0-9_-]{43}$/);
    const mcpRequest = async (method, params) => {
      const response = await fetch(`${baseUrl}/mcp`, { method: "POST", headers: {
        Authorization: `Bearer ${tokenResult.token.token}`, Accept: "application/json, text/event-stream",
        "Content-Type": "application/json", "MCP-Protocol-Version": "2025-11-25",
      }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const text = await response.text();
      assert.equal(response.status, 200, `MCP ${method}: ${text}`);
      return JSON.parse(text);
    };
    const initialized = await mcpRequest("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "1.0.0" } });
    assert.equal(initialized.result.serverInfo.name, "lifeos");
    const listed = await mcpRequest("tools/list", {});
    assert.ok(listed.result.tools.some((tool) => tool.name === "get_transactions"));
    assert.ok(!listed.result.tools.some((tool) => tool.name === "add_note"));
    await request("PATCH", "/mcp/settings", { enabled: false }, 200, registered.accessToken);
    await request("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }, 401, tokenResult.token.token);
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

    const transactions = app.get(getModelToken(Transaction.name));
    const tiedDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const tiedRecords = await transactions.insertMany(Array.from({ length: 51 }, (_, index) => ({
      userId: registered.user.id, amountMinor: index + 1, type: "expense", category: "food",
      occurredAt: tiedDate, currency: "INR", source: "manual",
    })));
    const firstPage = await request("GET", "/transactions", null, 200, registered.accessToken);
    assert.equal(firstPage.transactions.length, 50);
    assert.ok(firstPage.nextCursor);
    const secondPage = await request("GET", `/transactions?cursor=${firstPage.nextCursor}`, null, 200, registered.accessToken);
    assert.equal(secondPage.nextCursor, null);
    const allIds = [...firstPage.transactions, ...secondPage.transactions].map((transaction) => transaction.id);
    assert.equal(new Set(allIds).size, allIds.length);
    assert.ok(tiedRecords.every((record) => allIds.includes(record._id.toString())));
    assert.deepEqual((await request("GET", `/transactions?cursor=${firstPage.nextCursor}`, null, 200, otherUser.accessToken)).transactions, []);

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
    console.log("Auth/finance/life/MCP smoke passed: auth, imports, paging, medication, scoped MCP tools and revocation.");
  } finally {
    if (app) {
      const users = app.get(getModelToken(User.name));
      const refreshTokens = app.get(getModelToken(RefreshToken.name));
      const transactions = app.get(getModelToken(Transaction.name));
      const mappings = app.get(getModelToken(UpiMapping.name));
      const lifeRecords = app.get(getModelToken(LifeRecord.name));
      const mcpTokens = app.get(getModelToken(McpToken.name));
      for (const testEmail of [email, otherEmail]) {
        const user = await users.findOne({ email: testEmail }).select("_id").lean().exec();
        if (user) {
          await transactions.deleteMany({ userId: user._id }).exec();
          await lifeRecords.deleteMany({ userId: user._id }).exec();
          await mcpTokens.deleteMany({ userId: user._id }).exec();
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
