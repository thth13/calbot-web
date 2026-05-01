import crypto from "node:crypto";
import { NextResponse } from "next/server";

const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!hash || !authDate) {
    return undefined;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < 0 || ageSeconds > INIT_DATA_MAX_AGE_SECONDS) {
    return undefined;
  }

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return undefined;
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    return undefined;
  }

  const user = JSON.parse(rawUser) as TelegramUser;
  if (!user.id) {
    return undefined;
  }

  return user;
}

export async function POST(request: Request) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "BOT_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => undefined)) as { initData?: unknown } | undefined;
  if (typeof body?.initData !== "string" || !body.initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  try {
    const user = verifyTelegramInitData(body.initData, botToken);
    if (!user) {
      return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch {
    return NextResponse.json({ error: "Invalid Telegram user payload" }, { status: 401 });
  }
}
