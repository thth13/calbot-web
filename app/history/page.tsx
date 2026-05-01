import type { Metadata } from "next";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = {
  title: "CalBot History",
  description: "CalBot meal history grouped by day and time."
};

export default function HistoryPage() {
  return <HistoryClient />;
}
