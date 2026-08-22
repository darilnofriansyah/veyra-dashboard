import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT
} from "jose";
import {
  authorizeTelegramUser,
  completeTelegramLogin,
  createAuthorizationRequest,
  createSessionToken,
  exchangeTelegramCode,
  readTelegramBotToken,
  verifyTelegramIdToken,
  verifyFlowToken,
  verifyTelegramMiniAppInitData,
  verifySessionToken,
  type AuthConfig
} from "../src/lib/auth.ts";

const config: AuthConfig = {
  appUrl: "https://veyra.darilnofriansyah.my.id",
  clientId: "123456789",
  clientSecret: "telegram-client-secret",
  authSecret: "a".repeat(64),
  coreUrl: "http://core-api:3000",
  coreApiKey: "core-api-key"
};

const botToken = "123456789:test-bot-token";

function miniAppInitData(
  overrides: Record<string, string> = {},
  token = botToken
) {
  const values = new URLSearchParams({
    auth_date: "1787335200",
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify({
      id: 976684739,
      first_name: "Kaito",
      last_name: "Ren",
      username: "kaito"
    }),
    ...overrides
  });
  const check = [...values.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  values.set(
    "hash",
    createHmac("sha256", secret).update(check).digest("hex")
  );
  return values.toString();
}

test("verifies fresh Telegram Mini App initialization data", () => {
  assert.deepEqual(
    verifyTelegramMiniAppInitData(
      miniAppInitData(),
      botToken,
      1787335200
    ),
    { telegramUserId: "976684739", name: "Kaito Ren" }
  );
});

test("reads the required Telegram bot token", () => {
  assert.equal(
    readTelegramBotToken({ TELEGRAM_BOT_TOKEN: " token " }),
    "token"
  );
  assert.throws(
    () => readTelegramBotToken({ TELEGRAM_BOT_TOKEN: " " }),
    /TELEGRAM_BOT_TOKEN is required/
  );
  assert.throws(
    () => readTelegramBotToken({}),
    /TELEGRAM_BOT_TOKEN is required/
  );
});

test("rejects unsafe Telegram Mini App initialization data", () => {
  const now = 1787335200;
  const valid = miniAppInitData();
  const cases = [
    valid.replace("Kaito", "Attacker"),
    miniAppInitData({ auth_date: String(now - 301) }),
    miniAppInitData({ auth_date: String(now + 31) }),
    miniAppInitData({ auth_date: "not-a-date" }),
    miniAppInitData({ user: "not-json" }),
    miniAppInitData({ user: JSON.stringify({ id: 0, first_name: "Kaito" }) }),
    miniAppInitData({ user: JSON.stringify({ id: 9007199254740992 }) }),
    miniAppInitData().replace("user=", "user=x&user="),
    `${miniAppInitData()}&hash=${"0".repeat(64)}`,
    "x".repeat(16_385)
  ];

  for (const initData of cases) {
    assert.throws(() =>
      verifyTelegramMiniAppInitData(initData, botToken, now)
    );
  }
});

test("rejects malformed raw percent escapes", () => {
  const signed = miniAppInitData({
    user: JSON.stringify({
      id: 976684739,
      first_name: "Kaito",
      username: "ka%ito"
    })
  });
  const malformed = signed.replace("%25", "%");

  assert.throws(() =>
    verifyTelegramMiniAppInitData(malformed, botToken, 1787335200)
  );
});

test("accepts Telegram users with minimal or absent names", () => {
  assert.deepEqual(
    verifyTelegramMiniAppInitData(
      miniAppInitData({
        user: JSON.stringify({ id: 976684739, first_name: "Kaito" })
      }),
      botToken,
      1787335200
    ),
    { telegramUserId: "976684739", name: "Kaito" }
  );
  assert.deepEqual(
    verifyTelegramMiniAppInitData(
      miniAppInitData({ user: JSON.stringify({ id: 976684739 }) }),
      botToken,
      1787335200
    ),
    { telegramUserId: "976684739", name: null }
  );
});

test("builds the registered Telegram authorization request with PKCE", async () => {
  const { url, flowToken } = await createAuthorizationRequest(config, {
    state: "state-value",
    nonce: "nonce-value",
    codeVerifier: "code-verifier"
  });

  assert.equal(url.origin, "https://oauth.telegram.org");
  assert.equal(url.pathname, "/auth");
  assert.equal(url.searchParams.get("client_id"), "123456789");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://veyra.darilnofriansyah.my.id/auth/telegram/callback"
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid profile");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("nonce"), "nonce-value");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("code_challenge"),
    "qdgLLRr1saFHT6DWfWU28VNPIi7e9ynEBnBG3Oadw9g"
  );

  assert.deepEqual(await verifyFlowToken(flowToken, config), {
    state: "state-value",
    nonce: "nonce-value",
    codeVerifier: "code-verifier"
  });
});

test("rejects a tampered OIDC flow token", async () => {
  const { flowToken } = await createAuthorizationRequest(config, {
    state: "state-value",
    nonce: "nonce-value",
    codeVerifier: "code-verifier"
  });
  const replacement = flowToken.endsWith("a") ? "b" : "a";
  const tampered = `${flowToken.slice(0, -1)}${replacement}`;

  assert.equal(await verifyFlowToken(tampered, config), null);
});

