"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listProjects,
  listCapsules,
  listMemoryCandidates,
} from "../api-client";
import type {
  ProjectSummary,
} from "@zhixu/core";
import type {
  KnowledgeCapsuleSummary,
  MemoryCandidate,
} from "../api-client";

const KNOWLEDGE_CATEGORIES = [
  { key: "knowledge_capsule", label: "知识胶囊", icon: "💊" },
  { key: "course_map", label: "课程图谱", icon: "🗺" },
  { key: "literature_matrix", label: "文献矩阵", icon: "📚" },
  { key: "experiment_log", label: "实验日志", icon: "🧪" },
  { key: "error_attribution", label: "错题归因", icon: "🔍" },
  { key: "mentor_preference", label: "导师偏好", icon: "👤" },
  { key: "terminology", label: "术语库", icon: "📖" },
] as const;

type CategoryKey = (typeof KNOWLEDGE_CATEGORIES)[number]["key"];

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KnowledgeOSPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [capsules, setCapsules] = useState<KnowledgeCapsuleSummary[]>([]);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projs = await listProjects();
      setProjects(projs);
      if (projs.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projs[0]!.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const [caps, mems] = await Promise.all([
        listCapsules(selectedProjectId),
        listMemoryCandidates(selectedProjectId),
      ]);
      setCapsules(caps);
      setMemoryCandidates(mems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载知识数据失败");
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData();
    }
  }, [selectedProjectId, loadProjectData]);

  const categoryCounts = KNOWLEDGE_CATEGORIES.map((cat) => {
    const base = { key: cat.key, label: cat.label, icon: cat.icon };
    if (cat.key === "knowledge_capsule") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "knowledge_capsule" || !c.capsuleType).length };
    }
    if (cat.key === "mentor_preference") {
      return { ...base, count: memoryCandidates.filter((m) => m.memoryType === "mentor_preference").length };
    }
    if (cat.key === "course_map") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "course_map").length };
    }
    if (cat.key === "literature_matrix") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "literature_matrix").length };
    }
    if (cat.key === "experiment_log") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "experiment_log").length };
    }
    if (cat.key === "error_attribution") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "error_attribution").length };
    }
    if (cat.key === "terminology") {
      return { ...base, count: capsules.filter((c) => c.capsuleType === "terminology").length };
    }
    return { ...base, count: 0 };
  });

  const filteredCapsules = activeCategory
    ? capsules.filter((c) => {
        if (activeCategory === "knowledge_capsule") return !c.capsuleType || c.capsuleType === "knowledge_capsule";
        return c.capsuleType === activeCategory;
      })
    : capsules;

  const filteredCandidates = activeCategory
    ? memoryCandidates.filter((m) => {
        if (activeCategory === "mentor_preference") return m.memoryType === "mentor_preference";
        if (activeCategory === "knowledge_capsule") return m.memoryType === "knowledge_capsule";
        return true;
      })
    : memoryCandidates;

  if (loading) {
    return (
      <main className="knowledge-shell">
        <div className="workspace-loading">加载中…</div>
      </main>
    );
  }

  return (
    <main className="knowledge-shell">
      <header className="knowledge-header">
        <Link href="/" className="back-link">← 返回首页</Link>
        <h1>知识 OS</h1>
        <div className="knowledge-project-selector">
          <label>当前项目：</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="knowledge-select"
          >
            <option value="">选择项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="knowledge-categories">
        {categoryCounts.map((cat) => (
          <button
            key={cat.key}
            className={`knowledge-category-card ${activeCategory === cat.key ? "knowledge-category-active" : ""}`}
            onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
          >
            <span className="category-icon">{cat.icon}</span>
            <span className="category-label">{cat.label}</span>
            <span className="category-count">{cat.count}</span>
          </button>
        ))}
      </section>

      <div className="knowledge-body">
        <section className="knowledge-reuse">
          <div className="knowledge-section-title">智能复用推荐</div>
          {filteredCandidates.length === 0 && (
            <div className="knowledge-empty">暂无推荐</div>
          )}
          {filteredCandidates.map((candidate) => (
            <div key={candidate.id} className="reuse-card">
              <div className="reuse-card-header">
                <span className={`reuse-type reuse-type-${candidate.memoryType}`}>
                  {candidate.memoryType === "knowledge_capsule" && "知识胶囊"}
                  {candidate.memoryType === "user_preference" && "用户偏好"}
                  {candidate.memoryType === "mentor_preference" && "导师偏好"}
                </span>
                <span className={`reuse-status reuse-status-${candidate.status}`}>
                  {candidate.status === "pending_confirmation" && "待确认"}
                  {candidate.status === "saved" && "已保存"}
                  {candidate.status === "rejected" && "已拒绝"}
                </span>
              </div>
              <div className="reuse-card-title">{candidate.title}</div>
              <div className="reuse-card-summary">{candidate.summary}</div>
              <div className="reuse-card-why">
                <span className="reuse-why-label">推荐原因：</span>
                {candidate.memoryType === "knowledge_capsule" && "可复用的结构化知识，适用于当前项目同类任务"}
                {candidate.memoryType === "user_preference" && "基于历史行为提取的用户偏好，可应用于当前项目"}
                {candidate.memoryType === "mentor_preference" && "导师反馈中提取的偏好模式，有助于调整交付风格"}
              </div>
              {candidate.evidenceRefs.length > 0 && (
                <div className="reuse-card-evidence">
                  关联证据：{candidate.evidenceRefs.length} 条
                </div>
              )}
              <div className="reuse-card-meta">
                <span>来源项目：{candidate.projectId.slice(0, 8)}</span>
                <span>{formatDt(candidate.createdAt)}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="knowledge-capsules">
          <div className="knowledge-section-title">知识胶囊库</div>
          {filteredCapsules.length === 0 && (
            <div className="knowledge-empty">暂无知识胶囊</div>
          )}
          {filteredCapsules.map((capsule) => (
            <div key={capsule.id} className="capsule-card">
              <div className="capsule-card-header">
                <span className="capsule-type-badge">
                  {capsule.capsuleType || "知识胶囊"}
                </span>
                <span className="capsule-privacy">{capsule.privacyScope}</span>
              </div>
              <div className="capsule-card-title">{capsule.title}</div>
              <div className="capsule-card-summary">{capsule.summary}</div>
              <div className="capsule-card-stats">
                <span>复用次数：{capsule.reuseCount}</span>
              </div>
              <div className="capsule-card-meta">
                <span>来源项目：{capsule.projectId.slice(0, 8)}</span>
                <span>{formatDt(capsule.createdAt)}</span>
              </div>
            </div>
          ))}
        </section>

        <aside className="knowledge-maintenance">
          <div className="knowledge-section-title">资产管理</div>
          <div className="maintenance-actions">
            <button className="maintenance-btn" disabled={filteredCapsules.length === 0}>
              合并胶囊
            </button>
            <button className="maintenance-btn maintenance-btn-danger" disabled={filteredCapsules.length === 0}>
              删除选中
            </button>
            <button className="maintenance-btn" disabled={filteredCapsules.length === 0}>
              分享
            </button>
            <button className="maintenance-btn" disabled={filteredCapsules.length === 0}>
              隐私设置
            </button>
            <button className="maintenance-btn" disabled={filteredCapsules.length === 0}>
              导出
            </button>
          </div>

          <div className="maintenance-section">
            <div className="maintenance-label">统计概览</div>
            <div className="maintenance-stats">
              <div className="maintenance-stat">
                <span className="stat-value">{capsules.length}</span>
                <span className="stat-label">知识胶囊</span>
              </div>
              <div className="maintenance-stat">
                <span className="stat-value">{memoryCandidates.length}</span>
                <span className="stat-label">记忆候选</span>
              </div>
              <div className="maintenance-stat">
                <span className="stat-value">
                  {memoryCandidates.filter((m) => m.status === "pending_confirmation").length}
                </span>
                <span className="stat-label">待确认</span>
              </div>
              <div className="maintenance-stat">
                <span className="stat-value">
                  {capsules.reduce((sum, c) => sum + c.reuseCount, 0)}
                </span>
                <span className="stat-label">总复用次数</span>
              </div>
            </div>
          </div>

          <div className="maintenance-section">
            <div className="maintenance-label">按项目分布</div>
            <div className="maintenance-project-list">
              {Object.entries(
                capsules.reduce<Record<string, number>>((acc, c) => {
                  const key = c.projectId.slice(0, 8);
                  acc[key] = (acc[key] ?? 0) + 1;
                  return acc;
                }, {})
              ).map(([projId, count]) => (
                <div key={projId} className="maintenance-project-item">
                  <span>{projId}</span>
                  <span>{count} 胶囊</span>
                </div>
              ))}
              {capsules.length === 0 && (
                <div className="maintenance-empty">暂无数据</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {error && <div className="command-error knowledge-error">{error}</div>}
    </main>
  );
}
