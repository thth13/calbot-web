import type { Metadata } from "next";
import NotificationStatsClient from "./NotificationStatsClient";

export const metadata: Metadata = {
  title: "Notification statistics — CalBot",
  description: "Activity log and notifications sent by the CalBot bot.",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotificationStatsPage() {
  return <NotificationStatsClient timeZone={process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv"} />;
}
