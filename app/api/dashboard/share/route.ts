import { NextResponse } from "next/server";
import { saveShareImage } from "../../../lib/share-images";
import { getTelegramBotToken, verifyTelegramInitData } from "../../../lib/telegram";

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function createShareCaption(formData: FormData) {
  const userTitle = String(formData.get("userTitle") ?? "Мій день");
  const calories = String(formData.get("calories") ?? "0");
  const calorieTarget = String(formData.get("calorieTarget") ?? "0");
  const meals = String(formData.get("meals") ?? "0");
  const dayTitle = String(formData.get("dayTitle") ?? "сьогодні").toLowerCase();

  return [
    `${userTitle} у CalBot`,
    `${calories} / ${calorieTarget} ккал — ${dayTitle}`,
    `${meals} прийомів їжі відстежено`,
    "",
    "Відстежуйте калорії в Telegram: https://t.me/caldetect_bot"
  ].join("\n");
}

function getRequestOrigin(request: Request) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (configuredOrigin) {
    return configuredOrigin.startsWith("http") ? configuredOrigin : `https://${configuredOrigin}`;
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "Токен Telegram-бота не налаштовано" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некоректні дані для поширення" }, { status: 400 });
  }

  const initData = String(formData.get("initData") ?? "");
  const telegramUser = verifyTelegramInitData(initData, botToken);
  if (!telegramUser?.id) {
    return NextResponse.json({ error: "Некоректні дані авторизації Telegram" }, { status: 401 });
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Потрібне зображення для поширення" }, { status: 400 });
  }

  if (photo.type !== "image/png" || photo.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json({ error: "Зображення має бути у форматі PNG і розміром до 5 МБ" }, { status: 400 });
  }

  const shareImageId = await saveShareImage(photo);
  const photoUrl = new URL(
    `/api/dashboard/share/image/${shareImageId}`,
    getRequestOrigin(request)
  ).toString();

  if (!photoUrl.startsWith("https://")) {
    return NextResponse.json(
      {
        error: "URL зображення має бути загальнодоступним і використовувати HTTPS",
        detail: `Налаштований URL зображення не використовує HTTPS: ${photoUrl}`
      },
      { status: 500 }
    );
  }

  const result = {
    type: "photo",
    id: shareImageId,
    photo_url: photoUrl,
    thumbnail_url: photoUrl,
    title: "День у CalBot",
    description: "Калорії та БЖВ за день",
    caption: createShareCaption(formData)
  };

  const telegramForm = new FormData();
  telegramForm.append("user_id", String(telegramUser.id));
  telegramForm.append("result", JSON.stringify(result));
  telegramForm.append("allow_user_chats", "true");
  telegramForm.append("allow_group_chats", "true");
  telegramForm.append("allow_channel_chats", "true");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`, {
    method: "POST",
    body: telegramForm
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram savePreparedInlineMessage failed", errorText);

    return NextResponse.json(
      {
        error: "Telegram не зміг підготувати зображення для поширення",
        detail: errorText
      },
      { status: 502 }
    );
  }

  const body = (await response.json()) as { ok?: boolean; result?: { id?: string } };
  if (!body.ok || !body.result?.id) {
    return NextResponse.json({ error: "Telegram повернув некоректне підготовлене повідомлення" }, { status: 502 });
  }

  return NextResponse.json({ preparedMessageId: body.result.id });
}
