import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { GET as callback } from "../src/app/auth/telegram/callback/route.ts";
import { GET as start } from "../src/app/auth/telegram/route.ts";

const environment = process.env as Record<string, string | undefined>;

async function withAuthEnvironment(run: () => Promise<void>) {
  const values = {
    APP_URL: "https://veyra.darilnofriansyah.my.id",
    TELEGRAM_CLIENT_ID: "123456789",
    TELEGRAM_CLIENT_SECRET: "telegram-client-secret",
    AUTH_SECRET: "a".repeat(64),
    NEXUS_CORE_URL: "http://core-api:3000",
    CORE_API_KEY: "core-api-key"
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, environment[key]])
  );
  Object.assign(environment, values);

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
  }
}

test("starts Telegram login and stores one short-lived flow cookie", async () => {
  await withAuthEnvironment(async () => {
    const response = await start();
    const location = new URL(String(response.headers.get("location")));
    const cookie = String(response.headers.get("set-cookie"));

    assert.equal(response.status, 307);
    assert.equal(location.origin, "https://oauth.telegram.org");
    assert.equal(
      location.searchParams.get("redirect_uri"),
      "https://veyra.darilnofriansyah.my.id/auth/telegram/callback"
    );
    assert.equal(location.searchParams.get("scope"), "openid profile");
    assert.match(cookie, /^veyra_oidc_flow=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\/auth\/telegram\/callback/i);
    assert.match(cookie, /Max-Age=600/i);
    assert.match(cookie, /SameSite=lax/i);
  });
});

test("rejects an incomplete callback and expires its flow cookie", async () => {
  await withAuthEnvironment(async () => {
    const response = await callback(new NextRequest(
      "https://veyra.darilnofriansyah.my.id/auth/telegram/callback"
    ));
    const cookie = String(response.headers.get("set-cookie"));

    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://veyra.darilnofriansyah.my.id/?error=telegram_login"
    );
    assert.match(cookie, /^veyra_oidc_flow=;/);
    assert.match(cookie, /Max-Age=0/i);
  });
});
