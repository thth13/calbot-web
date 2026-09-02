import { NextResponse } from "next/server";
import { getAdminTelegramIds } from "../../lib/admin-notifications";
import {
  getTelegramBotToken,
  sendTelegramMessage,
  verifyTelegramInitData,
  type TelegramUser
} from "../../lib/telegram";

export const runtime = "nodejs";

type SupportRequest = {
  initData?: unknown;
  message?: unknown;
  path?: unknown;
};

const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_MESSAGE_LENGTH = 1500;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  return (
    value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, maxLength) || undefined
  );
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function hasInvalidOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return false;

  try {
    return new URL(requestOrigin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

function isRateLimited(key: string) {
  const now = Date.now();
  if (requestLog.size > 10_000) requestLog.clear();

  const recentRequests = (requestLog.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (recentRequests.length >= RATE_LIMIT) {
    requestLog.set(key, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestLog.set(key, recentRequests);
  return false;
}

function getUserTitle(user: TelegramUser) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const username = user.username ? `@${user.username}` : "";
  return [name, username].filter(Boolean).join(" · ") || `ID ${user.id}`;
}

export async function POST(request: Request) {
  if (hasInvalidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const notificationBotToken = process.env.ADMIN_NOTIFICATION_BOT_TOKEN;
  const adminTelegramIds = getAdminTelegramIds();
  const appBotToken = getTelegramBotToken();
  if (!notificationBotToken || adminTelegramIds.length === 0 || !appBotToken) {
    return NextResponse.json({ error: "Support is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => undefined)) as SupportRequest | undefined;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  const message = cleanText(body?.message, MAX_MESSAGE_LENGTH);
  const path = cleanText(body?.path, 200) ?? "/";
  if (!initData || !message) {
    return NextResponse.json({ error: "initData and message are required" }, { status: 400 });
  }

  let user: TelegramUser | undefined;
  try {
    user = verifyTelegramInitData(initData, appBotToken);
  } catch {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  if (!user?.id) {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  if (isRateLimited(`${user.id}:${clientIp}`)) {
    return NextResponse.json({ error: "Too many support requests" }, { status: 429 });
  }

  const notification = [
    "💬 Нове повідомлення в підтримку",
    `👤 Користувач: ${getUserTitle(user)}`,
    `🆔 Telegram ID: ${user.id}`,
    `📄 Сторінка: ${path}`,
    "",
    message
  ].join("\n");

  const results = await Promise.allSettled(
    adminTelegramIds.map((chatId) =>
      sendTelegramMessage(notificationBotToken, chatId, notification)
    )
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;

  if (delivered === 0) {
    return NextResponse.json({ error: "Could not send support message" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivered });
}
