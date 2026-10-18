import type { Metadata } from "next";
import { ADMIN_TIME_ZONE } from "../../lib/admin-notifications";
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
  return <NotificationStatsClient timeZone={ADMIN_TIME_ZONE} />;
}
