import { ObjectId, type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";
import { getTelegramBotToken, verifyTelegramInitData, type TelegramUser } from "../../../lib/telegram";

type UserDocument = Document & {
  _id?: ObjectId;
  telegramId?: number | string;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const FOOD_ENTRIES_COLLECTION = process.env.MONGODB_FOOD_ENTRIES_COLLECTION ?? "foodentries";

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

function parseFiniteNumber(value: unknown) {
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

export async function PATCH(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await context.params;
  if (!ObjectId.isValid(entryId)) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }

  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const foodDescription = typeof authorized.body.foodDescription === "string" ? authorized.body.foodDescription.trim() : "";
  const calories = parseFiniteNumber(authorized.body.calories);
  const protein = parseFiniteNumber(authorized.body.protein);
  const fat = parseFiniteNumber(authorized.body.fat);
  const carbs = parseFiniteNumber(authorized.body.carbs);

  if (!foodDescription || calories === undefined || protein === undefined || fat === undefined || carbs === undefined) {
    return NextResponse.json({ error: "Food description and nutrition values are required" }, { status: 400 });
  }

  if ([calories, protein, fat, carbs].some((value) => value < 0)) {
    return NextResponse.json({ error: "Nutrition values cannot be negative" }, { status: 400 });
  }

  const result = await authorized.db.collection<Document>(FOOD_ENTRIES_COLLECTION).updateOne(
    {
      _id: new ObjectId(entryId),
      $or: getMealUserConditions(authorized.registeredUser, authorized.telegramUser)
    },
    {
      $set: {
        foodDescription,
        calories,
        protein,
        fat,
        carbs
      }
    }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "Food entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await context.params;
  if (!ObjectId.isValid(entryId)) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }

  const authorized = await getAuthorizedContext(request);
  if ("error" in authorized) {
    return authorized.error;
  }

  const result = await authorized.db.collection<Document>(FOOD_ENTRIES_COLLECTION).deleteOne({
    _id: new ObjectId(entryId),
    $or: getMealUserConditions(authorized.registeredUser, authorized.telegramUser)
  });

  if (!result.deletedCount) {
    return NextResponse.json({ error: "Food entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
