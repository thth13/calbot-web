import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "Статистика — CalBot",
  description: "Динаміка калорій, досягнення цілей, серії та тижневі порівняння в CalBot."
};

export default function StatsPage() {
  return <StatsClient />;
}
