import type { Metadata } from "next";
import PremiumCheckout from "./PremiumCheckout";

export const metadata: Metadata = {
  title: "CalBot Premium",
  description: "Buy CalBot Premium subscription through Paddle."
};

export default function PremiumPage() {
  return <PremiumCheckout />;
}
