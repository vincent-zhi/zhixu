"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listProjects,
  listHumanGates,
  listAgentJobs,
  checkWatcher,
  listTasks,
  listCapsules,
  confirmHumanGate,
  type WatcherCheckResult,
  type KnowledgeCapsuleSummary,
} from "../api-client";
import type {
  ProjectSummary,
  HumanGateSummary,
  AgentJobSummary,
  TaskSummary,
} from "@zhixu/core";

interface GateWithContext extends HumanGateSummary {
  projectTitle: string;
  projectId: string;
}

interface TaskWithContext extends TaskSummary {
  projectTitle: string;
}

interface CapsuleWithContext extends KnowledgeCapsuleSummary {
  projectTitle: string;
}

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

const STATUS_LABELS: Record<string, string> = {
  captured: "已捕获",
  understanding: "理解中",
  planned: "已规划",
  preparing: "准备中",
  waiting_user: "等待确认",
  executing: "执行中",
  verifying: "验证中",
  ready_to_deliver: "可交付",
  tracking: "追踪中",
  completed: "已完成",
  archived: "已归档",
  risk: "风险",
  failed: "失败",
};

function jobProgress(status: string): number {
  switch (status) {
    case "queued":
      return 10;
    case "running":
      return 55;
    case "waiting_human":
      return 80;
    case "completed":
      return 100;
    case "failed":
      return 0;
    default:
      return 0;
  }
}

