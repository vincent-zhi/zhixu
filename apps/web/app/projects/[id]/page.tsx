"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  listSources,
  listTasks,
  listEvidence,
  listHumanGates,
  transitionProject,
  confirmHumanGate,
  postProjectEvent,
} from "../../api-client";
import type {
  ProjectDetail,
  SourceSummary,
  TaskSummary,
  HumanGateSummary,
  ProjectStatus,
} from "@zhixu/core";
import type { EvidenceSummary } from "../../api-client";

const STATE_RAIL: {
  key: ProjectStatus;
  label: string;
  owner: string;
}[] = [
  { key: "captured", label: "捕获", owner: "user" },
  { key: "understanding", label: "理解", owner: "ai" },
  { key: "planned", label: "规划", owner: "ai_human" },
  { key: "preparing", label: "准备", owner: "system" },
  { key: "executing", label: "共创", owner: "ai_human" },
  { key: "verifying", label: "核验", owner: "ai" },
  { key: "ready_to_deliver", label: "交付", owner: "user" },
  { key: "completed", label: "归档", owner: "system" },
];

const STATE_ORDER: ProjectStatus[] = [
  "captured",
  "understanding",
  "planned",
  "preparing",
  "executing",
  "verifying",
  "ready_to_deliver",
  "completed",
];

const QUICK_ACTIONS = [
  { label: "继续推进", trigger: "advance" },
  { label: "下一任务", trigger: "next_task" },
  { label: "生成大纲", trigger: "generate_outline" },
  { label: "进入Canvas", trigger: "enter_canvas" },
  { label: "查引用", trigger: "check_citations" },
  { label: "推进结课", trigger: "advance_delivery" },
  { label: "压缩交付", trigger: "compress_delivery" },
  { label: "可交成果", trigger: "deliverable_check" },
  { label: "模拟答辩", trigger: "simulate_defense" },
  { label: "提取知识胶囊", trigger: "extract_capsule" },
];

type ContextTab = "sources" | "evidence" | "tasks" | "activity" | "collab";

