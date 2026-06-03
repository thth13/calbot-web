import crypto from "node:crypto";
import { type Document, type Filter } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";

type PaddleWebhookEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: PaddleEventData;
};

type PaddleEventData = {
  id?: string;
  status?: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  custom_data?: Record<string, unknown> | null;
  customData?: Record<string, unknown> | null;
  billing_period?: PaddleBillingPeriod | null;
  current_billing_period?: PaddleBillingPeriod | null;
  items?: PaddleItem[];
  details?: {
    line_items?: PaddleLineItem[];
  };
};

type PaddleBillingPeriod = {
  starts_at?: string;
  ends_at?: string;
};

type PaddleItem = {
  price?: {
    id?: string;
  };
};

type PaddleLineItem = {
  price_id?: string;
};

const USERS_COLLECTION = process.env.MONGODB_USERS_COLLECTION ?? "users";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type PaddleWebhookSecret = {
  name: string;
  value: string;
};

function splitSecretList(value: string) {
  return value
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

function getPaddleWebhookSecrets(): PaddleWebhookSecret[] {
  const entries = [
    ["PADDLE_WEBHOOK_SECRET_KEYS", process.env.PADDLE_WEBHOOK_SECRET_KEYS],
    ["PADDLE_WEBHOOK_SECRET_KEY", process.env.PADDLE_WEBHOOK_SECRET_KEY],
    ["PADDLE_WEBHOOK_SECRET", process.env.PADDLE_WEBHOOK_SECRET],
    ["PADDLE_NOTIFICATION_SECRET", process.env.PADDLE_NOTIFICATION_SECRET]
  ] as const;

  return entries.flatMap(([name, value]) =>
    value?.trim()
      ? splitSecretList(value).map((secret, index) => ({
          name: index === 0 ? name : `${name}[${index}]`,
          value: secret
        }))
      : []
  );
}

function parsePaddleSignature(header: string) {
  return header.split(";").reduce<{ ts?: string; h1: string[] }>(
    (signature, part) => {
      const [key, ...value] = part.trim().split("=");
      const joinedValue = value.join("=");

      if (key === "ts") {
        signature.ts = joinedValue;
      }

      if (key === "h1" && joinedValue) {
        signature.h1.push(joinedValue);
      }

      return signature;
    },
    { h1: [] }
  );
}

function safeEqualHex(expectedHex: string, actualHex: string) {
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(actualHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string) {
  const signature = parsePaddleSignature(signatureHeader);
  const timestamp = Number(signature.ts);

  if (!timestamp || signature.h1.length === 0) {
    return "missing_signature_parts";
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
    return "expired_timestamp";
  }

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");
  return signature.h1.some((h1) => safeEqualHex(expected, h1)) ? "valid" : "signature_mismatch";
}

function verifyPaddleSignatures(
  rawBody: string,
  signatureHeader: string,
  secrets: PaddleWebhookSecret[]
) {
  let lastStatus = "signature_mismatch";

  for (const secret of secrets) {
    const status = verifyPaddleSignature(rawBody, signatureHeader, secret.value);
    if (status === "valid") {
      return { status, secret };
    }

    lastStatus = status;
  }

  return { status: lastStatus };
}

function getSecretFingerprint(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 10);
}

function getWebhookDebugInfo(rawBody: string) {
  try {
    const event = JSON.parse(rawBody) as PaddleWebhookEvent & {
      notification_id?: string;
      notification_setting_id?: string;
    };

    return {
      eventId: event.event_id,
      eventType: event.event_type,
      notificationId: event.notification_id,
      notificationSettingId: event.notification_setting_id
    };
  } catch {
    return {};
  }
}

function readCustomData(data: PaddleEventData) {
  return data.custom_data ?? data.customData ?? {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getTelegramUserId(customData: Record<string, unknown>) {
  return (
    readString(customData.telegramUserId) ??
    readString(customData.telegram_user_id) ??
    readString(customData.telegramId) ??
    readString(customData.telegram_id)
  );
}

function getPriceId(data: PaddleEventData) {
  return (
    data.items?.find((item) => item.price?.id)?.price?.id ??
    data.details?.line_items?.find((item) => item.price_id)?.price_id
  );
}

function getPlan(customData: Record<string, unknown>, data: PaddleEventData) {
  const customPlan = readString(customData.plan);
  if (customPlan) {
    return customPlan;
  }

  const priceId = getPriceId(data);
  if (priceId && priceId === process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID) {
    return "monthly";
  }

  if (priceId && priceId === process.env.NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID) {
    return "yearly";
  }

  return undefined;
}

function getPremiumActive(eventType: string, status?: string) {
  if (
    eventType === "transaction.completed" ||
    eventType === "subscription.activated" ||
    eventType === "subscription.resumed" ||
    status === "active" ||
    status === "trialing"
  ) {
    return true;
  }

  if (
    eventType === "subscription.canceled" ||
    eventType === "subscription.paused" ||
    eventType === "subscription.past_due" ||
    status === "canceled" ||
    status === "paused" ||
    status === "past_due"
  ) {
    return false;
  }

  return undefined;
}

function getUserFilter(telegramUserId: string): Filter<Document> {
  const numericTelegramUserId = Number(telegramUserId);
  const ids: Array<string | number> = [telegramUserId];

  if (Number.isSafeInteger(numericTelegramUserId)) {
    ids.push(numericTelegramUserId);
  }

  return {
    $or: ids.flatMap((id) => [
      { telegramId: id },
      { telegramUserId: id },
      { telegram_id: id },
      { "telegram.id": id },
      { "telegram.user.id": id }
    ])
  };
}

function getPaddleUserFilter(subscriptionId?: string, customerId?: string | null): Filter<Document> | undefined {
  const conditions: Filter<Document>[] = [];

  if (subscriptionId) {
    conditions.push({ "paddle.subscriptionId": subscriptionId });
  }

  if (customerId) {
    conditions.push({ "paddle.customerId": customerId });
  }

  return conditions.length ? { $or: conditions } : undefined;
}

export async function POST(request: Request) {
  const secrets = getPaddleWebhookSecrets();
  if (secrets.length === 0) {
    return NextResponse.json({ error: "PADDLE_WEBHOOK_SECRET_KEY is not configured" }, { status: 500 });
  }

  const signatureHeader = request.headers.get("paddle-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing Paddle-Signature header" }, { status: 400 });
  }

  const rawBody = await request.text();
  const signature = parsePaddleSignature(signatureHeader);
  const signatureResult = verifyPaddleSignatures(rawBody, signatureHeader, secrets);
  const signatureStatus = signatureResult.status;
  if (signatureStatus !== "valid") {
    console.warn("Paddle webhook signature verification failed", {
      reason: signatureStatus,
      hasTimestamp: Boolean(signature.ts),
      hasSignature: signature.h1.length > 0,
      signatureCount: signature.h1.length,
      bodyLength: rawBody.length,
      secrets: secrets.map((secret) => ({
        env: secret.name,
        length: secret.value.length,
        fingerprint: getSecretFingerprint(secret.value)
      })),
      ...getWebhookDebugInfo(rawBody)
    });

    return NextResponse.json({ error: "Invalid Paddle signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as PaddleWebhookEvent;
  const eventType = event.event_type;
  const data = event.data;

  if (!eventType || !data) {
    return NextResponse.json({ error: "Invalid Paddle webhook payload" }, { status: 400 });
  }

  const premiumActive = getPremiumActive(eventType, data.status);
  if (premiumActive === undefined) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const customData = readCustomData(data);
  const telegramUserId = getTelegramUserId(customData);
  const now = new Date();
  const plan = getPlan(customData, data);
  const period = data.current_billing_period ?? data.billing_period;
  const premiumUntil = readDate(period?.ends_at);
  const priceId = getPriceId(data);
  const transactionId = eventType.startsWith("transaction.") ? data.id : undefined;
  const subscriptionId = data.subscription_id ?? (eventType.startsWith("subscription.") ? data.id : undefined);
  const userFilter = telegramUserId
    ? getUserFilter(telegramUserId)
    : getPaddleUserFilter(subscriptionId, data.customer_id);

  if (!userFilter) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing user reference" });
  }

  const set: Document = {
    "premium.active": premiumActive,
    "premium.status": premiumActive ? "active" : data.status ?? eventType.split(".")[1],
    "premium.provider": "paddle",
    "premium.updatedAt": now,
    "paddle.lastEventId": event.event_id,
    "paddle.lastEventType": eventType
  };

  if (telegramUserId) {
    set.telegramId = Number.isSafeInteger(Number(telegramUserId)) ? Number(telegramUserId) : telegramUserId;
  }

  if (plan) {
    set["premium.plan"] = plan;
  }

  if (premiumUntil) {
    set["premium.expiresAt"] = premiumUntil;
  }

  if (data.customer_id) {
    set["paddle.customerId"] = data.customer_id;
  }

  if (subscriptionId) {
    set["paddle.subscriptionId"] = subscriptionId;
  }

  if (transactionId) {
    set["paddle.transactionId"] = transactionId;
  }

  if (priceId) {
    set["paddle.priceId"] = priceId;
  }

  const eventOccurredAt = readDate(event.occurred_at);
  if (eventOccurredAt) {
    set["paddle.lastEventOccurredAt"] = eventOccurredAt;
  }

  const db = await getMongoDb();
  await db.collection(USERS_COLLECTION).updateOne(
    userFilter,
    {
      $set: set,
      $unset: {
        isPremium: "",
        premiumPlan: "",
        premiumStatus: "",
        premiumUntil: "",
        premiumUpdatedAt: ""
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
