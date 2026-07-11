import type { Metadata } from "next";
import "./globals.css";
import  Providers  from "./providers";

export const metadata: Metadata = {
  title: "Personal Knowledge Agent",
  description: "AI 聊天工作空间，具备知识库管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}