import type { Metadata } from "next";
import PremiumCheckout from "./PremiumCheckout";

export const metadata: Metadata = {
  title: "CalBot Premium",
  description: "Оформіть підписку CalBot Premium через Paddle."
};

export default function PremiumPage() {
  return <PremiumCheckout />;
}
