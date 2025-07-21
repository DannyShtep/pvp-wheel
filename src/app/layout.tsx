import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PvP Wheel - Telegram Game",
  description: "Mobile-first PvP wheel game for Telegram with TON integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is needed because Telegram WebApp script
    // adds CSS variables to the html element that don't exist during SSR
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body
        className={`${dmSans.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
