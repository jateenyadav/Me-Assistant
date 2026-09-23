const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { getModelToken } = require("@nestjs/mongoose");
const { AppModule } = require("../dist/app.module");
const { User } = require("../dist/users/schemas/user.schema");
const { RefreshToken } = require("../dist/auth/schemas/refresh-token.schema");

async function main() {
  const email = `lifeos-smoke-${randomUUID()}@example.com`;
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

    const registered = await request("POST", "/auth/register", { email, password }, 201);
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.passwordHash, undefined);
    const currentUser = await request("GET", "/auth/me", null, 200, registered.accessToken);
    assert.equal(currentUser.user.id, registered.user.id);

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
    console.log("Auth smoke passed: health, register, me, login, refresh, forgery, reuse, logout.");
  } finally {
    if (app) {
      const users = app.get(getModelToken(User.name));
      const refreshTokens = app.get(getModelToken(RefreshToken.name));
      const user = await users.findOne({ email }).select("_id").lean().exec();
      if (user) {
        await refreshTokens.deleteMany({ userId: user._id }).exec();
        await users.deleteOne({ _id: user._id }).exec();
      }
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error("Auth smoke failed:", error.message);
  process.exitCode = 1;
});
