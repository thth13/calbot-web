import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
// import SupportButton from "./SupportButton";
import TelegramActivityTracker from "./TelegramActivityTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalBot — calories from photos in Telegram",
  description:
    "Send a meal photo — CalBot estimates calories and macros and saves the meal to your diary. Try it free for 14 days.",
  openGraph: {
    title: "CalBot — calories from photos in Telegram",
    description:
      "Share a food photo in Telegram and CalBot estimates calories, protein, fat and carbs.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <TelegramActivityTracker />
        {children}
        {/* <SupportButton /> */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-18YQT06FRZ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-18YQT06FRZ');
          `}
        </Script>
      </body>
    </html>
  );
}