test("accepts only an untampered Veyra session", async () => {
  const token = await createSessionToken(
    { telegramUserId: "976684739", name: "Kaito Ren" },
    config
  );
  const replacement = token.endsWith("a") ? "b" : "a";
  const tampered = `${token.slice(0, -1)}${replacement}`;

  assert.deepEqual(await verifySessionToken(token, config), {
    telegramUserId: "976684739",
    name: "Kaito Ren"
  });
  assert.equal(await verifySessionToken(tampered, config), null);
  assert.equal(await verifySessionToken(undefined, config), null);
});

async function telegramToken(overrides: Record<string, unknown> = {}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const jwks = createLocalJWKSet({
    keys: [{ ...jwk, alg: "RS256", kid: "telegram-test-key", use: "sig" }]
  });
  const claims = {
    sub: "telegram-subject",
    nonce: "nonce-value",
    id: 976684739,
    name: "Kaito Ren",
    ...overrides
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "telegram-test-key" })
    .setIssuedAt()
    .setIssuer(String(overrides.iss ?? "https://oauth.telegram.org"))
    .setAudience(String(overrides.aud ?? config.clientId))
    .setExpirationTime(String(overrides.exp ?? "5m"))
    .sign(privateKey);

  return { jwks, token };
}

test("verifies Telegram identity from a signed ID token", async () => {
  const { jwks, token } = await telegramToken();

  assert.deepEqual(
    await verifyTelegramIdToken(token, "nonce-value", config, jwks),
    { telegramUserId: "976684739", name: "Kaito Ren" }
  );
});

test("rejects invalid Telegram ID-token claims", async () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["issuer", { iss: "https://attacker.example" }, "nonce-value"],
    ["audience", { aud: "other-client" }, "nonce-value"],
    ["nonce", {}, "other-nonce"],
    ["expiration", { exp: "-10s" }, "nonce-value"],
    ["missing subject", { sub: undefined }, "nonce-value"],
    ["missing id", { id: undefined }, "nonce-value"],
    ["non-numeric id", { id: "telegram-user" }, "nonce-value"],
    ["zero id", { id: 0 }, "nonce-value"]
  ];

  for (const [name, overrides, nonce] of cases) {
    await test(name, async () => {
      const { jwks, token } = await telegramToken(overrides);
      await assert.rejects(
        () => verifyTelegramIdToken(token, nonce, config, jwks)
      );
    });
  }
});

test("exchanges the code with Basic credentials and the PKCE verifier", async () => {
  let request: { input: string; init?: RequestInit } | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    request = { input: String(input), init };
    return Response.json({ id_token: "telegram-id-token" });
  };

  const idToken = await exchangeTelegramCode(
    "authorization-code",
    "code-verifier",
    config,
    fetchImpl
  );

  assert.equal(idToken, "telegram-id-token");
  assert.equal(request?.input, "https://oauth.telegram.org/token");
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, {
    accept: "application/json",
    authorization:
      "Basic MTIzNDU2Nzg5OnRlbGVncmFtLWNsaWVudC1zZWNyZXQ=",
    "content-type": "application/x-www-form-urlencoded"
  });
  const body = new URLSearchParams(String(request?.init?.body));
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code"), "authorization-code");
  assert.equal(
    body.get("redirect_uri"),
    "https://veyra.darilnofriansyah.my.id/auth/telegram/callback"
  );
  assert.equal(body.get("client_id"), "123456789");
  assert.equal(body.get("code_verifier"), "code-verifier");
});

test("authorizes only active Nexus Core users", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const authorized = await authorizeTelegramUser(
    "976684739",
    config,
    async (input, init) => {
      requests.push({ input: String(input), init });
      return Response.json({});
    }
  );

  assert.equal(authorized, "authorized");
  assert.equal(
    requests[0]?.input,
    "http://core-api:3000/api/veyra/dashboard/overview"
  );
  assert.deepEqual(requests[0]?.init?.headers, {
    "content-type": "application/json",
    "x-core-api-key": "core-api-key"
  });
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    telegramUserId: "976684739",
    timezone: "Asia/Jakarta"
  });

  const denied = await authorizeTelegramUser(
    "976684739",
    config,
    async () => new Response(null, { status: 404 })
  );
  const unavailable = await authorizeTelegramUser(
    "976684739",
    config,
    async () => new Response(null, { status: 503 })
  );
  const network = await authorizeTelegramUser(
    "976684739",
    config,
    async () => {
      throw new Error("network failure");
    }
  );

  assert.equal(denied, "access_denied");
  assert.equal(unavailable, "telegram_login");
  assert.equal(network, "telegram_login");
});

test("rejects a callback whose state does not match the signed flow", async () => {
  const { flowToken } = await createAuthorizationRequest(config, {
    state: "expected-state",
    nonce: "nonce-value",
    codeVerifier: "code-verifier"
  });
  let fetchCalled = false;

  const result = await completeTelegramLogin({
    code: "authorization-code",
    state: "wrong-state",
    flowToken,
    config,
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response();
    }
  });

  assert.deepEqual(result, { status: "telegram_login" });
  assert.equal(fetchCalled, false);
});
