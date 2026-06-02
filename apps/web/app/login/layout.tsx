import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "登录 - 知序",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
