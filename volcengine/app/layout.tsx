import type { Metadata } from "next";
import AudioSpace from "@/components/audio-space";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AudioSpace />{children}</body>
    </html>
  );
}
