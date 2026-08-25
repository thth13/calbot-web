import type { Metadata } from "next";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = {
  title: "Історія харчування — CalBot",
  description: "Історія харчування CalBot, згрупована за днями та часом."
};

export default function HistoryPage() {
  return <HistoryClient />;
}
