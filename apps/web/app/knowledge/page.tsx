"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listProjects,
  listCapsules,
  listMemoryCandidates,
  paperRead,
  paperCompare,
  paperMatrix,
  sensenovaSearchAcademic,
} from "../api-client";
import type {
  ProjectSummary,
} from "@zhixu/core";
import type {
  KnowledgeCapsuleSummary,
  MemoryCandidate,
  PaperMatrix,
  PaperComparison,
  PaperMatrixResult,
} from "../api-client";
import {
  IconKnowledge,
  IconBook,
  IconMemory,
  IconExperiment,
  IconSearch,
  IconFeedback,
  IconPaper,
} from "../icons";

const KNOWLEDGE_CATEGORIES = [
  { key: "knowledge_capsule", label: "知识胶囊" },
  { key: "course_map", label: "课程图谱" },
  { key: "literature_matrix", label: "文献矩阵" },
  { key: "experiment_log", label: "实验日志" },
  { key: "error_attribution", label: "错题归因" },
  { key: "mentor_preference", label: "导师偏好" },
  { key: "terminology", label: "术语库" },
] as const;

type CategoryKey = (typeof KNOWLEDGE_CATEGORIES)[number]["key"];

function getCategoryIcon(key: CategoryKey) {
  switch (key) {
    case "knowledge_capsule": return <IconKnowledge size={16} />;
    case "course_map": return <IconMemory size={16} />;
    case "literature_matrix": return <IconBook size={16} />;
    case "experiment_log": return <IconExperiment size={16} />;
    case "error_attribution": return <IconSearch size={16} />;
    case "mentor_preference": return <IconFeedback size={16} />;
    case "terminology": return <IconPaper size={16} />;
  }
}

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
  const [paperReadingResult, setPaperReadingResult] = useState<PaperMatrix | null>(null);
  const [paperComparing, setPaperComparing] = useState(false);
  const [paperCompareResult, setPaperCompareResult] = useState<PaperComparison | null>(null);
  const [paperMatrixResult, setPaperMatrixResult] = useState<PaperMatrixResult | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  // SenseNova Academic Search state
  const [academicQuery, setAcademicQuery] = useState("");
  const [academicPlatforms, setAcademicPlatforms] = useState<string[]>(["arxiv", "semantic_scholar"]);
  const [academicResults, setAcademicResults] = useState<any[] | null>(null);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [academicError, setAcademicError] = useState<string | null>(null);

  const handlePaperRead = useCallback(async () => {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;
    setPaperLoading(true);
    try {
      const detail = await import("../api-client").then((m) => m.getProject(selectedProjectId!));
      const sources = detail.sources;
      if (sources.length === 0) return;
      const result = await paperRead(selectedProjectId, { sourceId: sources[0]!.id });
      setPaperReadingResult(result);
      if (sources.length >= 2) {
        setPaperComparing(true);
        const compareResult = await paperCompare(selectedProjectId, {
          sourceIds: sources.slice(0, 5).map((s) => s.id),
        });
        setPaperCompareResult(compareResult);
        const matrixResult = await paperMatrix(selectedProjectId, {
          sourceIds: sources.slice(0, 5).map((s) => s.id),
        });
        setPaperMatrixResult(matrixResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "论文精读失败");
    } finally {
      setPaperLoading(false);
      setPaperComparing(false);
    }
  }, [selectedProjectId, projects]);

  const handleAcademicSearch = useCallback(async () => {
    if (!academicQuery.trim()) return;
    setAcademicLoading(true);
    setAcademicError(null);
    setAcademicResults(null);
    try {
      const result = await sensenovaSearchAcademic(academicQuery, academicPlatforms);
      setAcademicResults(result?.items ?? result?.results ?? (Array.isArray(result) ? result : []));
    } catch (err) {
      setAcademicError(err instanceof Error ? err.message : "学术搜索失败");
    } finally {
      setAcademicLoading(false);
    }
  }, [academicQuery, academicPlatforms]);

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
    const base = { key: cat.key, label: cat.label };
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
        <header className="knowledge-header">
          <div>
            <div className="skeleton" style={{ width: 140, height: 12, marginBottom: 8, borderRadius: "var(--radius-pill)" }} />
            <div className="skeleton skeleton-title" style={{ width: 180 }} />
          </div>
          <div className="skeleton" style={{ width: 200, height: 36 }} />
        </header>
        <section className="knowledge-categories">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="skeleton" style={{ width: 96, height: 32, borderRadius: "var(--radius-pill)", flexShrink: 0 }} />
          ))}
        </section>
        <div className="knowledge-body">
          <div>
            <div className="skeleton skeleton-title" />
            {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12 }} />)}
          </div>
          <div>
            <div className="skeleton skeleton-title" />
            {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}
          </div>
          <aside>
            <div className="skeleton skeleton-title" />
            <div className="skeleton" style={{ height: 200 }} />
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="knowledge-shell">
      <header className="knowledge-header">
        <div>
          <p className="eyebrow">Knowledge Operating System</p>
          <h1>知识 OS</h1>
        </div>
        <div className="knowledge-project-selector">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="knowledge-select form-select"
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
            <span className="category-icon">{getCategoryIcon(cat.key)}</span>
            <span className="category-label">{cat.label}</span>
            <span className="category-count">{cat.count}</span>
          </button>
        ))}
      </section>

      {selectedProjectId && (
        <section className="knowledge-paper-section">
          <div className="knowledge-section-title">论文精读</div>
          <button
            className="btn-primary"
            onClick={handlePaperRead}
            disabled={paperLoading}
            style={{ marginBottom: 16 }}
          >
            {paperLoading ? "精读中…" : paperComparing ? "对比分析中…" : "开始精读"}
          </button>
          {paperReadingResult && (
            <div className="capsule-card" style={{ marginBottom: 12 }}>
              <div className="capsule-card-header">
                <span className="capsule-type-badge">论文精读</span>
                <span className={`reuse-status reuse-status-${paperReadingResult.responsibilityColor === "yellow" ? "pending_confirmation" : "saved"}`}>
                  {paperReadingResult.responsibilityColor === "yellow" ? "需核验" : "可溯源"}
                </span>
              </div>
              <div className="capsule-card-title">{paperReadingResult.fileName}</div>
              <div className="capsule-card-summary" style={{ whiteSpace: "pre-wrap" }}>
                {paperReadingResult.researchQuestion && `研究问题：${paperReadingResult.researchQuestion}\n`}
                {paperReadingResult.backgroundMotivation && `背景动机：${paperReadingResult.backgroundMotivation}\n`}
                {paperReadingResult.methodFramework && `方法框架：${paperReadingResult.methodFramework}\n`}
                {paperReadingResult.dataset && `数据集：${paperReadingResult.dataset}\n`}
                {paperReadingResult.results && `结果：${paperReadingResult.results}\n`}
                {paperReadingResult.contributions && `贡献：${paperReadingResult.contributions}\n`}
                {paperReadingResult.limitations && `局限：${paperReadingResult.limitations}`}
              </div>
            </div>
          )}
          {paperCompareResult && (
            <div className="capsule-card" style={{ marginBottom: 12 }}>
              <div className="capsule-card-header">
                <span className="capsule-type-badge">论文对比</span>
              </div>
              <div className="capsule-card-summary" style={{ whiteSpace: "pre-wrap" }}>
                {paperCompareResult.methodCategories.length > 0 && `方法分类：${paperCompareResult.methodCategories.join("、")}\n`}
                {paperCompareResult.disputes.length > 0 && `争议点：${paperCompareResult.disputes.join("、")}\n`}
                {paperCompareResult.researchGaps.length > 0 && `研究空白：${paperCompareResult.researchGaps.join("、")}`}
              </div>
            </div>
          )}
          {paperMatrixResult && paperMatrixResult.rows.length > 0 && (
            <div className="capsule-card">
              <div className="capsule-card-header">
                <span className="capsule-type-badge">对比矩阵</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid var(--border-subtle)", padding: "6px 8px", textAlign: "left" }}>维度</th>
                      {Object.keys(paperMatrixResult.rows[0]?.values ?? {}).map((col) => (
                        <th key={col} style={{ border: "1px solid var(--border-subtle)", padding: "6px 8px", textAlign: "left" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paperMatrixResult.rows.map((row) => (
                      <tr key={row.dimension}>
                        <td style={{ border: "1px solid var(--border-subtle)", padding: "6px 8px", fontWeight: 600 }}>{row.dimension}</td>
                        {Object.values(row.values).map((val, i) => (
                          <td key={i} style={{ border: "1px solid var(--border-subtle)", padding: "6px 8px" }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="knowledge-paper-section" style={{ marginTop: 16 }}>
        <div className="knowledge-section-title">学术搜索 (SenseNova)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="输入关键词搜索学术论文..."
            value={academicQuery}
            onChange={(e) => setAcademicQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAcademicSearch(); }}
            style={{ flex: 1, minWidth: 200, padding: "6px 12px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 14 }}
          />
          <select
            multiple
            value={academicPlatforms}
            onChange={(e) => setAcademicPlatforms(Array.from(e.target.selectedOptions, (o) => o.value))}
            style={{ padding: "6px 8px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 13, minWidth: 160, height: 36 }}
          >
            <option value="arxiv">ArXiv</option>
            <option value="semantic_scholar">Semantic Scholar</option>
            <option value="pubmed">PubMed</option>
          </select>
          <button
            className="btn-primary"
            onClick={handleAcademicSearch}
            disabled={academicLoading || !academicQuery.trim()}
          >
            {academicLoading ? "搜索中..." : "搜索"}
          </button>
        </div>
        {academicError && <div className="command-error" style={{ marginBottom: 8 }}>{academicError}</div>}
        {academicResults && academicResults.length === 0 && !academicLoading && (
          <div className="knowledge-empty">未找到相关结果</div>
        )}
        {academicResults && academicResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {academicResults.map((item: any, i: number) => (
              <div key={i} className="capsule-card" style={{ marginBottom: 0 }}>
                <div className="capsule-card-header">
                  <span className="capsule-type-badge">{item.provider ?? item.source ?? "学术"}</span>
                  {item.citation_count != null && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>引用: {item.citation_count}</span>}
                  {item.year && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.year}</span>}
                </div>
                <div className="capsule-card-title">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{item.title}</a>
                  ) : item.title}
                </div>
                {item.snippet && <div className="capsule-card-summary" style={{ fontSize: 13 }}>{item.snippet.slice(0, 200)}{item.snippet.length > 200 ? "..." : ""}</div>}
                {item.authors && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{Array.isArray(item.authors) ? item.authors.join(", ") : item.authors}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="knowledge-graph-section">
        <button className="knowledge-graph-toggle" onClick={() => setShowGraph(!showGraph)}>
          {showGraph ? "收起知识图谱" : "展开知识图谱"}
          <span style={{ transform: showGraph ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </button>
        {showGraph && capsules.length > 0 && (
          <div className="knowledge-graph-container">
            <svg width="100%" height="300" viewBox="0 0 800 300">
              {/* Draw links between same-type capsules */}
              {capsules.flatMap((c1, i) =>
                capsules.slice(i + 1).map((c2, j) => {
                  if (c1.capsuleType !== c2.capsuleType && c1.projectId !== c2.projectId) return null;
                  const angle1 = (2 * Math.PI * i) / capsules.length - Math.PI / 2;
                  const angle2 = (2 * Math.PI * (i + j + 1)) / capsules.length - Math.PI / 2;
                  const x1 = 400 + 150 * Math.cos(angle1);
                  const y1 = 150 + 100 * Math.sin(angle1);
                  const x2 = 400 + 150 * Math.cos(angle2);
                  const y2 = 150 + 100 * Math.sin(angle2);
                  return (
                    <line key={`${c1.id}-${c2.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={c1.capsuleType === c2.capsuleType ? "var(--color-gold)" : "var(--color-border-card)"}
                      strokeWidth={1.5} opacity={0.4} strokeDasharray={c1.projectId === c2.projectId ? "none" : "4 4"} />
                  );
                })
              )}
              {/* Generate nodes in circle layout */}
              {capsules.map((capsule, i) => {
                const angle = (2 * Math.PI * i) / capsules.length - Math.PI / 2;
                const cx = 400 + 150 * Math.cos(angle);
                const cy = 150 + 100 * Math.sin(angle);
                const colors: Record<string, string> = {
                  course_map: "#3b82f6", literature_matrix: "#8b5cf6", experiment_log: "#10b981",
                  error_attribution: "#ef4444", user_preference: "#f59e0b", mentor_preference: "#ec4899",
                };
                const fill = colors[capsule.capsuleType] ?? "#6b7280";
                return (
                  <g key={capsule.id} style={{ cursor: "pointer" }}>
                    <circle cx={cx} cy={cy} r={20} fill={fill} opacity={0.8} stroke="#fff" strokeWidth={2} />
                    <text x={cx} y={cy + 35} textAnchor="middle" fontSize={11} fill="var(--color-text-body)">
                      {capsule.title.length > 10 ? capsule.title.slice(0, 10) + "..." : capsule.title}
                    </text>
                  </g>
                );
              })}
            </svg>
            {/* Legend */}
            <div className="knowledge-graph-legend">
              <span>● 同类型</span> <span style={{ color: "var(--color-gold)" }}>———</span>
              <span style={{ marginLeft: 16 }}>● 同项目</span> <span>- - -</span>
            </div>
          </div>
        )}
      </section>

      <div className="knowledge-body">
        <section className="knowledge-reuse">
          <div className="knowledge-section-title">智能复用推荐</div>
          {filteredCandidates.length === 0 && (
            <div className="knowledge-empty">暂无推荐</div>
          )}
          {filteredCandidates.map((candidate) => (
            <div key={candidate.id} className={`reuse-card reuse-type-${candidate.memoryType}`}>
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
