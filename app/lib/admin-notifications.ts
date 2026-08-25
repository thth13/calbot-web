import type { Document } from "mongodb";

export const ADMIN_ACTIVITY_COLLECTION =
  process.env.MONGODB_ADMIN_ACTIVITY_COLLECTION ?? "admin_notification_activity";
export const BOT_EVENTS_COLLECTION =
  process.env.MONGODB_BOT_EVENTS_COLLECTION ?? "botevents";

export type AdminActivityType = "visit" | "click" | "bottom";
export type AdminActivitySource = "browser" | "telegram_webapp";
export type BotActivityType = "bot_started" | "quiz_completed";
export type AdminEventType = AdminActivityType | BotActivityType;

export type AdminActivityDocument = Document & {
  type: AdminActivityType;
  path: string;
  label?: string;
  referrer?: string;
  visitorId: string;
  source: AdminActivitySource;
  telegramUserId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  ip: string;
  createdAt: Date;
  delivered: number;
  deliveryStatus: "pending" | "sent" | "failed";
};

export function getAdminTelegramIds() {
  const configuredIds = process.env.ADMIN_TELEGRAM_IDS;
  if (!configuredIds) {
    return [];
  }

  return Array.from(new Set(configuredIds.match(/-?\d+/g) ?? []));
}

export function isAdminTelegramId(id: number | string | undefined) {
  if (id === undefined) {
    return false;
  }

  return getAdminTelegramIds().includes(String(id));
}
