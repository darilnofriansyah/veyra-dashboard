import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { GET as callback } from "../src/app/auth/telegram/callback/route.ts";
import { POST as miniAppLogin } from "../src/app/auth/telegram/mini-app/route.ts";
import { GET as start } from "../src/app/auth/telegram/route.ts";
import { verifySessionToken } from "../src/lib/auth.ts";

const environment = process.env as Record<string, string | undefined>;
let environmentLock = Promise.resolve();

async function withAuthEnvironment(run: () => Promise<void>) {
  const previousLock = environmentLock;
  let release!: () => void;
  environmentLock = new Promise((resolve) => { release = resolve; });
  await previousLock;

  const values = {
    APP_URL: "https://veyra.darilnofriansyah.my.id",
    TELEGRAM_CLIENT_ID: "123456789",
    TELEGRAM_CLIENT_SECRET: "telegram-client-secret",
    TELEGRAM_BOT_TOKEN: "123456789:test-bot-token",
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
    release();
  }
}

function miniAppInitData(authDate = Math.floor(Date.now() / 1000), startParam?: string) {
  const values = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify({ id: 976684739, first_name: "Kaito", last_name: "Ren" })
  });
  if (startParam !== undefined) values.set("start_param", startParam);
  const checkString = [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update("123456789:test-bot-token")
    .digest();
  values.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return values.toString();
}

function miniAppRequest(options: {
  origin?: string;
  body?: string;
  contentLength?: string;
} = {}) {
  const origin = "origin" in options
    ? options.origin
    : "https://veyra.darilnofriansyah.my.id";
  const body = options.body ?? miniAppInitData();
  const headers = new Headers({ "content-type": "text/plain" });
  if (options.contentLength !== undefined) {
    headers.set("content-length", options.contentLength);
  }
  if (origin !== undefined) headers.set("origin", origin);
  return new NextRequest(
    "https://veyra.darilnofriansyah.my.id/auth/telegram/mini-app",
    { method: "POST", headers, body }
  );
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

test("creates the existing session from valid Mini App data", async () => {
  await withAuthEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({});
    try {
      const response = await miniAppLogin(miniAppRequest());
      const sessionToken = response.cookies.get("veyra_session")?.value;

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "authorized", startParam: null });
      assert.deepEqual(await verifySessionToken(sessionToken), {
        telegramUserId: "976684739",
        name: "Kaito Ren"
      });
      assert.match(String(response.headers.get("set-cookie")), /HttpOnly/i);
      assert.match(String(response.headers.get("set-cookie")), /SameSite=none/i);
      assert.match(String(response.headers.get("set-cookie")), /Secure/i);
      assert.match(String(response.headers.get("set-cookie")), /Partitioned/i);
      assert.equal(response.headers.get("cache-control"), "no-store");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("returns the signed Mini App start parameter only as navigation data", async () => {
  await withAuthEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({});
    try {
      const response = await miniAppLogin(miniAppRequest({
        body: miniAppInitData(undefined, "pocket_42")
      }));

      assert.deepEqual(await response.json(), {
        status: "authorized",
        startParam: "pocket_42"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

for (const origin of [undefined, "https://attacker.example"]) {
  test(`rejects Mini App origin ${String(origin)}`, async () => {
    await withAuthEnvironment(async () => {
      const response = await miniAppLogin(miniAppRequest({ origin }));
      assert.equal(response.status, 401);
      assert.equal(response.cookies.get("veyra_session"), undefined);
      assert.equal(response.headers.get("set-cookie"), null);
    });
  });
}

test("rejects tampered Mini App data without calling Core", async () => {
  await withAuthEnvironment(async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return Response.json({}); };
    try {
      const response = await miniAppLogin(miniAppRequest({ body: "tampered" }));
      assert.equal(response.status, 401);
      assert.equal(called, false);
      assert.equal(response.cookies.get("veyra_session"), undefined);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("maps Core access denial to 403 without a session", async () => {
  await withAuthEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 404 });
    try {
      const response = await miniAppLogin(miniAppRequest());
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { status: "access_denied" });
      assert.equal(response.cookies.get("veyra_session"), undefined);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("maps Core failure to 503 without a session", async () => {
  await withAuthEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 503 });
    try {
      const response = await miniAppLogin(miniAppRequest());
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: "telegram_login" });
      assert.equal(response.cookies.get("veyra_session"), undefined);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("rejects an oversized Mini App body without calling Core", async () => {
  await withAuthEnvironment(async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return Response.json({}); };
    try {
      const response = await miniAppLogin(miniAppRequest({ body: "x".repeat(16_385) }));
      assert.equal(response.status, 401);
      assert.equal(called, false);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("rejects an oversized declared body without calling Core", async () => {
  await withAuthEnvironment(async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return Response.json({}); };
    try {
      const response = await miniAppLogin(miniAppRequest({
        body: miniAppInitData(),
        contentLength: "16385"
      }));
      assert.equal(response.status, 401);
      assert.equal(called, false);
      assert.equal(response.cookies.get("veyra_session"), undefined);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("returns generic 503 when Mini App configuration is missing", async () => {
  await withAuthEnvironment(async () => {
    const previous = environment.TELEGRAM_BOT_TOKEN;
    delete environment.TELEGRAM_BOT_TOKEN;
    try {
      const response = await miniAppLogin(miniAppRequest());
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: "telegram_login" });
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      if (previous === undefined) delete environment.TELEGRAM_BOT_TOKEN;
      else environment.TELEGRAM_BOT_TOKEN = previous;
    }
  });
});
