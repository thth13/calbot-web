import { ObjectId, type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../lib/mongodb";
import { getTelegramBotToken, verifyTelegramInitData, type TelegramUser } from "../../lib/telegram";

type UserDocument = Document & {
  _id?: ObjectId;
  telegramId?: number | string;
};

type FoodEntryDocument = Document & {
  _id?: ObjectId;
  userId?: ObjectId | string;
  telegramId?: number | string;
  foodDescription?: string;
  calories?: number | string;
  protein?: number | string;
  carbs?: number | string;
  fat?: number | string;
  confidence?: "low" | "medium" | "high";
  createdAt?: Date | string;
};

type HistoryResponse = {
  todayTotal: string;
  days: Array<{
    id: string;
    title: string;
    date: string;
    total: string;
    items: Array<{
      id: string;
      time: string;
      name: string;
      kcal: number;
      protein: number;
      fat: number;
      carbs: number;
      confidence: "low" | "medium" | "high";
    }>;
  }>;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const FOOD_ENTRIES_COLLECTION = process.env.MONGODB_FOOD_ENTRIES_COLLECTION ?? "foodentries";
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";
const DIARY_LIMIT = Number(process.env.DIARY_LIMIT ?? 500);

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

function readString(source: unknown, paths: string[], fallback = "") {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }

      return undefined;
    }, source);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
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

function getLocalDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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

function formatDateTitle(dateKey: string, todayKey: string, yesterdayKey: string) {
  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === yesterdayKey) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long"
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric"
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function getNutrition(entry: FoodEntryDocument) {
  return {
    kcal: Math.round(readNumber(entry, ["calories", "kcal", "nutrition.calories", "macros.calories", "totalCalories"])),
    protein: Math.round(readNumber(entry, ["protein", "proteins", "nutrition.protein", "macros.protein"])),
    fat: Math.round(readNumber(entry, ["fat", "fats", "nutrition.fat", "macros.fat"])),
    carbs: Math.round(readNumber(entry, ["carbs", "carbohydrates", "nutrition.carbs", "macros.carbs"]))
  };
}

function buildResponse(entries: FoodEntryDocument[]): HistoryResponse {
  const todayKey = getLocalDateKey(new Date());
  const yesterdayKey = getLocalDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const grouped = new Map<string, HistoryResponse["days"][number]>();

  for (const entry of entries) {
    const createdAt = readDate(entry);
    if (!createdAt) {
      continue;
    }

    const dateKey = getLocalDateKey(createdAt);
    const nutrition = getNutrition(entry);
    const existing = grouped.get(dateKey);
    const day =
      existing ??
      {
        id: dateKey,
        title: formatDateTitle(dateKey, todayKey, yesterdayKey),
        date: formatDateLabel(dateKey),
        total: "0 kcal",
        items: []
      };

    day.items.push({
      id: entry._id?.toString() ?? `${dateKey}-${day.items.length}`,
      time: formatTime(createdAt),
      name: readString(entry, ["foodDescription", "name", "title", "foodName", "description", "text"], "Untitled food"),
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      confidence: entry.confidence ?? "medium"
    });

    grouped.set(dateKey, day);
  }

  const days = Array.from(grouped.values()).map((day) => {
    const total = day.items.reduce((sum, item) => sum + item.kcal, 0);

    return {
      ...day,
      total: `${total.toLocaleString("en-US")} kcal`,
      items: day.items.sort((a, b) => b.time.localeCompare(a.time))
    };
  });

  days.sort((a, b) => b.id.localeCompare(a.id));

  return {
    todayTotal: days.find((day) => day.id === todayKey)?.total ?? "0 kcal",
    days
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

  const foodEntries = (await db
    .collection<Document>(FOOD_ENTRIES_COLLECTION)
    .find({ $or: getMealUserConditions(registeredUser, telegramUser) })
    .sort({ createdAt: -1 })
    .limit(Number.isFinite(DIARY_LIMIT) && DIARY_LIMIT > 0 ? DIARY_LIMIT : 500)
    .toArray()) as FoodEntryDocument[];

  return NextResponse.json(buildResponse(foodEntries));
}
