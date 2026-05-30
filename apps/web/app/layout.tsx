import type { Metadata } from "next";
import { ChatProvider } from "./chat-context";
import AppShell from "./app-shell";
import "./styles.css";

export const metadata: Metadata = {
  title: "知序 — AI学习科研管家",
  description: "东方克制美学 × 精密工具感",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ChatProvider>
          <AppShell>{children}</AppShell>
        </ChatProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
