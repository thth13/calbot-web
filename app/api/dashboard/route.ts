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
  telegramId?: number;
  foodDescription?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  createdAt?: Date;
};

type DashboardResponse = {
  user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  day: {
    calories: number;
    calorieTarget: number;
    meals: number;
    lastFood: string;
    lastFoodTime: string;
  };
  macros: Array<{
    id: "protein" | "fat" | "carbs";
    current: number;
    target: number;
  }>;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const FOOD_ENTRIES_COLLECTION = process.env.MONGODB_FOOD_ENTRIES_COLLECTION ?? "foodentries";
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";

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
    (source && typeof source === "object"
      ? readValue(source, ["createdAt", "created_at", "date", "day", "timestamp", "addedAt"])
      : undefined) ?? source;

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

function readValue(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }

      return undefined;
    }, source);

    if (value !== undefined && value !== null) {
      return value;
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

function getTodayRange(timeZone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localMidnightAsUtc = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))
  );
  const start = new Date(
    localMidnightAsUtc.getTime() - getTimeZoneOffset(localMidnightAsUtc, timeZone)
  );

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000)
  };
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
    ...(objectId
      ? [
          { userId: objectId },
          { user_id: objectId },
          { ownerId: objectId },
          { owner_id: objectId }
        ]
      : []),
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

function getDateConditions(start: Date, end: Date): Filter<Document>[] {
  return [
    { createdAt: { $gte: start, $lt: end } },
    { created_at: { $gte: start, $lt: end } },
    { date: { $gte: start, $lt: end } },
    { timestamp: { $gte: start, $lt: end } },
    { addedAt: { $gte: start, $lt: end } },
    { createdAt: { $gte: start.toISOString(), $lt: end.toISOString() } },
    { created_at: { $gte: start.toISOString(), $lt: end.toISOString() } },
    { date: { $gte: start.toISOString(), $lt: end.toISOString() } },
    { timestamp: { $gte: start.toISOString(), $lt: end.toISOString() } },
    { addedAt: { $gte: start.toISOString(), $lt: end.toISOString() } }
  ];
}

function getTargets(user: UserDocument) {
  const calories = readNumber(
    user,
    ["dailyCalorieGoal", "calorieTarget", "dailyCalorieTarget", "dailyCalories", "nutritionGoals.calories", "goals.calories"],
    2200
  );

  return {
    calories,
    protein: readNumber(user, ["proteinTarget", "nutritionGoals.protein", "goals.protein"], Math.round((calories * 0.25) / 4)),
    fat: readNumber(user, ["fatTarget", "nutritionGoals.fat", "goals.fat"], Math.round((calories * 0.3) / 9)),
    carbs: readNumber(user, ["carbsTarget", "carbTarget", "nutritionGoals.carbs", "goals.carbs"], Math.round((calories * 0.45) / 4))
  };
}

function getMealNutrition(meal: FoodEntryDocument) {
  return {
    calories: readNumber(meal, ["calories", "kcal", "nutrition.calories", "macros.calories", "totalCalories"]),
    protein: readNumber(meal, ["protein", "proteins", "nutrition.protein", "macros.protein"]),
    fat: readNumber(meal, ["fat", "fats", "nutrition.fat", "macros.fat"]),
    carbs: readNumber(meal, ["carbs", "carbohydrates", "nutrition.carbs", "macros.carbs"])
  };
}

function getMealTitle(meal?: FoodEntryDocument) {
  if (!meal) {
    return "No food added yet";
  }

  return readString(
    meal,
    ["foodDescription", "name", "title", "foodName", "description", "text", "meal", "items.0.name", "foods.0.name"],
    "Untitled food"
  );
}

function formatMealTime(meal?: FoodEntryDocument) {
  const date = meal ? readDate(meal) : undefined;
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

  const { start, end } = getTodayRange(TIME_ZONE);
  const foodEntries = await db
    .collection<Document>(FOOD_ENTRIES_COLLECTION)
    .find({
      $and: [
        { $or: getMealUserConditions(registeredUser, telegramUser) },
        { $or: getDateConditions(start, end) }
      ]
    })
    .sort({ createdAt: -1, date: -1, timestamp: -1 })
    .limit(200)
    .toArray() as FoodEntryDocument[];

  const totals = foodEntries.reduce<{ calories: number; protein: number; fat: number; carbs: number }>(
    (sum, entry) => {
      const nutrition = getMealNutrition(entry);

      return {
        calories: sum.calories + nutrition.calories,
        protein: sum.protein + nutrition.protein,
        fat: sum.fat + nutrition.fat,
        carbs: sum.carbs + nutrition.carbs
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  const targets = getTargets(registeredUser);
  const lastFoodEntry = foodEntries.reduce<FoodEntryDocument | undefined>((latest, entry) => {
    const mealDate = readDate(entry);
    const latestDate = latest ? readDate(latest) : undefined;

    if (!mealDate) {
      return latest;
    }

    if (!latestDate || mealDate.getTime() > latestDate.getTime()) {
      return entry;
    }

    return latest;
  }, undefined);

  const response: DashboardResponse = {
    user: {
      id: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name
    },
    day: {
      calories: Math.round(totals.calories),
      calorieTarget: Math.round(targets.calories),
      meals: foodEntries.length,
      lastFood: getMealTitle(lastFoodEntry),
      lastFoodTime: formatMealTime(lastFoodEntry)
    },
    macros: [
      { id: "protein", current: Math.round(totals.protein), target: Math.round(targets.protein) },
      { id: "fat", current: Math.round(totals.fat), target: Math.round(targets.fat) },
      { id: "carbs", current: Math.round(totals.carbs), target: Math.round(targets.carbs) }
    ]
  };

  return NextResponse.json(response);
}
