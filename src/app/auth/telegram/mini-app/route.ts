import {
  authorizeTelegramUser,
  createSessionToken,
  readAuthConfig,
  readTelegramBotToken,
  SESSION_COOKIE,
  verifyTelegramMiniAppInitData
} from "../../../../lib/auth.ts";
import { type NextRequest, NextResponse } from "next/server.js";

const MAX_INIT_DATA_BYTES = 16_384;

function result(
  status: "access_denied" | "telegram_login",
  httpStatus: number
) {
  return NextResponse.json(
    { status },
    { status: httpStatus, headers: { "cache-control": "no-store" } }
  );
}

async function readInitData(request: NextRequest) {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength
    && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_INIT_DATA_BYTES)
  ) {
    throw new Error("Invalid Telegram Mini App data");
  }
  if (!request.body) throw new Error("Invalid Telegram Mini App data");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_INIT_DATA_BYTES) {
      await reader.cancel();
      throw new Error("Invalid Telegram Mini App data");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function POST(request: NextRequest) {
  let config;
  let botToken;
  try {
    config = readAuthConfig();
    botToken = readTelegramBotToken();
  } catch {
    return result("telegram_login", 503);
  }

  if (request.headers.get("origin") !== config.appUrl) {
    return result("telegram_login", 401);
  }

  let identity;
  let initData;
  try {
    initData = await readInitData(request);
    identity = verifyTelegramMiniAppInitData(initData, botToken);
  } catch {
    return result("telegram_login", 401);
  }

  let status;
  try {
    status = await authorizeTelegramUser(identity.telegramUserId, config);
  } catch {
    return result("telegram_login", 503);
  }
  if (status !== "authorized") {
    return result(status, status === "access_denied" ? 403 : 503);
  }

  try {
    const sessionToken = await createSessionToken(identity, config);
    const response = NextResponse.json(
      {
        status,
        startParam: new URLSearchParams(initData).get("start_param")
      },
      { headers: { "cache-control": "no-store" } }
    );
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/"
    });
    return response;
  } catch {
    return result("telegram_login", 503);
  }
}
