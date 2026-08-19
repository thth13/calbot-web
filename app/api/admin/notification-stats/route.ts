import { ObjectId, type Document } from "mongodb";
import { NextResponse } from "next/server";
import {
  ADMIN_ACTIVITY_COLLECTION,
  BOT_EVENTS_COLLECTION,
  type AdminEventType
} from "../../../lib/admin-notifications";
import { getMongoDb } from "../../../lib/mongodb";

export const runtime = "nodejs";

const PAGE_SIZE = 50;
const EVENT_TYPES: AdminEventType[] = [
  "visit",
  "click",
  "bottom",
  "bot_started",
  "quiz_completed"
];
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";

type StatsRequest = {
  page?: unknown;
  type?: unknown;
  query?: unknown;
};

type DeleteRequest = {
  id?: unknown;
  source?: unknown;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function getTodayStart() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localMidnight = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day)
  ));

  return new Date(localMidnight.getTime() - getTimeZoneOffset(localMidnight, TIME_ZONE));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as StatsRequest | undefined;
  const page = Math.max(1, Math.min(10_000, Number(body?.page) || 1));
  const type = typeof body?.type === "string" && EVENT_TYPES.includes(body.type as AdminEventType)
    ? (body.type as AdminEventType)
    : undefined;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 100) : "";
  const filter: Document = {};

  if (type) {
    filter.type = type;
  }

  if (query) {
    const pattern = new RegExp(escapeRegExp(query), "i");
    filter.$or = [
      { path: pattern },
      { label: pattern },
      { referrer: pattern },
      { visitorId: pattern },
      { ip: pattern },
      { username: pattern },
      { firstName: pattern }
    ];
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection(ADMIN_ACTIVITY_COLLECTION);
    const now = new Date();
    const today = getTodayStart();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const allEventsPipeline: Document[] = [
      {
        $project: {
          type: 1,
          path: 1,
          label: 1,
          referrer: 1,
          visitorId: 1,
          ip: 1,
          createdAt: 1,
          delivered: 1,
          deliveryStatus: 1,
          source: { $literal: "web" }
        }
      },
      {
        $unionWith: {
          coll: BOT_EVENTS_COLLECTION,
          pipeline: [
            { $match: { type: { $in: ["bot_started", "quiz_completed"] } } },
            {
              $project: {
                type: 1,
                path: { $literal: "Telegram-бот" },
                label: {
                  $ifNull: [
                    { $concat: ["@", "$username"] },
                    { $ifNull: ["$firstName", "Пользователь Telegram"] }
                  ]
                },
                visitorId: { $toString: "$telegramId" },
                ip: { $literal: "—" },
                createdAt: 1,
                username: 1,
                firstName: 1,
                metadata: 1,
                source: { $literal: "bot" }
              }
            }
          ]
        }
      }
    ];
    const aggregate = <T extends Document>(pipeline: Document[]) =>
      collection.aggregate<T>([...allEventsPipeline, ...pipeline]).toArray();

    const [events, filteredTotal, total, todayTotal, lastSevenDays, uniqueVisitors, byType] =
      await Promise.all([
        aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE }
        ]),
        aggregate<{ count: number }>([{ $match: filter }, { $count: "count" }]),
        aggregate<{ count: number }>([{ $count: "count" }]),
        aggregate<{ count: number }>([
          { $match: { createdAt: { $gte: today } } },
          { $count: "count" }
        ]),
        aggregate<{ count: number }>([
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          { $count: "count" }
        ]),
        aggregate([
          { $match: { visitorId: { $nin: [null, ""] } } },
          { $group: { _id: "$visitorId" } },
          { $count: "count" }
        ]),
        aggregate<{ _id: AdminEventType; count: number }>([
          { $group: { _id: "$type", count: { $sum: 1 } } }
        ])
      ]);

    const readCount = (result: Document[]) => result[0]?.count ?? 0;
    const filteredCount = readCount(filteredTotal);

    return NextResponse.json({
      summary: {
        total: readCount(total),
        today: readCount(todayTotal),
        lastSevenDays: readCount(lastSevenDays),
        uniqueVisitors: readCount(uniqueVisitors),
        byType: Object.fromEntries(byType.map((item) => [item._id, item.count]))
      },
      events: events.map((event) => ({
        id: event._id?.toString(),
        source: event.source,
        type: event.type,
        path: event.path,
        label: event.label,
        referrer: event.referrer,
        visitorId: event.visitorId,
        ip: event.ip,
        createdAt: event.createdAt,
        delivered: event.delivered,
        deliveryStatus: event.deliveryStatus
      })),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total: filteredCount,
        pages: Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
      }
    });
  } catch (error) {
    console.error("Could not load admin notification stats", error);
    return NextResponse.json({ error: "Could not load activity statistics" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => undefined)) as DeleteRequest | undefined;
  if (typeof body?.id !== "string" || !ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  if (body.source !== "web" && body.source !== "bot") {
    return NextResponse.json({ error: "Invalid event source" }, { status: 400 });
  }

  try {
    const db = await getMongoDb();
    const collectionName = body.source === "bot" ? BOT_EVENTS_COLLECTION : ADMIN_ACTIVITY_COLLECTION;
    const result = await db.collection(collectionName).deleteOne({ _id: new ObjectId(body.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not delete admin activity", error);
    return NextResponse.json({ error: "Could not delete activity event" }, { status: 500 });
  }
}
