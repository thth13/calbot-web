import type { Metadata } from "next";
import NotificationStatsClient from "./NotificationStatsClient";

export const metadata: Metadata = {
  title: "Notification statistics — CalBot",
  description: "CalBot activity log, notifications and meal entry statistics.",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotificationStatsPage() {
  return <NotificationStatsClient timeZone={process.env.DASHBOARD_TIME_ZONE ?? "Europe/Kyiv"} />;
}
