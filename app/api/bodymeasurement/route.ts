import { ObjectId, type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../lib/mongodb";
import { getTelegramBotToken, verifyTelegramInitData, type TelegramUser } from "../../lib/telegram";

type UserDocument = Document & {
  _id?: ObjectId;
  telegramId?: number | string;
};

type BodyMeasurementDocument = Document & {
  _id?: ObjectId;
  createdAt?: Date | string;
  date?: Date | string;
  measuredAt?: Date | string;
};

type MeasurementInput = {
  date?: unknown;
  weightKg?: unknown;
  heightCm?: unknown;
  bodyFatPercent?: unknown;
  waistCm?: unknown;
  chestCm?: unknown;
  hipsCm?: unknown;
  neckCm?: unknown;
  notes?: unknown;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const BODY_MEASUREMENTS_COLLECTION = process.env.MONGODB_BODY_MEASUREMENTS_COLLECTION ?? "bodymeasurements";
const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv";
const MEASUREMENTS_LIMIT = Number(process.env.BODY_MEASUREMENTS_LIMIT ?? 100);

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

function readNumber(source: unknown, paths: string[]) {
  const value = readValue(source, paths);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readString(source: unknown, paths: string[], fallback = "") {
  const value = readValue(source, paths);
  return typeof value === "string" ? value.trim() : fallback;
}

function readDate(source: unknown) {
  const raw =
    (source && typeof source === "object"
      ? readValue(source, ["measuredAt", "measured_at", "createdAt", "created_at", "date", "day", "timestamp"])
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

function getLocalDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function parseDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return undefined;
  }

  return value;
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

function getMeasurementUserConditions(user: UserDocument, telegramUser: TelegramUser): Filter<Document>[] {
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

function parseFiniteNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toMeasurementPayload(input: MeasurementInput) {
  const dateKey = parseDateKey(input.date);
  const values = {
    weightKg: parseFiniteNumber(input.weightKg),
    heightCm: parseFiniteNumber(input.heightCm),
    bodyFatPercent: parseFiniteNumber(input.bodyFatPercent),
    waistCm: parseFiniteNumber(input.waistCm),
    chestCm: parseFiniteNumber(input.chestCm),
    hipsCm: parseFiniteNumber(input.hipsCm),
    neckCm: parseFiniteNumber(input.neckCm)
  };
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";

  if (!dateKey) {
    return { error: "Укажіть дату вимірювання" };
  }

  if (Object.values(values).every((value) => value === undefined)) {
    return { error: "Укажіть принаймні одне значення вимірювання" };
  }

  if (Object.values(values).some((value) => value !== undefined && value < 0)) {
    return { error: "Значення вимірювань не можуть бути від’ємними" };
  }

  return {
    payload: {
      measuredAt: new Date(`${dateKey}T12:00:00.000Z`),
      dateKey,
      ...values,
      notes
    }
  };
}

async function getAuthorizedContext(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return {
      error: NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 })
    };
  }

  const body = (await request.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  if (typeof body?.initData !== "string" || !body.initData) {
    return {
      error: NextResponse.json({ error: "initData is required" }, { status: 400 })
    };
  }

  let telegramUser: TelegramUser | undefined;
  try {
    telegramUser = verifyTelegramInitData(body.initData, botToken);
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid Telegram user payload" }, { status: 401 })
    };
  }

  if (!telegramUser?.id) {
    return {
      error: NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 })
    };
  }

  const db = await getMongoDb();
  const registeredUser = await db.collection<UserDocument>(USERS_COLLECTION).findOne(getUserFilter(telegramUser));

  if (!registeredUser) {
    return {
      error: NextResponse.json({ error: "User is not registered" }, { status: 404 })
    };
  }

  return {
    body,
    db,
    registeredUser,
    telegramUser
  };
}

function buildResponse(measurements: BodyMeasurementDocument[]) {
  const items = measurements
    .map((measurement) => {
      const measuredAt = readDate(measurement);
      const dateKey = readString(measurement, ["dateKey"]) || (measuredAt ? getLocalDateKey(measuredAt) : "");

      return {
        id: measurement._id?.toString() ?? dateKey,
        dateKey,
        date: dateKey ? formatDateLabel(dateKey) : "Невідома дата",
        weightKg: readNumber(measurement, ["weightKg", "weight", "body.weight", "metrics.weightKg"]),
        heightCm: readNumber(measurement, ["heightCm", "height", "body.height", "metrics.heightCm"]),
        bodyFatPercent: readNumber(measurement, ["bodyFatPercent", "bodyFat", "fatPercent", "metrics.bodyFatPercent"]),
        waistCm: readNumber(measurement, ["waistCm", "waist", "metrics.waistCm"]),
        chestCm: readNumber(measurement, ["chestCm", "chest", "metrics.chestCm"]),
        hipsCm: readNumber(measurement, ["hipsCm", "hips", "metrics.hipsCm"]),
        neckCm: readNumber(measurement, ["neckCm", "neck", "metrics.neckCm"]),
        notes: readString(measurement, ["notes", "comment"])
      };
    })
    .filter((measurement) => measurement.dateKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const latest = items[0];

  return {
    latest: latest
      ? {
          date: latest.date,
          weightKg: latest.weightKg,
          bodyFatPercent: latest.bodyFatPercent
        }
      : undefined,
    items
  };
}

export async function POST(request: Request) {
  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const measurements = (await authorized.db
    .collection<Document>(BODY_MEASUREMENTS_COLLECTION)
    .find({ $or: getMeasurementUserConditions(authorized.registeredUser, authorized.telegramUser) })
    .sort({ measuredAt: -1, createdAt: -1, date: -1 })
    .limit(Number.isFinite(MEASUREMENTS_LIMIT) && MEASUREMENTS_LIMIT > 0 ? MEASUREMENTS_LIMIT : 100)
    .toArray()) as BodyMeasurementDocument[];

  return NextResponse.json(buildResponse(measurements));
}

export async function PUT(request: Request) {
  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const parsed = toMeasurementPayload(authorized.body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await authorized.db.collection<Document>(BODY_MEASUREMENTS_COLLECTION).insertOne({
    ...parsed.payload,
    userId: authorized.registeredUser._id,
    telegramId: authorized.telegramUser.id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return NextResponse.json({ ok: true });
}
