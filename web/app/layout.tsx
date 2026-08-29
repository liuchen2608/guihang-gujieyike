import type { Metadata, Viewport } from "next";
import GameUIProvider from "@/components/game-ui-provider";
import "./globals.css";
import "./mobile.css";
import "./invite.css";

export const metadata: Metadata = {
  title: "归航：蛊界异客",
  description: "一款以对话推动剧情的单人 AI 情景 RPG。",
  openGraph: {
    title: "归航：蛊界异客",
    description: "以对话改写命运，寻找回到现实的方法。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "归航：蛊界异客" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#070b0c" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><GameUIProvider>{children}</GameUIProvider></body>
    </html>
  );
}
