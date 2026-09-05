import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";
import {
  ADMIN_ACTIVITY_COLLECTION,
  getAdminTelegramIds,
  type AdminActivityDocument,
  type AdminActivitySource
} from "../../../lib/admin-notifications";
import {
  getTelegramBotToken,
  sendTelegramMessage,
  verifyTelegramInitData,
  type TelegramUser
} from "../../../lib/telegram";

export const runtime = "nodejs";

type ActivityEvent = {
  type?: unknown;
  path?: unknown;
  label?: unknown;
  referrer?: unknown;
  visitorId?: unknown;
  initData?: unknown;
  target?: unknown;
};

const eventTitles = {
  visit: "👋 New visit",
  click: "🤖 Telegram bot button clicked",
  section_view: "📜 Доскролили до «Бачте свій день цілком»"
} as const;

const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) || undefined;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(clientIp: string) {
  const now = Date.now();
  if (requestLog.size > 10_000) {
    requestLog.clear();
  }

  const recentRequests = (requestLog.get(clientIp) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );

  if (recentRequests.length >= RATE_LIMIT) {
    requestLog.set(clientIp, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestLog.set(clientIp, recentRequests);
  return false;
}

function hasInvalidOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return false;
  }

  try {
    return new URL(requestOrigin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

function isLocalRequest(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const hostname = new URL(request.url).hostname;
  return (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^10(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^192\.168(?:\.\d{1,3}){2}$/.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(hostname)
  );
}

function getTelegramUser(initData: unknown) {
  if (typeof initData !== "string" || !initData) {
    return undefined;
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return undefined;
  }

  return verifyTelegramInitData(initData, botToken);
}

function getTelegramUserTitle(user: TelegramUser) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const username = user.username ? `@${user.username}` : "";
  return [name, username].filter(Boolean).join(" · ") || `ID ${user.id}`;
}

export async function POST(request: Request) {
  if (isLocalRequest(request)) {
    return NextResponse.json({ ok: true, skipped: "local_environment" });
  }

  if (hasInvalidOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const botToken = process.env.ADMIN_NOTIFICATION_BOT_TOKEN;
  const adminTelegramIds = getAdminTelegramIds();
  if (!botToken || adminTelegramIds.length === 0) {
    return NextResponse.json(
      { error: "Telegram activity notifications are not configured" },
      { status: 503 }
    );
  }

  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many events" }, { status: 429 });
  }

  const body = (await request.json().catch(() => undefined)) as ActivityEvent | undefined;
  const type = body?.type;
  if (type !== "visit" && type !== "click" && type !== "section_view") {
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  }

  if (type === "click" && body?.target !== "open_bot") {
    return NextResponse.json({ error: "Unknown click target" }, { status: 400 });
  }

  if (
    type === "section_view" &&
    body?.target !== "daily_progress" &&
    body?.target !== "page_bottom"
  ) {
    return NextResponse.json({ error: "Unknown section target" }, { status: 400 });
  }

  const path = cleanText(body?.path, 300);
  const label = cleanText(body?.label, 120);
  const referrer = cleanText(body?.referrer, 300);
  const visitorId = cleanText(body?.visitorId, 80);
  if (!path || !visitorId) {
    return NextResponse.json({ error: "path and visitorId are required" }, { status: 400 });
  }

  if ((type === "visit" || type === "section_view") && path !== "/" && !path.startsWith("/?")) {
    return NextResponse.json({ error: "Only homepage visits are tracked" }, { status: 400 });
  }

  let telegramUser: TelegramUser | undefined;
  try {
    telegramUser = getTelegramUser(body?.initData);
  } catch {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  if (typeof body?.initData === "string" && body.initData && !telegramUser) {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  const source: AdminActivitySource = telegramUser ? "telegram_webapp" : "browser";

  const message = [
    type === "section_view" && body?.target === "page_bottom"
      ? "📜 Доскролили до низу сторінки"
      : eventTitles[type],
    `📄 Page: ${path}`,
    type === "click" ? `🎯 Action: ${label ?? "Unnamed action"}` : undefined,
    type === "visit" && referrer ? `↗️ Referrer: ${referrer}` : undefined,
    `📍 Source: ${source === "telegram_webapp" ? "Telegram" : "Browser"}`,
    telegramUser
      ? `👤 User: ${getTelegramUserTitle(telegramUser)} (ID ${telegramUser.id})`
      : `👤 Visitor: ${visitorId.slice(0, 8)}`,
    `🌐 IP: ${clientIp}`
  ]
    .filter(Boolean)
    .join("\n");

  let activityId;
  try {
    const db = await getMongoDb();
    const result = await db.collection<AdminActivityDocument>(ADMIN_ACTIVITY_COLLECTION).insertOne({
      type,
      path,
      ...(label ? { label } : {}),
      ...(referrer ? { referrer } : {}),
      visitorId,
      source,
      ...(telegramUser?.id ? { telegramUserId: telegramUser.id } : {}),
      ...(telegramUser?.username ? { username: telegramUser.username } : {}),
      ...(telegramUser?.first_name ? { firstName: telegramUser.first_name } : {}),
      ...(telegramUser?.last_name ? { lastName: telegramUser.last_name } : {}),
      ip: clientIp,
      createdAt: new Date(),
      delivered: 0,
      deliveryStatus: "pending"
    });
    activityId = result.insertedId;
  } catch (error) {
    console.error("Could not save admin activity", error);
  }

  const results = await Promise.allSettled(
    adminTelegramIds.map((chatId) => sendTelegramMessage(botToken, chatId, message))
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;

  if (activityId) {
    try {
      const db = await getMongoDb();
      await db.collection<AdminActivityDocument>(ADMIN_ACTIVITY_COLLECTION).updateOne(
        { _id: activityId },
        {
          $set: {
            delivered,
            deliveryStatus: delivered > 0 ? "sent" : "failed"
          }
        }
      );
    } catch (error) {
      console.error("Could not update admin activity delivery status", error);
    }
  }

  if (delivered === 0) {
    return NextResponse.json(
      { error: "Could not send Telegram activity notification" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, delivered });
}
