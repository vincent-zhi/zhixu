"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  IconCapture,
  IconChat,
  IconClose,
  IconCompliance,
  IconKnowledge,
  IconMaterials,
  IconMenu,
  IconProject,
  IconSchedule,
  IconSettings,
  IconSkills,
  IconStudio,
  IconToday,
} from "./icons";
import { logout } from "./api-client";
import { useOffline } from "./use-offline";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  educationStage?: string;
  discipline?: string;
}

const NAV_ITEMS = [
  { href: "/", label: "AI 对话", helper: "任务入口", icon: IconChat },
  { href: "/today", label: "今日", helper: "指挥中心", icon: IconToday },
  { href: "/capture", label: "捕获", helper: "资料与任务", icon: IconCapture },
  { href: "/projects", label: "项目", helper: "推进状态", icon: IconProject },
  { href: "/schedule", label: "日程", helper: "考试与安排", icon: IconSchedule },
  { href: "/studio", label: "产物", helper: "Canvas", icon: IconStudio },
  { href: "/materials", label: "资料", helper: "素材管理", icon: IconMaterials },
  { href: "/knowledge", label: "知识", helper: "长期沉淀", icon: IconKnowledge },
  { href: "/compliance", label: "合规", helper: "溯源核验", icon: IconCompliance },
  { href: "/skills", label: "Skills", helper: "能力与权限", icon: IconSkills },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const { isOffline, pendingOps } = useOffline();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("zhixu_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("zhixu_token");
      if (token) await logout(token);
    } catch {}
    localStorage.removeItem("zhixu_token");
    localStorage.removeItem("zhixu_user");
    setUser(null);
    router.push("/login");
  };

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
          <span className={`status-dot ${isOffline ? "offline" : ""}`} />
          <div>
            <strong>{isOffline ? "离线模式" : "Agent 在线"}</strong>
            <small>
              {isOffline
                ? pendingOps > 0
                  ? `${pendingOps} 个操作待同步`
                  : "网络已断开"
                : pendingOps > 0
                  ? `${pendingOps} 个操作待同步`
                  : "2 个后台任务运行中"}
            </small>
          </div>
        </div>

        <div className="sidebar-new-footer">
          {user && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          )}
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
          {user ? (
            <button
              className="sidebar-new-item sidebar-logout-btn"
              onClick={handleLogout}
            >
              <IconClose />
              <span className="sidebar-item-text">
                <strong>登出</strong>
                <small>退出当前账户</small>
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              className="sidebar-new-item"
              onClick={() => setMobileOpen(false)}
            >
              <span className="sidebar-item-text">
                <strong>登录</strong>
              </span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
