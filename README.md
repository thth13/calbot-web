# CalBot Landing

Отдельный Next.js лендинг для деплоя на Vercel.

## Локальный запуск

```bash
yarn install
yarn dev
```

## Vercel

При импорте репозитория в Vercel укажи root directory:

```text
calbot-landing
```

Build command:

```text
yarn build
```

Output directory оставь пустым, Vercel определит Next.js автоматически.

## Telegram-уведомления об активности

Чтобы получать в Telegram уведомления о посещениях, нажатиях на кнопки и прокрутке
страницы до конца, добавь в `.env.local` и в Environment Variables проекта на Vercel:

```text
ADMIN_NOTIFICATION_BOT_TOKEN=токен_бота_уведомлений
ADMIN_TELEGRAM_IDS=123456789,987654321
```

В `ADMIN_TELEGRAM_IDS` можно указать один или несколько Telegram ID через запятую,
пробел или как JSON-массив. Каждый администратор должен предварительно открыть диалог
с ботом уведомлений и нажать Start.
