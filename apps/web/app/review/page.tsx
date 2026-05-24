"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  listSources,
  listEvidence,
  listHumanGates,
  generatePlan,
  confirmHumanGate,
  checkWatcher,
  type EvidenceSummary,
  type WatcherCheckResult,
} from "../api-client";
import type {
  ProjectDetail,
  SourceSummary,
  HumanGateSummary,
  AgentJobSummary,
} from "@zhixu/core";

interface PlanDirection {
  topic: string;
  value: string | undefined;
  recommendationIndex: number | undefined;
  materialCoverage: number | undefined;
  estimatedPages: number | undefined;
  difficulty: string | undefined;
  risk: string | undefined;
  outline: Array<{ title: string; points: string[] }> | undefined;
}

interface PlanData {
  directions?: PlanDirection[];
  summary?: string;
  suggestedPages?: string;
  presentationType?: string;
}

const TYPE_LABELS: Record<string, string> = {
  presentation: "PPT 演示",
  coursework: "课程作业",
  paper_reading: "论文阅读",
  literature_review: "文献综述",
  exam_review: "考试复习",
  experiment: "实验整理",
  research: "研究项目",
  other: "其他",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function parsePlanData(structuredResult: Record<string, unknown>): PlanData {
  const directions: PlanDirection[] = [];

  const rawDirections = structuredResult.directions;
  if (Array.isArray(rawDirections)) {
    for (const dir of rawDirections) {
      if (typeof dir === "object" && dir !== null) {
        const d = dir as Record<string, unknown>;
        directions.push({
          topic: (d.topic as string) ?? "",
          value: (d.value as string) || undefined,
          recommendationIndex: (d.recommendationIndex as number) || undefined,
          materialCoverage: (d.materialCoverage as number) || undefined,
          estimatedPages: (d.estimatedPages as number) || undefined,
          difficulty: (d.difficulty as string) || undefined,
          risk: (d.risk as string) || undefined,
          outline: Array.isArray(d.outline)
            ? (d.outline as Array<Record<string, unknown>>).map((o) => ({
                title: (o.title as string) ?? "",
                points: Array.isArray(o.points)
                  ? (o.points as string[])
                  : [],
              }))
            : undefined,
        });
      }
    }
  }

  return {
    directions,
    summary: (structuredResult.summary as string) ?? undefined,
    suggestedPages: (structuredResult.suggestedPages as string) ?? undefined,
    presentationType: (structuredResult.presentationType as string) ?? undefined,
  };
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([]);
  const [gates, setGates] = useState<HumanGateSummary[]>([]);
  const [watcherResult, setWatcherResult] = useState<WatcherCheckResult | null>(null);
  const [planJob, setPlanJob] = useState<AgentJobSummary | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectData, sourcesData, evidenceData, gatesData] =
        await Promise.all([
          getProject(projectId),
          listSources(projectId),
          listEvidence(projectId),
          listHumanGates(projectId),
        ]);

      setProject(projectData);
      setSources(sourcesData);
      setEvidence(evidenceData);
      setGates(gatesData);

      try {
        const watcher = await checkWatcher();
        const projectWatcher = watcher.find((w) => w.projectId === projectId);
        setWatcherResult(projectWatcher ?? null);
      } catch {
        setWatcherResult(null);
      }

      const completedPlanJobs = projectData.agentJobs
        .filter(
          (j) =>
            j.jobType === "generate_plan" &&
            j.status === "completed" &&
            j.output
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      if (completedPlanJobs.length > 0) {
        const latestPlan = completedPlanJobs[0]!;
        setPlanJob(latestPlan);
        if (latestPlan.output) {
          setPlanData(parsePlanData(latestPlan.output.structuredResult));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGeneratePlan = useCallback(async () => {
    if (!projectId || !project) return;
    setGenerating(true);
    try {
      const job = await generatePlan(projectId, {
        goal: project.description ?? project.title,
      });
      setPlanJob(job);

      if (job.output) {
        setPlanData(parsePlanData(job.output.structuredResult));
      }
    } catch (err) {
      console.error("Failed to generate plan:", err);
    } finally {
      setGenerating(false);
    }
  }, [projectId, project]);

  const handleSelectDirection = useCallback((index: number) => {
    setSelectedDirection(index);
  }, []);

  const handleConfirmOutline = useCallback(
    async (gateId: string) => {
      setConfirming(gateId);
      try {
        await confirmHumanGate(gateId, { confirmedBy: "user" });
        setGates((prev) =>
          prev.map((g) =>
            g.id === gateId
              ? { ...g, status: "confirmed", confirmedBy: "user", confirmedAt: new Date().toISOString() }
              : g
          )
        );
      } catch (err) {
        console.error("Failed to confirm gate:", err);
      } finally {
        setConfirming(null);
      }
    },
    []
  );

  const evidenceByColor = {
    green: evidence.filter((e) => e.responsibilityColor === "green"),
    yellow: evidence.filter((e) => e.responsibilityColor === "yellow"),
    gray: evidence.filter((e) => e.responsibilityColor === "gray"),
  };

  const avgConfidence =
    evidence.length > 0
      ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
      : 0;

  const parsedSources = sources.filter((s) => s.parseStatus === "completed");
  const missingInfoIssues = watcherResult?.issues.filter(
    (i) => i.type === "missing_evidence"
  ) ?? [];

  if (!projectId) {
    return (
      <main className="shell">
        <section className="review-empty">
          <h2>选择要查看的项目</h2>
          <p>请从首页选择一个项目，或直接输入项目 ID。</p>
          <Link href="/" className="btn-primary">
            返回首页
          </Link>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="today-loading">
          <div className="today-loading-spinner" />
          <p>正在加载项目详情…</p>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="shell">
        <div className="today-error">
          <p>{error ?? "项目不存在"}</p>
          <button className="btn-primary" onClick={fetchData}>
            重试
          </button>
        </div>
      </main>
    );
  }

  const buildAiBriefText = (): string => {
    const parts: string[] = [];
    parts.push(`我已经解析了 ${parsedSources.length} 个文件`);

    if (project.type === "presentation") {
      parts.push("识别到这是一个 Presentation");
    } else {
      parts.push(`识别到这是一个${TYPE_LABELS[project.type] ?? "任务"}`);
    }

    if (planData?.suggestedPages) {
      parts.push(`建议做 ${planData.suggestedPages} 页`);
    }

    if (planData?.directions && planData.directions.length > 0) {
      parts.push(`我准备了 ${planData.directions.length} 个选题方向`);
    }

    return `${parts.join("，")}。`;
  };

  const selectedDir =
    selectedDirection !== null && planData?.directions
      ? planData.directions[selectedDirection]
      : null;

  const outlineGate = gates.find(
    (g) =>
      g.status === "pending" &&
      (g.gateType === "outline" ||
        g.gateType === "plan" ||
        g.gateType === "direction")
  );

  return (
    <main className="shell">
      <Link href="/" className="back-link">
        ← 返回首页
      </Link>

      <div className="review-layout">
        <aside className="review-sidebar">
          <h2 className="review-sidebar-title">{project.title}</h2>

          <div className="sidebar-field">
            <span className="sidebar-label">任务类型</span>
            <span className="sidebar-value">
              {TYPE_LABELS[project.type] ?? project.type}
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">截止日期</span>
            <span className="sidebar-value">
              {formatDate(project.dueDate)}
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">交付物</span>
            <span className="sidebar-value">
              {project.artifacts.length > 0
                ? project.artifacts.map((a) => a.title).join("、")
                : "暂无"}
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">资料</span>
            <span className="sidebar-value">
              {sources.length} 个文件，{parsedSources.length} 个已解析
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">导师要求</span>
            <span className="sidebar-value">
              {project.description ?? "暂无"}
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">处理状态</span>
            <span className={`status-badge status-${project.status}`}>
              {project.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">优先级</span>
            <span className="sidebar-value">{project.priority}</span>
          </div>

          <div className="sidebar-field">
            <span className="sidebar-label">风险</span>
            <span className={`risk-badge risk-${project.riskLevel.toLowerCase()}`}>
              {project.riskLevel}
            </span>
          </div>
        </aside>

        <section className="review-center">
          <div className="review-brief">
            <span className="status-dot" />
            <p className="eyebrow">AI Brief</p>
            <p className="review-brief-text">{buildAiBriefText()}</p>
          </div>

          {!planData && !generating && (
            <div className="review-no-plan">
              <p>尚未生成选题方向。</p>
              <button className="btn-primary" onClick={handleGeneratePlan}>
                生成选题方向
              </button>
            </div>
          )}

          {generating && (
            <div className="review-generating">
              <div className="today-loading-spinner" />
              <p>AI 正在准备选题方向…</p>
            </div>
          )}

          {planData?.directions && planData.directions.length > 0 && (
            <>
              <h3 className="review-directions-title">选题方向</h3>
              <div className="direction-cards">
                {planData.directions.map((dir, i) => (
                  <article
                    key={i}
                    className={`direction-card ${selectedDirection === i ? "direction-card-selected" : ""}`}
                  >
                    <div className="direction-card-top">
                      <span className="direction-index">
                        方向 {i + 1}
                      </span>
                      {dir.recommendationIndex != null && (
                        <span className="direction-recommend">
                          推荐 #{dir.recommendationIndex}
                        </span>
                      )}
                    </div>
                    <h4 className="direction-topic">{dir.topic || `方向 ${i + 1}`}</h4>
                    {dir.value && (
                      <p className="direction-value">{dir.value}</p>
                    )}
                    <div className="direction-meta">
                      {dir.materialCoverage != null && (
                        <span>覆盖 {Math.round(dir.materialCoverage * 100)}%</span>
                      )}
                      {dir.estimatedPages != null && (
                        <span>约 {dir.estimatedPages} 页</span>
                      )}
                      {dir.difficulty && <span>{dir.difficulty}</span>}
                      {dir.risk && (
                        <span className={`risk-badge risk-${dir.risk.toLowerCase()}`}>
                          {dir.risk}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn-direction-select"
                      onClick={() => handleSelectDirection(i)}
                    >
                      {selectedDirection === i ? "已选择" : "选择此方向"}
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}

          {selectedDir && (
            <div className="outline-card">
              <h3>大纲确认：{selectedDir.topic || `方向 ${selectedDirection! + 1}`}</h3>
              {selectedDir.outline && selectedDir.outline.length > 0 ? (
                <div className="outline-sections">
                  {selectedDir.outline.map((section, i) => (
                    <div key={i} className="outline-section">
                      <strong>{section.title}</strong>
                      {section.points.length > 0 && (
                        <ul>
                          {section.points.map((point, j) => (
                            <li key={j}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">此方向暂无详细大纲</p>
              )}
              <div className="outline-actions">
                {outlineGate && (
                  <button
                    className="btn-primary"
                    disabled={confirming === outlineGate.id}
                    onClick={() => handleConfirmOutline(outlineGate.id)}
                  >
                    {confirming === outlineGate.id ? "确认中…" : "确认大纲"}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedDirection(null)}
                >
                  换一个
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="review-right">
          <h3>风险与证据</h3>

          <div className="evidence-field">
            <span className="evidence-label">材料覆盖</span>
            <div className="evidence-bar-track">
              <div
                className="evidence-bar-fill"
                style={{
                  width: `${Math.round(avgConfidence * 100)}%`,
                }}
              />
            </div>
            <span className="evidence-value">
              {Math.round(avgConfidence * 100)}%
            </span>
          </div>

          <div className="evidence-field">
            <span className="evidence-label">缺失信息</span>
            <div className="evidence-missing">
              {missingInfoIssues.length === 0 ? (
                <span className="evidence-ok">无缺失</span>
              ) : (
                <ul>
                  {missingInfoIssues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="evidence-field">
            <span className="evidence-label">评分标准匹配</span>
            <span className="evidence-value">
              {evidence.length > 0
                ? `${evidence.filter((e) => e.verificationStatus === "verified").length}/${evidence.length} 已验证`
                : "暂无证据"}
            </span>
          </div>

          <div className="evidence-field">
            <span className="evidence-label">三色估计</span>
            <div className="three-color-estimate">
              <div className="three-color-item three-color-green">
                <strong>{evidenceByColor.green.length}</strong>
                <span>绿色</span>
              </div>
              <div className="three-color-item three-color-yellow">
                <strong>{evidenceByColor.yellow.length}</strong>
                <span>黄色</span>
              </div>
              <div className="three-color-item three-color-gray">
                <strong>{evidenceByColor.gray.length}</strong>
                <span>灰色</span>
              </div>
            </div>
          </div>

          <div className="evidence-field">
            <span className="evidence-label">时间风险</span>
            <span className="evidence-value">
              {project.dueDate
                ? (() => {
                    const daysLeft = Math.ceil(
                      (new Date(project.dueDate).getTime() - Date.now()) /
                        86400000
                    );
                    if (daysLeft < 0) return "已过期";
                    if (daysLeft <= 2) return `${daysLeft} 天（紧急）`;
                    if (daysLeft <= 7) return `${daysLeft} 天（较紧）`;
                    return `${daysLeft} 天（充裕）`;
                  })()
                : "无截止日期"}
            </span>
          </div>

          {watcherResult && watcherResult.issues.length > 0 && (
            <div className="evidence-field">
              <span className="evidence-label">监控提醒</span>
              <div className="review-watcher-issues">
                {watcherResult.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`watcher-alert watcher-alert-${issue.severity}`}
                  >
                    <span className={`severity-dot severity-${issue.severity}`} />
                    <span className="watcher-message">{issue.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="today-loading">
            <div className="today-loading-spinner" />
            <p>正在加载…</p>
          </div>
        </main>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
