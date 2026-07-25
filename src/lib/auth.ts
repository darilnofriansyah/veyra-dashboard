import {
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import {
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  type JWTVerifyGetKey
} from "jose";

export const OIDC_FLOW_COOKIE = "veyra_oidc_flow";
export const SESSION_COOKIE = "veyra_session";

const AUTH_ISSUER = "veyra";
const FLOW_AUDIENCE = "veyra-oidc-flow";
const SESSION_AUDIENCE = "veyra-web";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);

export interface AuthConfig {
  appUrl: string;
  clientId: string;
  clientSecret: string;
  authSecret: string;
  coreUrl: string;
  coreApiKey?: string;
}

interface AuthorizationInput {
  state?: string;
  nonce?: string;
  codeVerifier?: string;
}

interface OidcFlow {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface TelegramIdentity {
  telegramUserId: string;
  name: string | null;
}

export type Session = TelegramIdentity;

const secret = (config: AuthConfig) =>
  new TextEncoder().encode(config.authSecret);

const randomValue = () => randomBytes(32).toString("base64url");

function required(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

export function readAuthConfig(
  environment: NodeJS.ProcessEnv = process.env
): AuthConfig {
  const appUrl = new URL(required(environment.APP_URL, "APP_URL"));
  const clientId = required(
    environment.TELEGRAM_CLIENT_ID,
    "TELEGRAM_CLIENT_ID"
  );
  const authSecret = required(environment.AUTH_SECRET, "AUTH_SECRET");

  if (appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS");
  }
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error("TELEGRAM_CLIENT_ID must be a positive integer");
  }
  if (authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }

  return {
    appUrl: appUrl.origin,
    clientId,
    clientSecret: required(
      environment.TELEGRAM_CLIENT_SECRET,
      "TELEGRAM_CLIENT_SECRET"
    ),
    authSecret,
    coreUrl: required(
      environment.NEXUS_CORE_URL ?? "http://core-api:3000",
      "NEXUS_CORE_URL"
    ).replace(/\/+$/, ""),
    coreApiKey: environment.CORE_API_KEY?.trim() || undefined
  };
}

function equal(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length
    && timingSafeEqual(leftBytes, rightBytes);
}

export async function createAuthorizationRequest(
  config: AuthConfig = readAuthConfig(),
  input: AuthorizationInput = {}
) {
  const flow: OidcFlow = {
    state: input.state ?? randomValue(),
    nonce: input.nonce ?? randomValue(),
    codeVerifier: input.codeVerifier ?? randomValue()
  };
  const redirectUri = new URL("/auth/telegram/callback", config.appUrl);
  const url = new URL("https://oauth.telegram.org/auth");

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri.toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set(
    "code_challenge",
    createHash("sha256").update(flow.codeVerifier).digest("base64url")
  );
  url.searchParams.set("code_challenge_method", "S256");

  const flowToken = await new SignJWT({ ...flow })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(AUTH_ISSUER)
    .setAudience(FLOW_AUDIENCE)
    .setExpirationTime("10m")
    .sign(secret(config));

  return { url, flowToken };
}

export async function verifyFlowToken(
  token: string | undefined,
  config: AuthConfig = readAuthConfig()
): Promise<OidcFlow | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(config), {
      algorithms: ["HS256"],
      issuer: AUTH_ISSUER,
      audience: FLOW_AUDIENCE
    });
    const { state, nonce, codeVerifier } = payload;
    if (
      typeof state !== "string"
      || typeof nonce !== "string"
      || typeof codeVerifier !== "string"
      || !state
      || !nonce
      || !codeVerifier
    ) {
      return null;
    }
    return { state, nonce, codeVerifier };
  } catch {
    return null;
  }
}

export async function createSessionToken(
  identity: TelegramIdentity,
  config: AuthConfig = readAuthConfig()
) {
  return new SignJWT({
    telegramUserId: identity.telegramUserId,
    name: identity.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(AUTH_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setExpirationTime("12h")
    .sign(secret(config));
}

export async function verifySessionToken(
  token: string | undefined,
  config: AuthConfig = readAuthConfig()
): Promise<Session | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(config), {
      algorithms: ["HS256"],
      issuer: AUTH_ISSUER,
      audience: SESSION_AUDIENCE
    });
    const telegramUserId = payload.telegramUserId;
    const name = payload.name;
    if (
      typeof telegramUserId !== "string"
      || !/^[1-9]\d*$/.test(telegramUserId)
      || (name !== null && typeof name !== "string")
    ) {
      return null;
    }
    return { telegramUserId, name };
  } catch {
    return null;
  }
}

