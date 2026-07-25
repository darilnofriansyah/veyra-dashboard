import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import {
  createSessionToken,
  SESSION_COOKIE
} from "../src/lib/auth.ts";
import { config as proxyConfig, proxy } from "../src/proxy.ts";

const authConfig = {
  appUrl: "https://veyra.darilnofriansyah.my.id",
  clientId: "123456789",
  clientSecret: "telegram-client-secret",
  authSecret: "a".repeat(64),
  coreUrl: "http://core-api:3000",
  coreApiKey: "core-api-key"
};

Object.assign(process.env, {
  APP_URL: authConfig.appUrl,
  TELEGRAM_CLIENT_ID: authConfig.clientId,
  TELEGRAM_CLIENT_SECRET: authConfig.clientSecret,
  AUTH_SECRET: authConfig.authSecret,
  NEXUS_CORE_URL: authConfig.coreUrl,
  CORE_API_KEY: authConfig.coreApiKey
});

function request(path, cookieValue) {
  const headers = cookieValue === undefined
    ? undefined
    : { cookie: `${SESSION_COOKIE}=${cookieValue}` };

  return new NextRequest(`http://localhost${path}`, { headers });
}

test("redirects signed-out dashboard requests to login", async () => {
  const response = await proxy(request("/dashboard"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
});

test("redirects a signed-in login request to the dashboard", async () => {
  const token = await createSessionToken(
    { telegramUserId: "976684739", name: "Kaito Ren" },
    authConfig
  );
  const response = await proxy(request("/", token));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/dashboard");
});

test("allows the expected route for each session state", async () => {
  const token = await createSessionToken(
    { telegramUserId: "976684739", name: "Kaito Ren" },
    authConfig
  );
  const login = await proxy(request("/"));
  const dashboard = await proxy(request("/dashboard", token));

  assert.equal(login.status, 200);
  assert.equal(login.headers.get("location"), null);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("location"), null);
});

test("treats a tampered cookie as signed out and limits the matcher", async () => {
  const token = await createSessionToken(
    { telegramUserId: "976684739", name: "Kaito Ren" },
    authConfig
  );
  const replacement = token.endsWith("a") ? "b" : "a";
  const response = await proxy(
    request("/dashboard", `${token.slice(0, -1)}${replacement}`)
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
  assert.deepEqual(proxyConfig.matcher, ["/", "/dashboard"]);
});
