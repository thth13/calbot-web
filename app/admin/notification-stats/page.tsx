import type { Metadata } from "next";
import NotificationStatsClient from "./NotificationStatsClient";

export const metadata: Metadata = {
  title: "Статистика сповіщень — CalBot",
  description: "Журнал дій і сповіщень, надісланих ботом CalBot.",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotificationStatsPage() {
  return <NotificationStatsClient />;
}
