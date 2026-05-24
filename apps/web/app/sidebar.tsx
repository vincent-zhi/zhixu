"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconCapture,
  IconChat,
  IconClose,
  IconCompliance,
  IconKnowledge,
  IconMenu,
  IconProject,
  IconSettings,
  IconSkills,
  IconStudio,
  IconToday,
} from "./icons";

const NAV_ITEMS = [
  { href: "/", label: "AI 对话", helper: "任务入口", icon: IconChat },
  { href: "/today", label: "今日", helper: "指挥中心", icon: IconToday },
  { href: "/capture", label: "捕获", helper: "资料与任务", icon: IconCapture },
  { href: "/projects", label: "项目", helper: "推进状态", icon: IconProject },
  { href: "/studio", label: "产物", helper: "Canvas", icon: IconStudio },
  { href: "/knowledge", label: "知识", helper: "长期沉淀", icon: IconKnowledge },
  { href: "/compliance", label: "合规", helper: "溯源核验", icon: IconCompliance },
  { href: "/skills", label: "Skills", helper: "能力与权限", icon: IconSkills },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label="切换导航"
      >
        {mobileOpen ? <IconClose /> : <IconMenu />}
      </button>

      <button
        type="button"
        aria-label="关闭导航"
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar-new ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-new-header">
          <img
            className="sidebar-wordmark"
            src="/brand/zhixu-wordmark-transparent-v2.png"
            alt="知序 AI 学习科研管家"
          />
        </div>

        <nav className="sidebar-new-nav" aria-label="主导航">
          <div className="app-sidebar-section-label">Workspace</div>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-new-item ${active ? "sidebar-new-item-active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon />
                <span className="sidebar-item-text">
                  <strong>{item.label}</strong>
                  <small>{item.helper}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          <div>
            <strong>Agent 在线</strong>
            <small>2 个后台任务运行中</small>
          </div>
        </div>

        <div className="sidebar-new-footer">
          <Link
            href="/settings"
            className={`sidebar-new-item ${isActive("/settings") ? "sidebar-new-item-active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <IconSettings />
            <span className="sidebar-item-text">
              <strong>设置</strong>
              <small>隐私、模型、权限</small>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
