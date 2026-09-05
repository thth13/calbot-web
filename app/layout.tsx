import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
// import SupportButton from "./SupportButton";
import TelegramActivityTracker from "./TelegramActivityTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalBot — калорії за фото у Telegram",
  description:
    "Надішліть фото страви — CalBot оцінить калорії та БЖВ і збереже прийом їжі у щоденнику. Спробуйте 14 днів безкоштовно.",
  openGraph: {
    title: "CalBot — калорії за фото у Telegram",
    description:
      "Сфотографуйте їжу в Telegram, і CalBot оцінить калорії, білки, жири та вуглеводи.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
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