function getStateIndex(status: ProjectStatus): number {
  const idx = STATE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([]);
  const [gates, setGates] = useState<HumanGateSummary[]>([]);
  const [contextTab, setContextTab] = useState<ContextTab>("sources");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [confirmingGateId, setConfirmingGateId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, s, t, e, g] = await Promise.all([
        getProject(projectId),
        listSources(projectId),
        listTasks(projectId),
        listEvidence(projectId),
        listHumanGates(projectId),
      ]);
      setProject(p);
      setSources(s);
      setTasks(t);
      setEvidence(e);
      setGates(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleTransition = useCallback(
    async (targetStatus: ProjectStatus) => {
      if (!project || transitioning) return;
      try {
        setTransitioning(true);
        await transitionProject(projectId, { trigger: `transition_to_${targetStatus}` });
        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "状态转换失败");
      } finally {
        setTransitioning(false);
      }
    },
    [project, projectId, transitioning, loadAll]
  );

  const handleConfirmGate = useCallback(
    async (gateId: string) => {
      try {
        await confirmHumanGate(gateId, { confirmedBy: "current_user" });
        setConfirmingGateId(null);
        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "确认失败");
      }
    },
    [loadAll]
  );

  const handleQuickAction = useCallback(
    async (trigger: string) => {
      if (!project) return;
      try {
        const eventTypeMap: Record<string, string> = {
          advance: "user_goal_submitted",
          next_task: "user_goal_submitted",
          generate_outline: "user_goal_submitted",
          enter_canvas: "artifact_block_updated",
          check_citations: "user_goal_submitted",
          advance_delivery: "user_goal_submitted",
          compress_delivery: "artifact_block_updated",
          deliverable_check: "user_goal_submitted",
          simulate_defense: "user_goal_submitted",
          extract_capsule: "project_completed",
        };
        await postProjectEvent(projectId, {
          eventType: (eventTypeMap[trigger] ?? "user_goal_submitted") as ProjectDetail extends null
            ? never
            : "source_intake_requested" | "user_goal_submitted" | "artifact_block_updated" | "human_gate_confirmed" | "project_completed",
          actorId: "current_user",
          payload: { trigger },
        });
        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失败");
      }
    },
    [project, projectId, loadAll]
  );

  const handleCommandSubmit = useCallback(() => {
    if (!command.trim()) return;
    setCommand("");
    loadAll();
  }, [command, loadAll]);

  if (loading && !project) {
    return (
      <main className="workspace-shell">
        <div className="workspace-loading">加载中…</div>
      </main>
    );
  }

  if (error && !project) {
    return (
      <main className="workspace-shell">
        <div className="workspace-error">
          <p>{error}</p>
          <button onClick={loadAll} className="btn-primary">重试</button>
        </div>
      </main>
    );
  }

  if (!project) return null;

  const currentIdx = getStateIndex(project.status as ProjectStatus);

  const pendingGates = gates.filter((g) => g.status !== "confirmed");
  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "archived");

  const activityLog = project.auditLogs
    ? [...project.auditLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const collabItems = project.agentJobs
    ? [...project.agentJobs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <Link href="/" className="back-link">← 返回首页</Link>
        <div className="workspace-header-info">
          <h1>{project.title}</h1>
          <div className="workspace-header-meta">
            <span className={`status-badge status-${project.status}`}>
              {project.status.replaceAll("_", " ")}
            </span>
            <span className={`risk-badge risk-${project.riskLevel.toLowerCase()}`}>
              {project.riskLevel}
            </span>
            {project.dueDate && <span>截止：{formatDt(project.dueDate)}</span>}
            <span>下一步：{project.nextAction}</span>
          </div>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="workspace-rail">
          <div className="rail-title">状态轨道</div>
          <div className="rail-track">
            {STATE_RAIL.map((state, idx) => {
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isPending = idx > currentIdx;
              const dotClass = isCompleted
                ? "rail-dot rail-dot-completed"
                : isCurrent
                ? "rail-dot rail-dot-current"
                : "rail-dot rail-dot-pending";

              const lineClass =
                idx < STATE_RAIL.length - 1
                  ? idx < currentIdx
                    ? "rail-line rail-line-completed"
                    : idx === currentIdx
                    ? "rail-line rail-line-active"
                    : "rail-line rail-line-pending"
                  : undefined;

              const gateForState = pendingGates.find(
                (g) => g.gateType.toLowerCase().includes(state.key)
              );
              const taskForState = activeTasks.find(
                (t) => t.title.toLowerCase().includes(state.label)
              );

              return (
                <div key={state.key} className="rail-node">
                  <div className="rail-visual">
                    <div className={dotClass} />
                    {lineClass && <div className={lineClass} />}
                  </div>
                  <div className={`rail-info ${isCurrent ? "rail-info-current" : ""}`}>
                    <div className="rail-label-row">
                      <span className="rail-label">{state.label}</span>
                      <span className="rail-owner">{state.owner}</span>
                    </div>
                    {isCurrent && (
                      <div className="rail-detail">
                        {gateForState && (
                          <div className="rail-blocker">
                            <span className="rail-blocker-icon">⚠</span>
                            <span>{gateForState.reason}</span>
                          </div>
                        )}
                        {taskForState && (
                          <div className="rail-task-ref">
                            <span>任务：{taskForState.title}</span>
                          </div>
                        )}
                        {!gateForState && !taskForState && (
                          <div className="rail-detail-empty">当前阶段</div>
                        )}
                      </div>
                    )}
                    {isCompleted && (
                      <div className="rail-detail rail-detail-done">已完成</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {currentIdx < STATE_RAIL.length - 1 && (
            <button
              className="btn-primary rail-advance-btn"
              disabled={transitioning}
              onClick={() => handleTransition(STATE_ORDER[currentIdx + 1]!)}
            >
              {transitioning ? "推进中…" : `推进至 ${STATE_RAIL[currentIdx + 1]?.label ?? "下一阶段"}`}
            </button>
          )}
        </aside>

        <section className="workspace-center">
          <div className="center-title">交互时间线</div>

          {pendingGates.length > 0 && (
            <div className="center-section">
              <div className="center-section-label">待确认 Gate</div>
              {pendingGates.map((gate) => (
                <div key={gate.id} className="work-card work-card-gate">
                  <div className="work-card-header">
                    <span className={`risk-badge risk-${gate.riskLevel.toLowerCase()}`}>
                      {gate.riskLevel}
                    </span>
                    <strong>{gate.gateType}</strong>
                    <span className="gate-status gate-pending">待确认</span>
                  </div>
                  <p className="work-card-body">{gate.reason}</p>
                  <div className="work-card-actions">
                    <button
                      className="btn-primary btn-sm"
                      disabled={confirmingGateId === gate.id}
                      onClick={() => handleConfirmGate(gate.id)}
                    >
                      {confirmingGateId === gate.id ? "确认中…" : "确认通过"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {project.agentJobs && project.agentJobs.length > 0 && (
            <div className="center-section">
              <div className="center-section-label">Agent 作业</div>
              {project.agentJobs
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .map((job) => (
                  <div key={job.id} className="work-card work-card-agent">
                    <div className="work-card-header">
                      <span className={`status-badge status-${job.status}`}>
                        {job.status.replaceAll("_", " ")}
                      </span>
                      <strong>{job.jobType.replaceAll("_", " ")}</strong>
                    </div>
                    {job.output && (
                      <div className="work-card-body">
                        <div className="agent-confidence">
                          置信度：{Math.round(job.output.confidence * 100)}%
                        </div>
                        {job.output.riskFlags.length > 0 && (
                          <div className="agent-flags">
                            风险标记：{job.output.riskFlags.join("、")}
                          </div>
                        )}
                        {job.output.nextActions.length > 0 && (
                          <div className="agent-next">
                            建议操作：{job.output.nextActions.join("、")}
                          </div>
                        )}
                        {job.output.requiredConfirmations.length > 0 && (
                          <div className="agent-confirm">
                            需确认：{job.output.requiredConfirmations.join("、")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {project.artifacts.length > 0 && (
            <div className="center-section">
              <div className="center-section-label">交付物卡片</div>
              {project.artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/studio/${artifact.id}?projectId=${projectId}`}
                  className="work-card work-card-artifact"
                >
                  <div className="work-card-header">
                    <span className={`status-badge status-${artifact.status}`}>
                      {artifact.status}
                    </span>
                    <strong>{artifact.title}</strong>
                    <span className="artifact-coverage">
                      证据覆盖 {Math.round(artifact.evidenceCoverage * 100)}%
                    </span>
                  </div>
                  <div className="work-card-body">
                    <div className="artifact-block-summary">
                      {artifact.blocks.length} 个内容块
                      {artifact.blocks.filter((b) => b.responsibilityColor === "green").length >
                        0 && (
                        <span className="resp-count resp-count-green">
                          {
                            artifact.blocks.filter(
                              (b) => b.responsibilityColor === "green"
                            ).length
                          }
                          绿
                        </span>
                      )}
                      {artifact.blocks.filter((b) => b.responsibilityColor === "yellow")
                        .length > 0 && (
                        <span className="resp-count resp-count-yellow">
                          {
                            artifact.blocks.filter(
                              (b) => b.responsibilityColor === "yellow"
                            ).length
                          }
                          黄
                        </span>
                      )}
                      {artifact.blocks.filter((b) => b.responsibilityColor === "gray").length >
                        0 && (
                        <span className="resp-count resp-count-gray">
                          {
                            artifact.blocks.filter(
                              (b) => b.responsibilityColor === "gray"
                            ).length
                          }
                          灰
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {activityLog.length > 0 && (
            <div className="center-section">
              <div className="center-section-label">最近活动</div>
              {activityLog.slice(0, 10).map((log) => (
                <div key={log.id} className="work-card work-card-activity">
                  <span className="activity-time">{formatDt(log.createdAt)}</span>
                  <span className="activity-action">{log.action}</span>
                  <span className="activity-actor">{log.actorId}</span>
                </div>
              ))}
            </div>
          )}

          {pendingGates.length === 0 &&
            (!project.agentJobs || project.agentJobs.length === 0) &&
            project.artifacts.length === 0 &&
            activityLog.length === 0 && (
              <div className="center-empty">暂无交互记录</div>
            )}
        </section>

        <aside className="workspace-context">
          <div className="context-tabs">
            {(
              [
                { key: "sources", label: "资料" },
                { key: "evidence", label: "证据" },
                { key: "tasks", label: "任务" },
                { key: "activity", label: "活动" },
                { key: "collab", label: "协作" },
              ] as { key: ContextTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                className={`context-tab ${contextTab === tab.key ? "context-tab-active" : ""}`}
                onClick={() => setContextTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="context-content">
            {contextTab === "sources" && (
              <div className="context-list">
                {sources.length === 0 && (
                  <p className="empty-state">暂无资料</p>
                )}
                {sources.map((s) => (
                  <div key={s.id} className="context-item">
                    <div className="context-item-main">
                      <strong>{s.fileName}</strong>
                      <span className={`status-badge status-${s.parseStatus}`}>
                        {s.parseStatus}
                      </span>
                    </div>
                    <div className="context-item-meta">
                      <span>{s.fileType}</span>
                      <span>OCR：{s.ocrStatus}</span>
                      <span>索引：{s.indexStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contextTab === "evidence" && (
              <div className="context-list">
                {evidence.length === 0 && (
                  <p className="empty-state">暂无证据</p>
                )}
                {evidence.map((e) => (
                  <div
                    key={e.id}
                    className={`context-item evidence-item resp-${e.responsibilityColor}`}
                  >
                    <div className="context-item-main">
                      <strong>{e.evidenceType}</strong>
                      <span className={`status-badge status-${e.verificationStatus}`}>
                        {e.verificationStatus}
                      </span>
                    </div>
                    {e.quoteText && (
                      <p className="evidence-quote">"{e.quoteText}"</p>
                    )}
                    <div className="context-item-meta">
                      <span>置信度：{Math.round(e.confidence * 100)}%</span>
                      <span>权责：{e.responsibilityColor}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contextTab === "tasks" && (
              <div className="context-list">
                {tasks.length === 0 && (
                  <p className="empty-state">暂无任务</p>
                )}
                {tasks.map((t) => (
                  <div key={t.id} className="context-item">
                    <div className="context-item-main">
                      <strong>{t.title}</strong>
                      <span className={`status-badge status-${t.status}`}>
                        {t.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {t.description && (
                      <p className="context-item-desc">{t.description}</p>
                    )}
                    <div className="context-item-meta">
                      <span>负责人：{t.assigneeType}</span>
                      <span>权责：{t.responsibilityLabel}</span>
                      <span className={`risk-badge risk-${t.riskLevel.toLowerCase()}`}>
                        {t.riskLevel}
                      </span>
                      {t.dueAt && <span>截止：{formatDt(t.dueAt)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contextTab === "activity" && (
              <div className="context-list">
                {activityLog.length === 0 && (
                  <p className="empty-state">暂无活动记录</p>
                )}
                {activityLog.slice(0, 30).map((log) => (
                  <div key={log.id} className="context-item context-activity-item">
                    <span className="activity-time">{formatDt(log.createdAt)}</span>
                    <span className="activity-action">{log.action}</span>
                    <span className="activity-actor">{log.actorId}</span>
                    <span className="activity-target">
                      {log.targetType}{log.targetId ? `：${log.targetId.slice(0, 8)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {contextTab === "collab" && (
              <div className="context-list">
                {collabItems.length === 0 && (
                  <p className="empty-state">暂无协作记录</p>
                )}
                {collabItems.map((job) => (
                  <div key={job.id} className="context-item">
                    <div className="context-item-main">
                      <strong>{job.jobType.replaceAll("_", " ")}</strong>
                      <span className={`status-badge status-${job.status}`}>
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="context-item-meta">
                      <span>追踪：{job.traceId.slice(0, 8)}</span>
                      <span>{formatDt(job.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="workspace-command">
        <div className="command-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.trigger}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action.trigger)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="command-input-row">
          <input
            type="text"
            className="command-input"
            placeholder="输入指令…"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommandSubmit();
            }}
          />
          <button className="btn-primary command-send" onClick={handleCommandSubmit}>
            发送
          </button>
        </div>
        {error && <div className="command-error">{error}</div>}
      </footer>
    </main>
  );
}
