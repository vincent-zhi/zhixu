"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listProjects, listArtifacts } from "../api-client";
import type { ProjectSummary, ArtifactSummary } from "@zhixu/core";

export default function StudioIndexPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listProjects();
        setProjects(data);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="page-loading">加载中…</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Artifact Studio</h1>
        <p className="page-header-sub">选择一个项目，进入创作工作台</p>
      </header>

      {projects.length === 0 ? (
        <div className="page-empty">
          <p>暂无项目</p>
          <Link href="/capture" className="btn-primary" style={{ marginTop: 12, display: "inline-block" }}>
            创建项目
          </Link>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} href={`/studio/${project.id}`} className="card-flat" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <strong style={{ color: "var(--color-text-title)", fontSize: "0.95rem" }}>{project.title}</strong>
                <span className={`status-badge status-${project.status}`}>
                  {project.status === "executing" ? "进行中" : project.status === "completed" ? "已完成" : project.status === "captured" ? "已捕获" : project.status}
                </span>
              </div>
              <div className="context-item-meta">
                <span>{project.nextAction}</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <span className="btn-secondary btn-sm">进入 Studio →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