function formatTimeRemaining(dueAt: string | null): string {
  if (!dueAt) return "";
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff < 0) return "已过期";
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function TodayPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pendingGates, setPendingGates] = useState<GateWithContext[]>([]);
  const [agentJobs, setAgentJobs] = useState<AgentJobSummary[]>([]);
  const [watcherResults, setWatcherResults] = useState<WatcherCheckResult[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskWithContext[]>([]);
  const [capsules, setCapsules] = useState<CapsuleWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsData, jobsData, watcherData] = await Promise.all([
        listProjects(),
        listAgentJobs(),
        checkWatcher(),
      ]);
      setProjects(projectsData);
      setAgentJobs(jobsData);
      setWatcherResults(watcherData);

      const activeProjects = projectsData.filter(
        (p) => !["completed", "archived", "failed"].includes(p.status)
      );

      const [gateResults, taskResults, capsuleResults] = await Promise.all([
        Promise.all(
          activeProjects.map(async (p) => {
            try {
              const gates = await listHumanGates(p.id);
              return gates
                .filter((g) => g.status === "pending")
                .map((g) => ({ ...g, projectTitle: p.title, projectId: p.id }));
            } catch {
              return [] as GateWithContext[];
            }
          })
        ),
        Promise.all(
          activeProjects.map(async (p) => {
            try {
              const tasks = await listTasks(p.id);
              return tasks
                .filter((t) => t.status !== "completed")
                .map((t) => ({ ...t, projectTitle: p.title }));
            } catch {
              return [] as TaskWithContext[];
            }
          })
        ),
        Promise.all(
          activeProjects.map(async (p) => {
            try {
              const caps = await listCapsules(p.id);
              return caps.map((c) => ({ ...c, projectTitle: p.title }));
            } catch {
              return [] as CapsuleWithContext[];
            }
          })
        ),
      ]);

      setPendingGates(gateResults.flat());
      setTodayTasks(taskResults.flat().sort((a, b) => b.priority - a.priority));
      setCapsules(capsuleResults.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirm = async (gateId: string) => {
    setConfirming(gateId);
    try {
      await confirmHumanGate(gateId, { confirmedBy: "user" });
      setPendingGates((prev) => prev.filter((g) => g.id !== gateId));
    } catch (err) {
      console.error("Failed to confirm gate:", err);
    } finally {
      setConfirming(null);
    }
  };

  const buildSummaryText = (): string => {
    if (projects.length === 0) {
      return "还没有进行中的项目。去创建一个新任务吧。";
    }

    const parts: string[] = [];

    if (pendingGates.length > 0) {
      parts.push(`有 ${pendingGates.length} 件事需要你确认`);
    }

    for (const project of projects) {
      const label = STATUS_LABELS[project.status] ?? project.status;
      if (["planned", "preparing", "waiting_user"].includes(project.status)) {
        parts.push(`${project.title}${label}`);
      }
    }

    const runningJobs = agentJobs.filter((j) => j.status === "running" || j.status === "queued");
    if (runningJobs.length > 0) {
      parts.push(`${runningJobs.length} 个 AI 任务正在处理`);
    }

    const criticalIssues = watcherResults
      .flatMap((r) => r.issues)
      .filter((i) => i.severity === "critical" || i.severity === "warning");
    if (criticalIssues.length > 0) {
      parts.push(`${criticalIssues.length} 个风险需要关注`);
    }

    if (parts.length === 0) {
      return "今天一切顺利，没有需要特别关注的事项。";
    }

    return `今天${parts.join("；")}。`;
  };

  const runningJobs = agentJobs.filter(
    (j) => j.status === "running" || j.status === "queued"
  );

  const allIssues = watcherResults.flatMap((r) => r.issues);
  const riskIssues = allIssues.filter(
    (i) => i.severity === "critical" || i.severity === "warning"
  );

  const parsedFiles = agentJobs.filter(
    (j) => j.jobType === "parse_source" && j.status === "completed"
  ).length;

  const stats = [
    { label: "资料已解析", value: parsedFiles },
    { label: "AI 处理中", value: runningJobs.length },
    { label: "待确认", value: pendingGates.length },
    { label: "风险", value: riskIssues.length },
  ];

  if (loading) {
    return (
      <main className="shell">
        <div className="today-loading">
          <div className="today-loading-spinner" />
          <p>正在加载今日概览…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <div className="today-error">
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchData}>
            重试
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="brief-card">
        <div className="brief-left">
          <p className="eyebrow">Agent Daily Brief</p>
          <p className="brief-text">{buildSummaryText()}</p>
        </div>
        <div className="brief-right">
          {stats.map((s) => (
            <div key={s.label} className="brief-stat">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="today-columns">
        <div className="today-column">
          <h2 className="today-column-title">
            <span className="dot dot-yellow" />
            待你确认
          </h2>
          <div className="today-column-list">
            {pendingGates.length === 0 && (
              <p className="empty-state">暂无待确认事项</p>
            )}
            {pendingGates.map((gate) => (
              <article key={gate.id} className="confirm-item">
                <div className="confirm-item-top">
                  <strong>{gate.gateType}</strong>
                  <span className={`risk-badge risk-${gate.riskLevel.toLowerCase()}`}>
                    {gate.riskLevel}
                  </span>
                </div>
                <p className="confirm-item-reason">{gate.reason}</p>
                <div className="confirm-item-meta">
                  <span className="confirm-project">{gate.projectTitle}</span>
                  <button
                    className="btn-confirm"
                    disabled={confirming === gate.id}
                    onClick={() => handleConfirm(gate.id)}
                  >
                    {confirming === gate.id ? "确认中…" : "去确认"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="today-column">
          <h2 className="today-column-title">
            <span className="dot dot-blue" />
            AI 正在处理
          </h2>
          <div className="today-column-list">
            {runningJobs.length === 0 && (
              <p className="empty-state">当前没有 AI 任务在处理</p>
            )}
            {runningJobs.map((job) => (
              <article key={job.id} className="processing-item">
                <div className="processing-item-top">
                  <strong>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</strong>
                  <span className={`status-badge status-${job.status}`}>
                    {job.status === "running" ? "处理中" : "排队中"}
                  </span>
                </div>
                <div className="processing-bar-track">
                  <div
                    className="processing-bar-fill"
                    style={{ width: `${jobProgress(job.status)}%` }}
                  />
                </div>
                <div className="processing-item-meta">
                  <span>{job.projectId.slice(0, 8)}</span>
                  {job.output?.confidence != null && (
                    <span>置信度 {Math.round(job.output.confidence * 100)}%</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="today-column">
          <h2 className="today-column-title">
            <span className="dot dot-green" />
            今天要做
          </h2>
          <div className="today-column-list">
            {todayTasks.length === 0 && (
              <p className="empty-state">暂无待办任务</p>
            )}
            {todayTasks.map((task) => (
              <article key={task.id} className="task-item-today">
                <div className="task-today-top">
                  <label className="task-today-check">
                    <input type="checkbox" disabled />
                    <strong>{task.title}</strong>
                  </label>
                  {task.dueAt && (
                    <span className="task-today-time">
                      {formatTimeRemaining(task.dueAt)}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="task-today-desc">{task.description}</p>
                )}
                <div className="task-today-meta">
                  <span>{task.projectTitle}</span>
                  <span className={`risk-badge risk-${task.riskLevel.toLowerCase()}`}>
                    {task.riskLevel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="today-bottom">
        <div className="risk-section">
          <h2>风险提醒</h2>
          <div className="risk-list">
            {riskIssues.length === 0 && (
              <p className="empty-state">暂无风险提醒</p>
            )}
            {riskIssues.map((issue, i) => (
              <article
                key={`${issue.targetId}-${i}`}
                className={`risk-item risk-item-${issue.severity}`}
              >
                <div className="risk-item-top">
                  <span className={`severity-dot severity-${issue.severity}`} />
                  <strong>
                    {issue.severity === "critical" ? "严重" : "警告"}
                  </strong>
                </div>
                <p>{issue.message}</p>
                <div className="risk-item-meta">
                  <span>{issue.targetType}：{issue.targetId.slice(0, 8)}</span>
                  <Link
                    href={`/projects/${issue.targetId}`}
                    className="btn-risk-action"
                  >
                    处理
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="reuse-section">
          <h2>复用建议</h2>
          <div className="reuse-list">
            {capsules.length === 0 && (
              <p className="empty-state">暂无可用知识胶囊</p>
            )}
            {capsules.map((capsule) => (
              <article key={capsule.id} className="reuse-item">
                <div className="reuse-item-top">
                  <strong>{capsule.title}</strong>
                  <span className="reuse-badge">
                    已复用 {capsule.reuseCount} 次
                  </span>
                </div>
                <p className="reuse-item-summary">{capsule.summary}</p>
                <div className="reuse-item-meta">
                  <span>{capsule.projectTitle}</span>
                  <span className="reuse-type">{capsule.capsuleType}</span>
                  <Link
                    href={`/projects/${capsule.projectId}`}
                    className="btn-reuse"
                  >
                    复用胶囊
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
