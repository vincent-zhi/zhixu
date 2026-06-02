"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname === "/register";

  if (hideSidebar) {
    return <div className="app-main-full">{children}</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-content">{children}</div>
      </main>
    </div>
  );
}
