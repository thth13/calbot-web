import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "CalBot Stats",
  description: "CalBot calorie trends, target hits, streaks, and weekly comparisons."
};

export default function StatsPage() {
  return <StatsClient />;
}
