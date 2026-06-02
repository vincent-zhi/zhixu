"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listSources,
  listArtifacts,
  listArtifactBlocks,
  listHumanGates,
  listTasks,
  getAgentSession,
  paperRead,
  paperMatrix,
  type ArtifactBlockSummary,
  type PaperMatrixResult,
  type AgentSessionSummary,
} from "../api-client";
import type {
  SourceSummary,
  ArtifactSummary,
  HumanGateSummary,
  TaskSummary,
} from "@zhixu/core";

type CanvasView = "brief" | "papers" | "matrix" | "outline" | "slide_detail" | "questions";

const VIEW_LABELS: Record<CanvasView, string> = {
  brief: "任务简报",
  papers: "论文资料",
  matrix: "知识矩阵",
  outline: "大纲",
  slide_detail: "幻灯片",
  questions: "问题",
};

interface CanvasPanelProps {
  projectId: string | null;
  agentSessionId: string | null;
  onClose?: () => void;
}

function BriefView({ projectId }: { projectId: string }) {
  const [session, setSession] = useState<AgentSessionSummary | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listTasks(projectId)])
      .then(([taskList]) => {
        if (cancelled) return;
        setTasks(taskList);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const briefData = useMemo(() => {
    if (!session?.briefJson) return null;
    return session.briefJson as Record<string, unknown>;
  }, [session]);

  const phase = session?.currentPhase ?? "";
  const decision = session?.selectedDecision ?? null;

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  return (
    <div className="cv-brief">
      {briefData && (
        <div className="cv-brief-card">
          <div className="cv-brief-card-header">
            <span className="cv-brief-card-icon">📋</span>
            <span className="cv-brief-card-title">{(briefData.title as string) ?? "任务简报"}</span>
          </div>
          {briefData.goal != null && (
            <div className="cv-brief-field">
              <span className="cv-brief-label">目标</span>
              <span className="cv-brief-value">{String(briefData.goal)}</span>
            </div>
          )}
          {briefData.deadline != null && (
            <div className="cv-brief-field">
              <span className="cv-brief-label">截止日期</span>
              <span className="cv-brief-value">{String(briefData.deadline)}</span>
            </div>
          )}
          {phase && (
            <div className="cv-brief-field">
              <span className="cv-brief-label">当前阶段</span>
              <span className="cv-brief-value cv-phase-badge">{phase}</span>
            </div>
          )}
          {decision && (
            <div className="cv-brief-field">
              <span className="cv-brief-label">已选方案</span>
              <span className="cv-brief-value">{decision}</span>
            </div>
          )}
        </div>
      )}

      {!briefData && (
        <div className="cv-brief-card">
          <div className="cv-brief-card-header">
            <span className="cv-brief-card-icon">📋</span>
            <span className="cv-brief-card-title">项目概览</span>
          </div>
          <div className="cv-brief-field">
            <span className="cv-brief-label">项目 ID</span>
            <span className="cv-brief-value">{projectId}</span>
          </div>
        </div>
      )}

      <div className="cv-section">
        <div className="cv-section-title">任务列表 ({tasks.length})</div>
        {tasks.length === 0 && (
          <div className="cv-empty-sm">暂无任务</div>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="cv-task-item">
            <span className={`cv-task-status cv-task-status--${task.status}`}>{task.status}</span>
            <span className="cv-task-title">{task.title}</span>
            {task.priority != null && (
              <span className="cv-task-priority">P{task.priority}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperCard({ source, onRead }: { source: SourceSummary; onRead: (id: string) => void }) {
  const fileTypeIcon = source.fileName.endsWith(".pdf") ? "📕" :
    source.fileName.endsWith(".docx") || source.fileName.endsWith(".doc") ? "📘" :
    source.fileName.endsWith(".pptx") ? "📙" : "📄";

  return (
    <div className="cv-paper-card" onClick={() => onRead(source.id)}>
      <div className="cv-paper-card-icon">{fileTypeIcon}</div>
      <div className="cv-paper-card-body">
        <div className="cv-paper-card-name">{source.fileName}</div>
        <div className="cv-paper-card-meta">
          <span className="cv-paper-card-type">{source.fileType.toUpperCase()}</span>
          {source.parseStatus && (
            <span className={`cv-paper-card-status cv-paper-card-status--${source.parseStatus}`}>
              {source.parseStatus === "parsed" ? "已解析" :
               source.parseStatus === "pending" ? "待解析" :
               source.parseStatus === "failed" ? "解析失败" : source.parseStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PapersView({ projectId }: { projectId: string }) {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingSourceId, setReadingSourceId] = useState<string | null>(null);
  const [paperData, setPaperData] = useState<Record<string, unknown> | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSources(projectId)
      .then((data) => { if (!cancelled) setSources(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleRead = useCallback(async (sourceId: string) => {
    if (reading) return;
    setReadingSourceId(sourceId);
    setReading(true);
    setPaperData(null);
    try {
      const result = await paperRead(projectId, { sourceId });
      setPaperData(result as unknown as Record<string, unknown>);
    } catch {
      setPaperData(null);
    } finally {
      setReading(false);
    }
  }, [projectId, reading]);

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  if (paperData) {
    return (
      <div className="cv-paper-detail">
        <button className="cv-back-btn" onClick={() => { setPaperData(null); setReadingSourceId(null); }}>
          ← 返回列表
        </button>
        <h3 className="cv-paper-detail-title">
          {(paperData as { fileName?: string }).fileName ?? "论文精读"}
        </h3>
        {[
          { label: "研究问题", key: "researchQuestion" },
          { label: "背景与动机", key: "backgroundMotivation" },
          { label: "方法框架", key: "methodFramework" },
          { label: "数据集", key: "dataset" },
          { label: "实验设置", key: "experimentSetup" },
          { label: "实验结果", key: "results" },
          { label: "主要贡献", key: "contributions" },
          { label: "局限性", key: "limitations" },
          { label: "可复现性", key: "reproducibility" },
        ].map(({ label, key }) => {
          const value = paperData[key];
          if (!value || (typeof value === "string" && !value.trim())) return null;
          return (
            <div key={key} className="cv-paper-section">
              <div className="cv-paper-section-label">{label}</div>
              <div className="cv-paper-section-content">{String(value)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="cv-papers">
      {sources.length === 0 && (
        <div className="cv-empty">
          <div className="cv-empty-icon">📄</div>
          <div className="cv-empty-text">暂无论文资料</div>
          <div className="cv-empty-hint">上传论文或参考资料后将在此展示</div>
        </div>
      )}
      {sources.map((source) => (
        <PaperCard
          key={source.id}
          source={source}
          onRead={handleRead}
        />
      ))}
      {reading && (
        <div className="cv-reading-overlay">
          <span className="cv-reading-spinner" />
          <span>正在精读论文...</span>
        </div>
      )}
    </div>
  );
}

function MatrixView({ projectId }: { projectId: string }) {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [matrixData, setMatrixData] = useState<PaperMatrixResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSources(projectId)
      .then((data) => { if (!cancelled) setSources(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const toggleSource = useCallback((id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (generating || selectedSourceIds.size < 2) return;
    setGenerating(true);
    try {
      const result = await paperMatrix(projectId, {
        sourceIds: Array.from(selectedSourceIds),
      });
      setMatrixData(result);
    } catch {
    } finally {
      setGenerating(false);
    }
  }, [projectId, generating, selectedSourceIds]);

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  if (!matrixData) {
    return (
      <div className="cv-matrix-setup">
        <div className="cv-matrix-hint">选择 2 篇及以上论文生成对比矩阵</div>
        {sources.length === 0 && (
          <div className="cv-empty">
            <div className="cv-empty-icon">🧮</div>
            <div className="cv-empty-text">暂无论文资料</div>
            <div className="cv-empty-hint">请先上传论文</div>
          </div>
        )}
        <div className="cv-matrix-source-list">
          {sources.map((source) => (
            <label key={source.id} className="cv-matrix-source-item">
              <input
                type="checkbox"
                checked={selectedSourceIds.has(source.id)}
                onChange={() => toggleSource(source.id)}
              />
              <span className="cv-matrix-source-name">{source.fileName}</span>
            </label>
          ))}
        </div>
        <button
          className="cv-btn-primary"
          disabled={selectedSourceIds.size < 2 || generating}
          onClick={handleGenerate}
        >
          {generating ? "生成中..." : "生成对比矩阵"}
        </button>
      </div>
    );
  }

  const dimensions = matrixData.dimensions;
  const sourceIds = matrixData.sourceIds;
  const sourceMap = new Map(sources.map((s) => [s.id, s.fileName]));

  return (
    <div className="cv-matrix-result">
      <button className="cv-back-btn" onClick={() => setMatrixData(null)}>
        ← 重新选择
      </button>
      <div className="cv-matrix-table-wrap">
        <table className="cv-matrix-table">
          <thead>
            <tr>
              <th className="cv-matrix-corner">维度</th>
              {sourceIds.map((sid) => (
                <th key={sid} className="cv-matrix-source-header">
                  {sourceMap.get(sid) ?? sid.slice(0, 8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixData.rows.map((row) => (
              <tr key={row.dimension}>
                <td className="cv-matrix-dimension">{row.dimension}</td>
                {sourceIds.map((sid) => (
                  <td key={sid} className="cv-matrix-cell">
                    {row.values[sid] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutlineView({ projectId }: { projectId: string }) {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ArtifactBlockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listArtifacts(projectId)
      .then((data) => {
        if (cancelled) return;
        setArtifacts(data);
        if (data.length > 0) setSelectedArtifactId(data[0]!.id);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!selectedArtifactId) { setBlocks([]); return; }
    let cancelled = false;
    setLoadingBlocks(true);
    listArtifactBlocks(selectedArtifactId)
      .then((data) => { if (!cancelled) setBlocks(data); })
      .catch(() => { if (!cancelled) setBlocks([]); })
      .finally(() => { if (!cancelled) setLoadingBlocks(false); });
    return () => { cancelled = true; };
  }, [selectedArtifactId]);

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  return (
    <div className="cv-outline">
      {artifacts.length > 1 && (
        <div className="cv-outline-artifact-selector">
          {artifacts.map((a) => (
            <button
              key={a.id}
              className={`cv-outline-artifact-btn ${selectedArtifactId === a.id ? "cv-outline-artifact-btn--active" : ""}`}
              onClick={() => setSelectedArtifactId(a.id)}
            >
              {a.title || a.type}
            </button>
          ))}
        </div>
      )}

      {artifacts.length === 0 && (
        <div className="cv-empty">
          <div className="cv-empty-icon">📑</div>
          <div className="cv-empty-text">暂无文档</div>
          <div className="cv-empty-hint">创建文档或演示文稿后大纲将在此展示</div>
        </div>
      )}

      {loadingBlocks && <div className="cv-loading">加载大纲...</div>}

      {!loadingBlocks && blocks.length > 0 && (
        <div className="cv-outline-tree">
          {blocks.map((block, i) => {
            const content = block.contentJson as Record<string, unknown>;
            const title = (content?.title as string) ?? (content?.heading as string) ?? block.blockType;
            const level = (content?.level as number) ?? 1;
            const isHeading = block.blockType === "heading" || level > 0;
            return (
              <div
                key={block.id}
                className={`cv-outline-item ${isHeading ? "cv-outline-item--heading" : "cv-outline-item--body"}`}
                style={{ paddingLeft: isHeading ? `${(level - 1) * 16 + 8}px` : "24px" }}
              >
                <span className="cv-outline-index">{i + 1}</span>
                <span className="cv-outline-title">{title}</span>
                <span className={`cv-resp-dot cv-resp-dot--${block.responsibilityColor}`} title={block.responsibilityColor} />
              </div>
            );
          })}
        </div>
      )}

      {!loadingBlocks && blocks.length === 0 && selectedArtifactId && (
        <div className="cv-empty-sm">该文档暂无大纲内容</div>
      )}
    </div>
  );
}

function SlideDetailView({ projectId }: { projectId: string }) {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ArtifactBlockSummary[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listArtifacts(projectId)
      .then((data) => {
        if (cancelled) return;
        const pptArtifacts = data.filter((a) => a.type === "ppt" || a.type === "presentation");
        setArtifacts(pptArtifacts.length > 0 ? pptArtifacts : data);
        const target = pptArtifacts.length > 0 ? pptArtifacts[0]! : data[0];
        if (target) setSelectedArtifactId(target.id);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!selectedArtifactId) { setBlocks([]); return; }
    let cancelled = false;
    listArtifactBlocks(selectedArtifactId)
      .then((data) => {
        if (cancelled) return;
        setBlocks(data);
        if (data.length > 0 && !selectedBlockId) setSelectedBlockId(data[0]!.id);
      })
      .catch(() => { if (!cancelled) setBlocks([]); });
    return () => { cancelled = true; };
  }, [selectedArtifactId]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  if (artifacts.length === 0) {
    return (
      <div className="cv-empty">
        <div className="cv-empty-icon">🎨</div>
        <div className="cv-empty-text">暂无幻灯片</div>
        <div className="cv-empty-hint">创建 PPT 后幻灯片将在此展示</div>
      </div>
    );
  }

  return (
    <div className="cv-slides">
      <div className="cv-slides-sidebar">
        {blocks.map((block, i) => {
          const content = block.contentJson as Record<string, unknown>;
          const title = (content?.title as string) ?? `第 ${i + 1} 页`;
          return (
            <div
              key={block.id}
              className={`cv-slide-thumb ${selectedBlockId === block.id ? "cv-slide-thumb--active" : ""}`}
              onClick={() => setSelectedBlockId(block.id)}
            >
              <span className="cv-slide-num">{i + 1}</span>
              <span className="cv-slide-thumb-title">{title}</span>
            </div>
          );
        })}
      </div>
      <div className="cv-slides-preview">
        {selectedBlock ? (
          <div className="cv-slide-card">
            <div className="cv-slide-card-title">
              {(selectedBlock.contentJson as Record<string, unknown>)?.title as string ?? ""}
            </div>
            <div className="cv-slide-card-text">
              {((selectedBlock.contentJson as Record<string, unknown>)?.text as string ?? "")
                .split("\n")
                .map((line, i) => (
                  <div key={i} className="cv-slide-bullet">{line.replace(/^[•\-\*]\s*/, "")}</div>
                ))}
            </div>
            {!(selectedBlock.contentJson as Record<string, unknown>)?.text && (
              <div className="cv-slide-card-outline">
                大纲：{(selectedBlock.contentJson as Record<string, unknown>)?.outline as string ?? "待生成"}
              </div>
            )}
            <div className="cv-slide-card-meta">
              <span className={`cv-resp-dot cv-resp-dot--${selectedBlock.responsibilityColor}`} />
              <span className="cv-slide-card-status">{selectedBlock.verificationStatus}</span>
            </div>
          </div>
        ) : (
          <div className="cv-empty-sm">选择一页查看预览</div>
        )}
      </div>
    </div>
  );
}

function QuestionsView({ projectId }: { projectId: string }) {
  const [gates, setGates] = useState<HumanGateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listHumanGates(projectId)
      .then((data) => { if (!cancelled) setGates(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return <div className="cv-loading">加载中...</div>;
  }

  if (gates.length === 0) {
    return (
      <div className="cv-empty">
        <div className="cv-empty-icon">❓</div>
        <div className="cv-empty-text">暂无待确认问题</div>
        <div className="cv-empty-hint">高风险操作或关键决策会在此等待确认</div>
      </div>
    );
  }

  return (
    <div className="cv-questions">
      {gates.map((gate) => (
        <div key={gate.id} className={`cv-question-card ${gate.confirmedAt ? "cv-question-card--resolved" : ""}`}>
          <div className="cv-question-header">
            <span className={`cv-question-type cv-question-type--${gate.gateType}`}>
              {gate.gateType === "risk" ? "⚠️ 风险确认" :
               gate.gateType === "privacy" ? "🔒 隐私确认" :
               gate.gateType === "quality" ? "✅ 质量确认" :
               gate.gateType === "decision" ? "🔀 方案选择" :
               "❓ 待确认"}
            </span>
            {gate.confirmedAt && <span className="cv-question-resolved">已确认</span>}
          </div>
          <div className="cv-question-reason">{gate.reason}</div>
          <div className="cv-question-meta">
            <span className="cv-question-risk">风险等级: {gate.riskLevel}</span>
            <span className="cv-question-time">{new Date(gate.createdAt).toLocaleString("zh-CN")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CanvasPanel({ projectId, agentSessionId, onClose }: CanvasPanelProps) {
  const [activeView, setActiveView] = useState<CanvasView>("brief");

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__header">
        <div className="canvas-panel__tabs">
          {(Object.keys(VIEW_LABELS) as CanvasView[]).map((view) => (
            <button
              key={view}
              className={`canvas-panel__tab ${activeView === view ? "canvas-panel__tab--active" : ""}`}
              onClick={() => setActiveView(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>
        {onClose && (
          <button className="canvas-panel__close" onClick={onClose}>✕</button>
        )}
      </div>

      <div className="canvas-panel__content">
        {!projectId ? (
          <div className="cv-empty">
            <div className="cv-empty-icon">📋</div>
            <div className="cv-empty-text">尚未关联项目</div>
            <div className="cv-empty-hint">开始对话后将自动关联项目</div>
          </div>
        ) : (
          <>
            {activeView === "brief" && <BriefView projectId={projectId} />}
            {activeView === "papers" && <PapersView projectId={projectId} />}
            {activeView === "matrix" && <MatrixView projectId={projectId} />}
            {activeView === "outline" && <OutlineView projectId={projectId} />}
            {activeView === "slide_detail" && <SlideDetailView projectId={projectId} />}
            {activeView === "questions" && <QuestionsView projectId={projectId} />}
          </>
        )}
      </div>
    </div>
  );
}
