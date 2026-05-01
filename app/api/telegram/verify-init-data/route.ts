import { NextResponse } from "next/server";
import { getTelegramBotToken, verifyTelegramInitData } from "../../../lib/telegram";

export async function POST(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
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
