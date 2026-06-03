import { NextResponse } from "next/server";
import {
  getTelegramBotToken,
  sendTelegramMessage,
  verifyTelegramInitData
} from "../../../lib/telegram";

const planNames: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly"
};

export async function POST(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => undefined)) as
    | { initData?: unknown; plan?: unknown }
    | undefined;

  if (typeof body?.initData !== "string" || !body.initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  let user;
  try {
    user = verifyTelegramInitData(body.initData, botToken);
  } catch {
    return NextResponse.json({ error: "Invalid Telegram user payload" }, { status: 401 });
  }

  if (!user?.id) {
    return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
  }

  const plan = typeof body.plan === "string" ? planNames[body.plan] : undefined;
  const message = [
    "🎉 Payment complete!",
    "Thank you for buying CalBot Premium 💎",
    plan ? `📅 Plan: ${plan}` : undefined,
    "✨ Premium will activate after the payment is processed.",
    "🚀 Enjoy your upgraded CalBot experience!"
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendTelegramMessage(botToken, user.id, message);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not send Telegram message" }, { status: 502 });
  }
}
