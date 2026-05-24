import type { Metadata } from "next";
import Sidebar from "./sidebar";
import "./styles.css";

export const metadata: Metadata = {
  title: "知序 - AI 学习科研管家",
  description: "对话驱动的学习科研 Agent OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">
            <div className="app-main-content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
