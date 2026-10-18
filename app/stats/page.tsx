import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "Statistics — CalBot",
  description: "Calorie trends, goal achievement, streaks and weekly comparisons in CalBot."
};

export default function StatsPage() {
  return <StatsClient />;
}
