"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconDownload, IconEye, IconTrash, IconWarning } from "../icons";
import { listMaterials, deleteSource, type MaterialItem } from "../api-client";

/* ---------- constants ---------- */

const FILE_TYPE_FILTERS = [
  { label: "全部", value: "all" },
  { label: "PDF", value: "pdf" },
  { label: "PPT", value: "ppt" },
  { label: "Word", value: "doc" },
  { label: "图片", value: "img" },
  { label: "Markdown", value: "md" },
  { label: "其他", value: "other" },
] as const;

const FILE_TYPE_ICONS: Record<string, { label: string; cls: string }> = {
  pdf: { label: "PDF", cls: "pdf" },
  ppt: { label: "PPT", cls: "ppt" },
  doc: { label: "DOC", cls: "doc" },
  docx: { label: "DOC", cls: "doc" },
  img: { label: "IMG", cls: "img" },
  png: { label: "IMG", cls: "img" },
  jpg: { label: "IMG", cls: "img" },
  jpeg: { label: "IMG", cls: "img" },
  md: { label: "MD", cls: "md" },
  markdown: { label: "MD", cls: "md" },
};

const PARSE_STATUS_LABELS: Record<string, string> = {
  completed: "已解析",
  pending: "待解析",
  parsing: "解析中",
  failed: "解析失败",
};

/* ---------- API ---------- */

async function fetchMaterials(): Promise<MaterialItem[]> {
  return listMaterials();
}

/* ---------- helpers ---------- */

function fileTypeCategory(ft: string): string {
  const lower = ft.toLowerCase();
  if (lower === "pdf") return "pdf";
  if (lower === "ppt" || lower === "pptx") return "ppt";
  if (lower === "doc" || lower === "docx") return "doc";
  if (["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(lower)) return "img";
  if (lower === "md" || lower === "markdown") return "md";
  return "other";
}

function iconForType(ft: string): { label: string; cls: string } {
  const lower = ft.toLowerCase();
  return FILE_TYPE_ICONS[lower] ?? { label: ft.toUpperCase().slice(0, 3), cls: "other" };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}月${day}日`;
  } catch {
    return iso;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function sensitivityLabel(level: string): string {
  switch (level) {
    case "public":
      return "公开";
    case "internal":
      return "内部";
    case "confidential":
      return "机密";
    default:
      return level;
  }
}

/* ---------- skeleton ---------- */

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className ?? ""}`} style={style} />;
}

function MaterialsSkeleton() {
  return (
    <main className="shell">
      <SkeletonBlock style={{ width: 120, height: 12, marginBottom: 8 }} />
      <SkeletonBlock style={{ width: 200, height: 28, marginBottom: 24 }} />
      <div className="materials-filters">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBlock key={i} style={{ width: 48, height: 28, borderRadius: 14 }} />
        ))}
      </div>
      <div className="materials-stats">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ width: 100, height: 14 }} />
        ))}
      </div>
      <div className="materials-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="material-card" style={{ pointerEvents: "none" }}>
            <div className="material-card-header">
              <SkeletonBlock style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <SkeletonBlock style={{ width: "70%", height: 14, marginBottom: 4 }} />
                <SkeletonBlock style={{ width: "40%", height: 11 }} />
              </div>
            </div>
            <SkeletonBlock style={{ width: "100%", height: 12, marginBottom: 8 }} />
            <SkeletonBlock style={{ width: "60%", height: 11 }} />
          </div>
        ))}
      </div>
    </main>
  );
}

