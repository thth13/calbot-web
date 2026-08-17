import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
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
