import { ObjectId, type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../lib/mongodb";
import { getTelegramBotToken, verifyTelegramInitData, type TelegramUser } from "../../lib/telegram";

type UserDocument = Document & {
  _id?: ObjectId;
  telegramId?: number | string;
  username?: string;
  firstName?: string;
  dailyCalorieGoal?: number;
};

type FoodEntryDocument = Document & {
  _id?: ObjectId;
  userId?: ObjectId;
  telegramId?: number | string;
  foodDescription?: string;
  calories?: number | string;
  protein?: number | string;
  carbs?: number | string;
  fat?: number | string;
  createdAt?: Date | string;
};

type DayStats = {
  key: string;
  label: string;
  calories: number;
  status: "under" | "in-range" | "over";
};

type StatsResponse = {
  calorieTarget: number;
  calorieDays: DayStats[];
  averageCards: Array<{
    label: string;
    value: number;
    delta: string;
  }>;
  rangeCards: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  weekComparison: Array<{
    label: string;
    current: string;
    previous: string;
    trend: string;
  }>;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const FOOD_ENTRIES_COLLECTION = process.env.MONGODB_FOOD_ENTRIES_COLLECTION ?? "foodentries";
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";
const DAY_MS = 24 * 60 * 60 * 1000;

function readNumber(source: unknown, paths: string[], fallback = 0) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }

      return undefined;
    }, source);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function readDate(source: unknown) {
  const raw =
    source && typeof source === "object" && "createdAt" in source
      ? (source as { createdAt?: unknown }).createdAt
      : source;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }

  if (typeof raw === "number" || typeof raw === "string") {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
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

function getLocalDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getDayStartFromKey(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const localMidnightAsUtc = new Date(Date.UTC(year, month - 1, day));

  return new Date(localMidnightAsUtc.getTime() - getTimeZoneOffset(localMidnightAsUtc, timeZone));
}

function getTodayStart(timeZone: string) {
  return getDayStartFromKey(getLocalDateKey(new Date(), timeZone), timeZone);
}

function getUserFilter(telegramUser: TelegramUser): Filter<UserDocument> {
  const id = telegramUser.id;
  const idString = String(id);

  return {
    $or: [
      { telegramId: id },
      { telegramId: idString },
      { telegramUserId: id },
      { telegramUserId: idString },
      { telegram_id: id },
      { telegram_id: idString },
      { "telegram.id": id },
      { "telegram.id": idString },
      { "telegram.user.id": id },
      { "telegram.user.id": idString }
    ]
  };
}

function getMealUserConditions(user: UserDocument, telegramUser: TelegramUser): Filter<Document>[] {
  const telegramId = telegramUser.id;
  const telegramIdString = String(telegramId);
  const objectId = user._id;
  const objectIdString = objectId?.toString();

  return [
    { telegramId },
    { telegramId: telegramIdString },
    { telegramUserId: telegramId },
    { telegramUserId: telegramIdString },
    { telegram_id: telegramId },
    { telegram_id: telegramIdString },
    { "telegram.id": telegramId },
    { "telegram.id": telegramIdString },
    ...(objectId ? [{ userId: objectId }, { user_id: objectId }, { ownerId: objectId }, { owner_id: objectId }] : []),
    ...(objectIdString
      ? [
          { userId: objectIdString },
          { user_id: objectIdString },
          { ownerId: objectIdString },
          { owner_id: objectIdString }
        ]
      : [])
  ];
}

function getCalorieTarget(user: UserDocument) {
  return Math.round(
    readNumber(
      user,
      [
        "dailyCalorieGoal",
        "calorieTarget",
        "dailyCalorieTarget",
        "dailyCalories",
        "nutritionGoals.calories",
        "goals.calories"
      ],
      2200
    )
  );
}

function getStatus(calories: number, target: number): DayStats["status"] {
  if (calories > target * 1.1) {
    return "over";
  }

  if (calories < target * 0.9) {
    return "under";
  }

  return "in-range";
}

function getAverage(days: DayStats[], count: number) {
  const selected = days.slice(-count);
  const total = selected.reduce((sum, day) => sum + day.calories, 0);

  return Math.round(total / count);
}

function formatDelta(value: number, target: number) {
  if (target <= 0) {
    return "0% vs target";
  }

  const percent = ((value - target) / target) * 100;
  const rounded = Math.round(percent * 10) / 10;

  if (rounded === 0) {
    return "On target";
  }

  return `${rounded > 0 ? "+" : ""}${rounded}% vs target`;
}

function plural(value: number, singular: string, pluralWord = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralWord}`;
}

function getBestStreak(days: DayStats[]) {
  return days.reduce(
    (state, day) => {
      const current = day.status === "in-range" ? state.current + 1 : 0;
      return {
        current,
        best: Math.max(state.best, current)
      };
    },
    { current: 0, best: 0 }
  ).best;
}

function formatTrend(current: number, previous: number, unit: string) {
  const diff = current - previous;
  if (diff === 0) {
    return `0 ${unit}`;
  }

  return `${diff > 0 ? "+" : ""}${diff} ${unit}`;
}

function formatDayTrend(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) {
    return "0 days";
  }

  const unit = Math.abs(diff) === 1 ? "day" : "days";
  return `${diff > 0 ? "+" : ""}${diff} ${unit}`;
}

function buildResponse(entries: FoodEntryDocument[], calorieTarget: number): StatsResponse {
  const todayStart = getTodayStart(TIME_ZONE);
  const firstDayStart = new Date(todayStart.getTime() - 29 * DAY_MS);
  const caloriesByDay = new Map<string, number>();

  for (const entry of entries) {
    const date = readDate(entry);
    if (!date) {
      continue;
    }

    const key = getLocalDateKey(date, TIME_ZONE);
    const calories = readNumber(entry, ["calories", "kcal", "nutrition.calories", "macros.calories", "totalCalories"]);
    caloriesByDay.set(key, (caloriesByDay.get(key) ?? 0) + calories);
  }

  const allDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(firstDayStart.getTime() + index * DAY_MS);
    const key = getLocalDateKey(date, TIME_ZONE);
    const calories = Math.round(caloriesByDay.get(key) ?? 0);

    return {
      key,
      label: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(date),
      calories,
      status: getStatus(calories, calorieTarget)
    };
  });

  const last7 = allDays.slice(-7);
  const previous7 = allDays.slice(-14, -7);
  const average7 = getAverage(allDays, 7);
  const previousAverage7 = getAverage(allDays.slice(0, -7), 7);
  const hits7 = last7.filter((day) => day.status === "in-range").length;
  const previousHits7 = previous7.filter((day) => day.status === "in-range").length;
  const over7 = last7.filter((day) => day.status === "over").length;
  const previousOver7 = previous7.filter((day) => day.status === "over").length;
  const under7 = last7.filter((day) => day.status === "under").length;

  return {
    calorieTarget,
    calorieDays: last7,
    averageCards: [
      { label: "7 days", value: average7, delta: formatDelta(average7, calorieTarget) },
      { label: "14 days", value: getAverage(allDays, 14), delta: formatDelta(getAverage(allDays, 14), calorieTarget) },
      { label: "30 days", value: getAverage(allDays, 30), delta: formatDelta(getAverage(allDays, 30), calorieTarget) }
    ],
    rangeCards: [
      { label: "In target", value: `${hits7} / 7`, detail: "days within the goal range" },
      { label: "Over", value: String(over7), detail: plural(over7, "day") + " above target" },
      { label: "Under", value: String(under7), detail: plural(under7, "day") + " below target" },
      { label: "Best streak", value: String(getBestStreak(last7)), detail: "days in a row" }
    ],
    weekComparison: [
      {
        label: "Average calories",
        current: String(average7),
        previous: String(previousAverage7),
        trend: formatTrend(average7, previousAverage7, "kcal")
      },
      {
        label: "Target hits",
        current: plural(hits7, "day"),
        previous: plural(previousHits7, "day"),
        trend: formatDayTrend(hits7, previousHits7)
      },
      {
        label: "Over target",
        current: plural(over7, "day"),
        previous: plural(previousOver7, "day"),
        trend: formatDayTrend(over7, previousOver7)
      }
    ]
  };
}

export async function POST(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => undefined)) as { initData?: unknown } | undefined;
  if (typeof body?.initData !== "string" || !body.initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  let telegramUser: TelegramUser | undefined;
  try {
    telegramUser = verifyTelegramInitData(body.initData, botToken);
  } catch {
    return NextResponse.json({ error: "Invalid Telegram user payload" }, { status: 401 });
  }

  if (!telegramUser?.id) {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  const db = await getMongoDb();
  const registeredUser = await db.collection<UserDocument>(USERS_COLLECTION).findOne(getUserFilter(telegramUser));

  if (!registeredUser) {
    return NextResponse.json({ error: "User is not registered" }, { status: 404 });
  }

  const todayStart = getTodayStart(TIME_ZONE);
  const start = new Date(todayStart.getTime() - 29 * DAY_MS);
  const end = new Date(todayStart.getTime() + DAY_MS);
  const foodEntries = (await db
    .collection<Document>(FOOD_ENTRIES_COLLECTION)
    .find({
      $and: [
        { $or: getMealUserConditions(registeredUser, telegramUser) },
        {
          $or: [
            { createdAt: { $gte: start, $lt: end } },
            { createdAt: { $gte: start.toISOString(), $lt: end.toISOString() } }
          ]
        }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(1000)
    .toArray()) as FoodEntryDocument[];

  return NextResponse.json(buildResponse(foodEntries, getCalorieTarget(registeredUser)));
}
