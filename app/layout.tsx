import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalBot - AI calorie tracker in Telegram",
  description:
    "CalBot landing page and Telegram dashboard: analyze food, track calories, macros, meals, and nutrition stats.",
  openGraph: {
    title: "CalBot - AI calorie tracker in Telegram",
    description:
      "Take a food photo in Telegram and CalBot will estimate calories, protein, fat, and carbs.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
