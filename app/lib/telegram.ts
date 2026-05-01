import crypto from "node:crypto";

const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

export type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
}

export function verifyTelegramInitData(initData: string, botToken: string) {
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
