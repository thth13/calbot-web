import type { Metadata } from "next";
import NotificationStatsClient from "./NotificationStatsClient";

export const metadata: Metadata = {
  title: "Статистика уведомлений — CalBot",
  description: "Журнал действий, отправленных ботом уведомлений CalBot.",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotificationStatsPage() {
  return <NotificationStatsClient />;
}
