"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listProjects,
  createProject,
  listAgentJobs,
  ApiClientError,
} from "../api-client";
import type { ProjectSummary, AgentJobSummary } from "@zhixu/core";

type ProjectType = "coursework" | "presentation" | "paper_reading" | "literature_review" | "exam_review" | "experiment" | "research" | "other";

const TYPE_LABELS: Record<string, string> = {
  coursework: "课程作业",
  presentation: "演示文稿",
  paper_reading: "论文阅读",
  literature_review: "文献综述",
  exam_review: "考试复习",
  experiment: "实验",
  research: "研究",
  other: "其他",
};

const RISK_LABELS: Record<string, string> = {
  L0: "低风险",
  L1: "一般风险",
  L2: "较高风险",
  L3: "高风险",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  parse_source: "解析资料",
  build_index: "构建索引",
  generate_summary: "生成摘要",
  detect_task: "检测任务",
  generate_plan: "生成计划",
  verify_output: "验证输出",
  export_artifact: "导出交付物",
  create_capsule: "创建知识胶囊",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [agentJobs, setAgentJobs] = useState<AgentJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    type: ProjectType;
    description: string;
    dueDate: string;
  }>({
    title: "",
    type: "other",
    description: "",
    dueDate: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectData, jobData] = await Promise.all([
        listProjects(),
        listAgentJobs().catch(() => [] as AgentJobSummary[]),
      ]);
      setProjects(projectData);
      setAgentJobs(jobData);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "加载项目列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latestJobByProject = new Map<string, AgentJobSummary>();
  for (const job of agentJobs) {
    const existing = latestJobByProject.get(job.projectId);
    if (!existing || new Date(job.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestJobByProject.set(job.projectId, job);
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      setSubmitting(true);
      await createProject({
        workspaceId: "default",
        ownerId: "current_user",
        title: form.title.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        priority: 3,
        privacyMode: "local_first",
        riskLevel: "L1",
      });
      setShowModal(false);
      setForm({ title: "", type: "other", description: "", dueDate: "" });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "创建项目失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="shell">
        <div className="page-loading">加载项目列表中…</div>
      </main>
    );
  }

  if (error && projects.length === 0) {
    return (
      <main className="shell">
        <div className="page-error">
          <p>{error}</p>
          <button className="btn-primary" onClick={loadData}>重试</button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Link href="/" className="back-link">← 返回首页</Link>

      <div className="projects-shell">
        <header className="projects-header">
          <div>
            <p className="eyebrow">Projects</p>
            <h1>项目列表</h1>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + 新建项目
          </button>
        </header>

        {projects.length === 0 ? (
          <div className="projects-empty">
            <p>还没有项目，点击上方按钮创建你的第一个项目。</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => {
              const lastJob = latestJobByProject.get(project.id);
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="project-grid-card-link"
                >
                  <article className="project-grid-card">
                    <div className="project-grid-card-top">
                      <span className="status-badge status-captured">
                        {TYPE_LABELS[project.type] ?? project.type}
                      </span>
                      <span className={`risk-badge risk-${project.riskLevel.toLowerCase()}`}>
                        {RISK_LABELS[project.riskLevel] ?? project.riskLevel}
                      </span>
                    </div>
                    <h3>{project.title}</h3>
                    <p className="project-grid-next">{project.nextAction}</p>
                    <div className="project-grid-card-meta">
                      <span className={`status-badge status-${project.status}`}>
                        {project.status.replaceAll("_", " ")}
                      </span>
                      <span>{project.dueDate ? `截止：${formatDate(project.dueDate)}` : "长期项目"}</span>
                    </div>
                    {lastJob && (
                      <div className="project-grid-ai-action">
                        <span className="ai-label">AI 最近操作</span>
                        <span>{JOB_TYPE_LABELS[lastJob.jobType] ?? lastJob.jobType}</span>
                        <span className={`status-badge status-${lastJob.status}`}>
                          {lastJob.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    )}
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {error && <p className="page-error-inline">{error}</p>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新建项目</h2>

            <div className="form-group">
              <label className="form-label">项目标题</label>
              <input
                className="form-input"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="输入项目标题"
                maxLength={120}
              />
            </div>

            <div className="form-group">
              <label className="form-label">项目类型</label>
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProjectType }))}
              >
                <option value="presentation">演示文稿</option>
                <option value="coursework">课程作业</option>
                <option value="literature_review">文献综述</option>
                <option value="exam_review">考试复习</option>
                <option value="experiment">实验</option>
                <option value="research">研究</option>
                <option value="paper_reading">论文阅读</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">项目描述</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="简要描述项目目标和范围"
                maxLength={2000}
              />
            </div>

            <div className="form-group">
              <label className="form-label">截止日期</label>
              <input
                className="form-input"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={!form.title.trim() || submitting}
              >
                {submitting ? "创建中…" : "创建项目"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
