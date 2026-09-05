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
  "section_view",
  "bot_started",
  "quiz_completed"
];
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";

type StatsRequest = {
  view?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  type?: unknown;
  query?: unknown;
  activitySource?: unknown;
};

type DeleteItem = {
  id?: unknown;
  source?: unknown;
};

type DeleteRequest = DeleteItem & {
  items?: unknown;
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
    hourCycle: "h23"
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

function dateStart(value: string) {
  const midnight = new Date(`${value}T00:00:00.000Z`);
  let result = midnight;
  for (let i = 0; i < 3; i += 1) {
    result = new Date(midnight.getTime() - getTimeZoneOffset(result, TIME_ZONE));
  }
  return result;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as StatsRequest | undefined;
  const page = Math.max(1, Math.min(10_000, Number(body?.page) || 1));
  const type = typeof body?.type === "string" && EVENT_TYPES.includes(body.type as AdminEventType)
    ? (body.type as AdminEventType)
    : undefined;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 100) : "";
  const activitySource =
    body?.activitySource === "browser" ||
    body?.activitySource === "telegram_webapp" ||
    body?.activitySource === "telegram_bot"
      ? body.activitySource
      : undefined;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const dateFrom = body?.dateFrom ?? todayKey;
  const dateTo = body?.dateTo ?? todayKey;
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo ||
      (Date.parse(dateTo) - Date.parse(dateFrom)) / 86400000 > 365) {
    return NextResponse.json({ error: "Оберіть коректний період до 366 днів." }, { status: 400 });
  }
  const filter: Document = {
    createdAt: { $gte: dateStart(dateFrom), $lt: dateStart(nextDate(dateTo)) }
  };

  if (type) {
    filter.type = type;
  }

  if (activitySource) {
    filter.activitySource = activitySource;
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
      { firstName: pattern },
      { lastName: pattern },
      { activitySource: pattern },
      ...(Number.isSafeInteger(Number(query)) ? [{ telegramUserId: Number(query) }] : [])
    ];
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection(ADMIN_ACTIVITY_COLLECTION);
    const now = new Date();
    const today = dateStart(todayKey);
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
          activitySource: { $ifNull: ["$source", "browser"] },
          telegramUserId: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
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
                    { $ifNull: ["$firstName", "Користувач Telegram"] }
                  ]
                },
                visitorId: { $toString: "$telegramId" },
                ip: { $literal: "—" },
                createdAt: 1,
                telegramUserId: "$telegramId",
                username: 1,
                firstName: 1,
                lastName: 1,
                metadata: 1,
                activitySource: { $literal: "telegram_bot" },
                source: { $literal: "bot" }
              }
            }
          ]
        }
      }
    ];
    const aggregate = <T extends Document>(pipeline: Document[]) =>
      collection.aggregate<T>([...allEventsPipeline, { $match: filter }, ...pipeline]).toArray();

    if (body?.view === "chart") {
      const counts = await aggregate<{ _id: string; count: number }>([
        { $group: {
          _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: TIME_ZONE } },
          count: { $sum: 1 }
        } }
      ]);
      const byDate = new Map(counts.map((day) => [day._id, day.count]));
      const days = [];
      for (let date = dateFrom; date <= dateTo; date = nextDate(date)) {
        days.push({ date, count: byDate.get(date) ?? 0 });
      }
      return NextResponse.json({ days, timeZone: TIME_ZONE });
    }

    const [events, filteredTotal, total, todayTotal, lastSevenDays, uniqueVisitors, byType, dailyCounts] =
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
        ]),
        aggregate<{ _id: string; count: number }>([
          { $group: {
            _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: TIME_ZONE } },
            count: { $sum: 1 }
          } },
          { $sort: { _id: 1 } }
        ])
      ]);

    const readCount = (result: Document[]) => result[0]?.count ?? 0;
    const filteredCount = readCount(filteredTotal);

    const counts = new Map(dailyCounts.map((day) => [day._id, day.count]));
    const days = [];
    for (let date = dateFrom; date <= dateTo; date = nextDate(date)) {
      days.push({ date, count: counts.get(date) ?? 0 });
    }

    return NextResponse.json({
      days,
      timeZone: TIME_ZONE,
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
        deliveryStatus: event.deliveryStatus,
        activitySource: event.activitySource,
        telegramUserId: event.telegramUserId,
        username: event.username,
        firstName: event.firstName,
        lastName: event.lastName
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
  const rawItems: DeleteItem[] = Array.isArray(body?.items)
    ? (body.items as DeleteItem[])
    : [{ id: body?.id, source: body?.source }];

  if (rawItems.length === 0 || rawItems.length > 200) {
    return NextResponse.json({ error: "Select between 1 and 200 events" }, { status: 400 });
  }

  const items = rawItems.map((item) => ({
    id: typeof item.id === "string" && ObjectId.isValid(item.id) ? new ObjectId(item.id) : undefined,
    source: item.source
  }));

  if (items.some((item) => !item.id || (item.source !== "web" && item.source !== "bot"))) {
    return NextResponse.json({ error: "Invalid event selection" }, { status: 400 });
  }

  try {
    const db = await getMongoDb();
    const webIds = items.filter((item) => item.source === "web").map((item) => item.id!);
    const botIds = items.filter((item) => item.source === "bot").map((item) => item.id!);
    const results = await Promise.all([
      webIds.length
        ? db.collection(ADMIN_ACTIVITY_COLLECTION).deleteMany({ _id: { $in: webIds } })
        : undefined,
      botIds.length
        ? db.collection(BOT_EVENTS_COLLECTION).deleteMany({ _id: { $in: botIds } })
        : undefined
    ]);
    const deleted = results.reduce((total, result) => total + (result?.deletedCount ?? 0), 0);

    if (deleted === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("Could not delete admin activity", error);
    return NextResponse.json({ error: "Could not delete activity event" }, { status: 500 });
  }
}