/* ---------- page ---------- */

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMaterials();
      setMaterials(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "资料加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(
    async (item: MaterialItem) => {
      if (!window.confirm(`确认删除「${item.fileName}」？此操作不可撤销。`)) return;
      try {
        setDeletingId(item.id);
        await deleteSource(item.projectId, item.id);
        await fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除失败");
      } finally {
        setDeletingId(null);
      }
    },
    [fetchData]
  );

  /* derived data */
  const uniqueProjects = Array.from(
    new Map(materials.map((m) => [m.projectId, m.projectTitle])).entries()
  ).map(([id, title]) => ({ id, title }));

  const filteredMaterials = materials.filter((m) => {
    const cat = fileTypeCategory(m.fileType);
    if (activeFilter !== "all" && cat !== activeFilter) return false;
    if (projectFilter !== "all" && m.projectId !== projectFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !m.fileName.toLowerCase().includes(q) &&
        !m.projectTitle.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalCount = materials.length;
  const completedCount = materials.filter((m) => m.parseStatus === "completed").length;
  const typeBreakdown = FILE_TYPE_FILTERS.filter((f) => f.value !== "all").map((f) => {
    const count = materials.filter((m) => fileTypeCategory(m.fileType) === f.value).length;
    return { label: f.label, count };
  });

  /* loading */
  if (loading) return <MaterialsSkeleton />;

  /* error */
  if (error) {
    return (
      <main className="shell">
        <div className="today-error">
          <div className="today-error-icon">
            <IconWarning size={24} />
          </div>
          <p className="today-error-msg">{error}</p>
          <button className="btn-primary" onClick={fetchData}>
            重新加载
          </button>
        </div>
      </main>
    );
  }

  /* empty */
  if (materials.length === 0) {
    return (
      <main className="shell">
        <div className="materials-header">
          <div>
            <p className="eyebrow">资料管理</p>
            <h1>全局资料库</h1>
          </div>
        </div>
        <div className="empty-state" style={{ marginTop: 80 }}>
          <div className="empty-state-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span>还没有上传任何资料</span>
          <Link href="/capture" className="btn-primary" style={{ marginTop: 12 }}>
            去捕获资料
          </Link>
        </div>
      </main>
    );
  }

  /* main render */
  return (
    <main className="shell">
      <div className="materials-header">
        <div>
          <p className="eyebrow">资料管理</p>
          <h1>全局资料库</h1>
        </div>
      </div>

      {/* filter bar */}
      <div className="materials-filters">
        {FILE_TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`materials-filter-pill ${activeFilter === f.value ? "active" : ""}`}
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </button>
        ))}

        {uniqueProjects.length > 1 && (
          <select
            className="materials-search"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="all">全部项目</option>
            {uniqueProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          className="materials-search"
          placeholder="搜索文件名或项目..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* stats row */}
      <div className="materials-stats">
        <span className="materials-stat">
          共 <strong>{totalCount}</strong> 个文件
        </span>
        <span className="materials-stat">
          已解析 <strong>{completedCount}</strong> / {totalCount}
        </span>
        {typeBreakdown
          .filter((t) => t.count > 0)
          .map((t) => (
            <span key={t.label} className="materials-stat">
              {t.label} <strong>{t.count}</strong>
            </span>
          ))}
      </div>

      {/* materials grid */}
      {filteredMaterials.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <span>没有匹配的资料</span>
        </div>
      ) : (
        <div className="materials-grid">
          {filteredMaterials.map((item) => {
            const icon = iconForType(item.fileType);
            return (
              <article key={item.id} className="material-card">
                <div className="material-card-header">
                  <div className={`material-card-icon ${icon.cls}`}>
                    {icon.label}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="material-card-name" title={item.fileName}>
                      {item.fileName}
                    </div>
                    <div className="material-card-project">{item.projectTitle}</div>
                  </div>
                </div>

                {item.summary && (
                  <p
                    style={{
                      fontSize: "var(--fs-caption)",
                      color: "var(--color-text-secondary)",
                      marginBottom: "var(--space-2)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.summary}
                  </p>
                )}

                <div className="material-card-meta">
                  <span className="material-card-date">{formatDate(item.uploadedAt)}</span>
                  <span
                    className={`parse-status parse-${item.parseStatus === "completed" ? "completed" : item.parseStatus === "failed" ? "failed" : "pending"}`}
                  >
                    {PARSE_STATUS_LABELS[item.parseStatus] ?? item.parseStatus}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "var(--space-2)",
                    paddingTop: "var(--space-2)",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--fs-caption)",
                      color: "var(--color-text-hint)",
                    }}
                  >
                    {sensitivityLabel(item.sensitivityLevel)}
                  </span>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      className="material-action-btn"
                      title="查看"
                      onClick={() => window.open(item.storageUri, "_blank")}
                    >
                      <IconEye size={14} />
                    </button>
                    <button
                      type="button"
                      className="material-action-btn"
                      title="下载"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = item.storageUri;
                        a.download = item.fileName;
                        a.click();
                      }}
                    >
                      <IconDownload size={14} />
                    </button>
                    <button
                      type="button"
                      className="material-action-btn material-action-btn-danger"
                      title="删除"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item)}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
