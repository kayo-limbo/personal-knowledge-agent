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
    // 使用 globals.css 中的系统字体栈，离线构建时不需要向 Google 下载字体。
    <html lang="zh-CN" className="font-sans">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
