import type { Metadata } from "next";
import PremiumCheckout from "./PremiumCheckout";

export const metadata: Metadata = {
  title: "CalBot Premium",
  description: "Subscribe to CalBot Premium through Paddle."
};

export default function PremiumPage() {
  return <PremiumCheckout />;
}
