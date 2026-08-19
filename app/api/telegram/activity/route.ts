import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";
import {
  ADMIN_ACTIVITY_COLLECTION,
  getAdminTelegramIds,
  type AdminActivityDocument
} from "../../../lib/admin-notifications";
import { sendTelegramMessage } from "../../../lib/telegram";

export const runtime = "nodejs";

type ActivityEvent = {
  type?: unknown;
  path?: unknown;
  label?: unknown;
  referrer?: unknown;
  visitorId?: unknown;
};

const eventTitles = {
  visit: "👋 Новый визит",
  click: "👆 Нажатие",
  bottom: "📜 Страница просмотрена до конца"
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

export async function POST(request: Request) {
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
  if (type !== "visit" && type !== "click" && type !== "bottom") {
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  }

  const path = cleanText(body?.path, 300);
  const label = cleanText(body?.label, 120);
  const referrer = cleanText(body?.referrer, 300);
  const visitorId = cleanText(body?.visitorId, 80);
  if (!path || !visitorId) {
    return NextResponse.json({ error: "path and visitorId are required" }, { status: 400 });
  }

  const message = [
    eventTitles[type],
    `Страница: ${path}`,
    type === "click" ? `Действие: ${label ?? "Без названия"}` : undefined,
    type === "visit" && referrer ? `Источник: ${referrer}` : undefined,
    `Посетитель: ${visitorId.slice(0, 8)}`,
    `IP: ${clientIp}`
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
