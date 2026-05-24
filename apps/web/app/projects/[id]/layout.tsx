import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "项目详情 — 知序",
  description: "查看项目详情、任务、资料和三色溯源"
};

export default function ProjectDetailLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