export async function exchangeTelegramCode(
  code: string,
  codeVerifier: string,
  config: AuthConfig = readAuthConfig(),
  fetchImpl: typeof fetch = fetch
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: new URL(
      "/auth/telegram/callback",
      config.appUrl
    ).toString(),
    client_id: config.clientId,
    code_verifier: codeVerifier
  });
  const response = await fetchImpl("https://oauth.telegram.org/token", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
    headers: {
      accept: "application/json",
      authorization:
        `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) throw new Error("Telegram token exchange failed");
  const result = await response.json() as Record<string, unknown>;
  if (typeof result.id_token !== "string" || !result.id_token) {
    throw new Error("Telegram did not return an ID token");
  }
  return result.id_token;
}

export async function verifyTelegramIdToken(
  idToken: string,
  expectedNonce: string,
  config: AuthConfig = readAuthConfig(),
  jwks: JWTVerifyGetKey = TELEGRAM_JWKS
): Promise<TelegramIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    algorithms: ["RS256"],
    issuer: TELEGRAM_ISSUER,
    audience: config.clientId,
    clockTolerance: 5,
    requiredClaims: ["sub", "iat", "exp", "nonce", "id"]
  });

  if (
    typeof payload.sub !== "string"
    || !payload.sub
    || typeof payload.nonce !== "string"
    || !equal(payload.nonce, expectedNonce)
  ) {
    throw new Error("Invalid Telegram identity");
  }

  const telegramUserId = String(payload.id ?? "");
  if (
    !/^[1-9]\d*$/.test(telegramUserId)
    || (
      typeof payload.id === "number"
      && !Number.isSafeInteger(payload.id)
    )
  ) {
    throw new Error("Invalid Telegram identity");
  }

  const name = typeof payload.name === "string"
    ? payload.name.trim().slice(0, 100) || null
    : null;
  return { telegramUserId, name };
}

export type LoginStatus =
  | "authorized"
  | "access_denied"
  | "telegram_login";

export async function authorizeTelegramUser(
  telegramUserId: string,
  config: AuthConfig = readAuthConfig(),
  fetchImpl: typeof fetch = fetch
): Promise<LoginStatus> {
  try {
    // ponytail: reuse overview as the access check; add a lightweight Core
    // endpoint only if login traffic makes the extra calculation measurable.
    const response = await fetchImpl(
      `${config.coreUrl}/api/veyra/dashboard/overview`,
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
        headers: {
          "content-type": "application/json",
          ...(config.coreApiKey
            ? { "x-core-api-key": config.coreApiKey }
            : {})
        },
        body: JSON.stringify({
          telegramUserId,
          timezone: "Asia/Jakarta"
        })
      }
    );

    if (response.ok) return "authorized";
    return response.status === 404 ? "access_denied" : "telegram_login";
  } catch {
    return "telegram_login";
  }
}

interface CallbackInput {
  code: string | null;
  state: string | null;
  flowToken: string | undefined;
  config?: AuthConfig;
  fetchImpl?: typeof fetch;
  jwks?: JWTVerifyGetKey;
}

export type LoginResult =
  | { status: "authorized"; identity: TelegramIdentity }
  | { status: "access_denied" | "telegram_login" };

export async function completeTelegramLogin({
  code,
  state,
  flowToken,
  config = readAuthConfig(),
  fetchImpl = fetch,
  jwks = TELEGRAM_JWKS
}: CallbackInput): Promise<LoginResult> {
  try {
    const flow = await verifyFlowToken(flowToken, config);
    if (!code || !state || !flow || !equal(state, flow.state)) {
      return { status: "telegram_login" };
    }

    const idToken = await exchangeTelegramCode(
      code,
      flow.codeVerifier,
      config,
      fetchImpl
    );
    const identity = await verifyTelegramIdToken(
      idToken,
      flow.nonce,
      config,
      jwks
    );
    const status = await authorizeTelegramUser(
      identity.telegramUserId,
      config,
      fetchImpl
    );

    return status === "authorized"
      ? { status, identity }
      : { status };
  } catch {
    return { status: "telegram_login" };
  }
}
