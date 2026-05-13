import { ObjectId, type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";
import { getTelegramBotToken, verifyTelegramInitData, type TelegramUser } from "../../../lib/telegram";

type UserDocument = Document & {
  _id?: ObjectId;
  telegramId?: number | string;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const BODY_MEASUREMENTS_COLLECTION = process.env.MONGODB_BODY_MEASUREMENTS_COLLECTION ?? "bodymeasurements";

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

function toMeasurementPayload(body: Record<string, unknown>) {
  const dateKey = parseDateKey(body.date);
  const values = {
    weightKg: parseFiniteNumber(body.weightKg),
    heightCm: parseFiniteNumber(body.heightCm),
    bodyFatPercent: parseFiniteNumber(body.bodyFatPercent),
    waistCm: parseFiniteNumber(body.waistCm),
    chestCm: parseFiniteNumber(body.chestCm),
    hipsCm: parseFiniteNumber(body.hipsCm),
    neckCm: parseFiniteNumber(body.neckCm)
  };
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!dateKey) {
    return { error: "Measurement date is required" };
  }

  if (Object.values(values).every((value) => value === undefined)) {
    return { error: "At least one measurement value is required" };
  }

  if (Object.values(values).some((value) => value !== undefined && value < 0)) {
    return { error: "Measurement values cannot be negative" };
  }

  return {
    payload: {
      measuredAt: new Date(`${dateKey}T12:00:00.000Z`),
      dateKey,
      ...values,
      notes,
      updatedAt: new Date()
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

export async function PATCH(request: Request, context: { params: Promise<{ measurementId: string }> }) {
  const { measurementId } = await context.params;
  if (!ObjectId.isValid(measurementId)) {
    return NextResponse.json({ error: "Invalid measurement id" }, { status: 400 });
  }

  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const parsed = toMeasurementPayload(authorized.body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await authorized.db.collection<Document>(BODY_MEASUREMENTS_COLLECTION).updateOne(
    {
      _id: new ObjectId(measurementId),
      $or: getMeasurementUserConditions(authorized.registeredUser, authorized.telegramUser)
    },
    { $set: parsed.payload }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "Body measurement not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ measurementId: string }> }) {
  const { measurementId } = await context.params;
  if (!ObjectId.isValid(measurementId)) {
    return NextResponse.json({ error: "Invalid measurement id" }, { status: 400 });
  }

  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const result = await authorized.db.collection<Document>(BODY_MEASUREMENTS_COLLECTION).deleteOne({
    _id: new ObjectId(measurementId),
    $or: getMeasurementUserConditions(authorized.registeredUser, authorized.telegramUser)
  });

  if (!result.deletedCount) {
    return NextResponse.json({ error: "Body measurement not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
