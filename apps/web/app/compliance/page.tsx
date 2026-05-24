"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listProjects,
  listEvidence,
  listHumanGates,
  verifyCitations,
  checkWatcher,
  addEvidence,
  confirmHumanGate,
  ApiClientError,
} from "../api-client";
import type {
  EvidenceSummary,
  CitationVerificationResult,
  WatcherCheckResult,
  WatcherIssue,
} from "../api-client";
import type { HumanGateSummary } from "@zhixu/core";

type RiskSeverity = "critical" | "warning" | "info";

interface EnrichedIssue extends WatcherIssue {
  projectId: string;
  projectTitle: string;
}

const SEVERITY_GROUPS: { key: RiskSeverity; label: string; description: string }[] = [
  { key: "critical", label: "必须处理", description: "影响交付合规性，需立即处理" },
  { key: "warning", label: "建议处理", description: "存在潜在风险，建议尽快确认" },
  { key: "info", label: "可忽略", description: "低风险项目，可酌情处理" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export default function CompliancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<EvidenceSummary[]>([]);
  const [humanGates, setHumanGates] = useState<HumanGateSummary[]>([]);
  const [watcherResults, setWatcherResults] = useState<WatcherCheckResult[]>([]);
  const [citationResults, setCitationResults] = useState<CitationVerificationResult[]>([]);

  const [selectedIssue, setSelectedIssue] = useState<EnrichedIssue | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ quoteText: "", evidenceType: "citation" });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const projects = await listProjects();
      const watcher = await checkWatcher();

      const evidenceResults = await Promise.all(
        projects.map((p) => listEvidence(p.id).catch(() => [] as EvidenceSummary[]))
      );
      const gateResults = await Promise.all(
        projects.map((p) => listHumanGates(p.id).catch(() => [] as HumanGateSummary[]))
      );

      const allEvidence = evidenceResults.flat();
      const allGates = gateResults.flat();

      const citations = allEvidence
        .filter((e) => e.quoteText)
        .slice(0, 50)
        .map((e) => ({ rawText: e.quoteText! }));

      let citationsVerified: CitationVerificationResult[] = [];
      if (citations.length > 0) {
        try {
          citationsVerified = await verifyCitations(citations);
        } catch {
          citationsVerified = [];
        }
      }

      setEvidence(allEvidence);
      setHumanGates(allGates);
      setWatcherResults(watcher);
      setCitationResults(citationsVerified);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "加载合规数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const greenCount = evidence.filter((e) => e.responsibilityColor === "green").length;
  const yellowCount = evidence.filter((e) => e.responsibilityColor === "yellow").length;
  const grayCount = evidence.filter((e) => e.responsibilityColor === "gray").length;
  const totalEvidence = evidence.length;

  const verifiedCount = citationResults.filter((c) => c.status === "verified").length;
  const needsReviewCount = citationResults.filter((c) => c.status === "needs_review").length;
  const rejectedCount = citationResults.filter((c) => c.status === "rejected").length;

  const pendingGates = humanGates.filter((g) => g.status !== "confirmed");
  const confirmedGates = humanGates.filter((g) => g.status === "confirmed");

  const allIssues: EnrichedIssue[] = watcherResults.flatMap((r) =>
    r.issues.map((issue) => ({ ...issue, projectId: r.projectId, projectTitle: r.projectTitle }))
  );

  const groupedIssues: Record<RiskSeverity, EnrichedIssue[]> = {
    critical: allIssues.filter((i) => i.severity === "critical"),
    warning: allIssues.filter((i) => i.severity === "warning"),
    info: allIssues.filter((i) => i.severity === "info"),
  };

  const handleConfirm = async (issue: EnrichedIssue) => {
    if (issue.targetType !== "human_gate") return;
    try {
      setActionLoading(issue.targetId);
      await confirmHumanGate(issue.targetId, { confirmedBy: "current_user" });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "确认操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSource = async () => {
    if (!selectedProjectId || !sourceForm.quoteText.trim()) return;
    try {
      setActionLoading("add-source");
      await addEvidence(selectedProjectId, {
        evidenceType: sourceForm.evidenceType,
        quoteText: sourceForm.quoteText.trim(),
      });
      setShowSourceForm(false);
      setSourceForm({ quoteText: "", evidenceType: "citation" });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "添加来源失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      overview: {
        greenRatio: pct(greenCount, totalEvidence),
        yellowRatio: pct(yellowCount, totalEvidence),
        grayRatio: pct(grayCount, totalEvidence),
        totalEvidence,
        citationVerification: { verified: verifiedCount, needsReview: needsReviewCount, rejected: rejectedCount },
        humanGates: { pending: pendingGates.length, confirmed: confirmedGates.length },
      },
      risks: allIssues.map((i) => ({
        severity: i.severity,
        type: i.type,
        message: i.message,
        targetType: i.targetType,
        targetId: i.targetId,
        project: i.projectTitle,
      })),
      evidence: evidence.map((e) => ({
        id: e.id,
        type: e.evidenceType,
        responsibilityColor: e.responsibilityColor,
        confidence: e.confidence,
        verificationStatus: e.verificationStatus,
        quoteText: e.quoteText,
      })),
      humanGates: humanGates.map((g) => ({
        id: g.id,
        type: g.gateType,
        status: g.status,
        riskLevel: g.riskLevel,
        reason: g.reason,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="shell">
        <div className="page-loading">加载合规数据中…</div>
      </main>
    );
  }

  if (error && totalEvidence === 0 && watcherResults.length === 0) {
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

      <div className="compliance-shell">
        <header className="compliance-header">
          <p className="eyebrow">Compliance & Traceability</p>
          <h1>合规与溯源中心</h1>
        </header>

        <section className="compliance-overview" aria-label="合规概览">
          <div className="compliance-metrics">
            <div className="compliance-metric-card resp-green">
              <strong>{pct(greenCount, totalEvidence)}</strong>
              <span>绿色 · 可溯源内容</span>
              <small>{greenCount} 条证据</small>
            </div>
            <div className="compliance-metric-card resp-yellow">
              <strong>{pct(yellowCount, totalEvidence)}</strong>
              <span>黄色 · 待确认内容</span>
              <small>{yellowCount} 条证据</small>
            </div>
            <div className="compliance-metric-card resp-gray">
              <strong>{pct(grayCount, totalEvidence)}</strong>
              <span>灰色 · 仅参考内容</span>
              <small>{grayCount} 条证据</small>
            </div>
          </div>

          <div className="compliance-status-row">
            <div className="compliance-status-card">
              <h3>引用验证</h3>
              <div className="compliance-status-items">
                <span className="status-verified">{verifiedCount} 已验证</span>
                <span className="status-needs-review">{needsReviewCount} 待复核</span>
                <span className="status-rejected">{rejectedCount} 已驳回</span>
              </div>
            </div>
            <div className="compliance-status-card">
              <h3>Human Gate 记录</h3>
              <div className="compliance-status-items">
                <span className="status-pending">{pendingGates.length} 待确认</span>
                <span className="status-confirmed">{confirmedGates.length} 已确认</span>
              </div>
              {pendingGates.length > 0 && (
                <div className="compliance-gate-list">
                  {pendingGates.slice(0, 5).map((g) => (
                    <div key={g.id} className="compliance-gate-item">
                      <span className={`risk-badge risk-${g.riskLevel.toLowerCase()}`}>{g.riskLevel}</span>
                      <span>{g.gateType}</span>
                      <span className="gate-pending">待确认</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="compliance-body">
          <section className="risk-checklist" aria-label="风险清单">
            {SEVERITY_GROUPS.map((group) => (
              <div key={group.key} className={`risk-group risk-group-${group.key}`}>
                <div className="risk-group-header">
                  <h3>{group.label}</h3>
                  <span className="risk-group-count">{groupedIssues[group.key].length}</span>
                  <p>{group.description}</p>
                </div>
                {groupedIssues[group.key].length === 0 && (
                  <p className="empty-state">暂无此类风险</p>
                )}
                {groupedIssues[group.key].map((issue, i) => (
                  <div
                    key={`${issue.targetId}-${i}`}
                    className={`risk-item ${selectedIssue?.targetId === issue.targetId ? "risk-item-selected" : ""}`}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setSelectedProjectId(issue.projectId);
                    }}
                  >
                    <div className="risk-item-main">
                      <span className={`severity-dot severity-${issue.severity}`} />
                      <span className="risk-item-type">{issue.type.replaceAll("_", " ")}</span>
                      <span className="risk-item-message">{issue.message}</span>
                    </div>
                    <div className="risk-item-meta">
                      <span>{issue.projectTitle}</span>
                      <span>{issue.targetType}</span>
                    </div>
                    <div className="risk-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-risk-action btn-add-source"
                        onClick={() => {
                          setSelectedProjectId(issue.projectId);
                          setShowSourceForm(true);
                        }}
                        disabled={actionLoading !== null}
                      >
                        补来源
                      </button>
                      {issue.targetType === "human_gate" && (
                        <button
                          className="btn-risk-action btn-confirm"
                          onClick={() => handleConfirm(issue)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === issue.targetId ? "处理中…" : "确认"}
                        </button>
                      )}
                      <button
                        className="btn-risk-action btn-rewrite"
                        disabled={actionLoading !== null}
                        onClick={() => {
                          setSelectedIssue(issue);
                          setSelectedProjectId(issue.projectId);
                        }}
                      >
                        改写
                      </button>
                      <button
                        className="btn-risk-action btn-keep-note"
                        disabled={actionLoading !== null}
                      >
                        保留为备注
                      </button>
                      <button
                        className="btn-risk-action btn-delete"
                        disabled={actionLoading !== null}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <aside className="preview-panel" aria-label="预览与定位">
            {selectedIssue ? (
              <div className="preview-content">
                <h3>风险定位</h3>
                <div className="preview-field">
                  <label>类型</label>
                  <span>{selectedIssue.type.replaceAll("_", " ")}</span>
                </div>
                <div className="preview-field">
                  <label>严重程度</label>
                  <span className={`severity-dot severity-${selectedIssue.severity}`} />
                  <span>{selectedIssue.severity}</span>
                </div>
                <div className="preview-field">
                  <label>描述</label>
                  <p>{selectedIssue.message}</p>
                </div>
                <div className="preview-field">
                  <label>目标类型</label>
                  <span>{selectedIssue.targetType}</span>
                </div>
                <div className="preview-field">
                  <label>目标 ID</label>
                  <code>{selectedIssue.targetId}</code>
                </div>

                {selectedIssue.targetType === "human_gate" && (
                  <div className="preview-related">
                    <h4>关联 Human Gate</h4>
                    {humanGates
                      .filter((g) => g.id === selectedIssue.targetId)
                      .map((g) => (
                        <div key={g.id} className="preview-gate-detail">
                          <div><strong>类型：</strong>{g.gateType}</div>
                          <div><strong>原因：</strong>{g.reason}</div>
                          <div><strong>风险：</strong><span className={`risk-badge risk-${g.riskLevel.toLowerCase()}`}>{g.riskLevel}</span></div>
                          <div><strong>状态：</strong>{g.status === "confirmed" ? "已确认" : "待确认"}</div>
                          {g.confirmedBy && <div><strong>确认人：</strong>{g.confirmedBy}</div>}
                          {g.confirmedAt && <div><strong>确认时间：</strong>{formatDate(g.confirmedAt)}</div>}
                        </div>
                      ))}
                  </div>
                )}

                {selectedIssue.targetType === "artifact" && (
                  <div className="preview-related">
                    <h4>关联证据</h4>
                    {evidence
                      .filter((e) => e.artifactId === selectedIssue.targetId)
                      .slice(0, 5)
                      .map((e) => (
                        <div key={e.id} className="preview-evidence-item">
                          <span className={`resp-dot resp-${e.responsibilityColor}`} />
                          <span className="preview-evidence-type">{e.evidenceType}</span>
                          {e.quoteText && <p className="preview-quote">"{e.quoteText}"</p>}
                          {e.pageNumber != null && <small>第 {e.pageNumber} 页</small>}
                        </div>
                      ))}
                  </div>
                )}

                {selectedIssue.projectId && (
                  <Link
                    href={`/projects/${selectedIssue.projectId}`}
                    className="btn-primary preview-nav-btn"
                  >
                    前往项目详情 →
                  </Link>
                )}
              </div>
            ) : (
              <div className="preview-empty">
                <p>点击左侧风险项查看对应位置</p>
              </div>
            )}
          </aside>
        </div>

        {showSourceForm && (
          <div className="modal-overlay" onClick={() => setShowSourceForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>补充来源证据</h2>
              <div className="form-group">
                <label className="form-label">证据类型</label>
                <select
                  className="form-select"
                  value={sourceForm.evidenceType}
                  onChange={(e) => setSourceForm((f) => ({ ...f, evidenceType: e.target.value }))}
                >
                  <option value="citation">引用</option>
                  <option value="paraphrase">转述</option>
                  <option value="data_point">数据点</option>
                  <option value="image_ref">图片参考</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">引用原文</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={sourceForm.quoteText}
                  onChange={(e) => setSourceForm((f) => ({ ...f, quoteText: e.target.value }))}
                  placeholder="输入引用的原文内容"
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowSourceForm(false)}>取消</button>
                <button
                  className="btn-primary"
                  onClick={handleAddSource}
                  disabled={!sourceForm.quoteText.trim() || actionLoading !== null}
                >
                  {actionLoading === "add-source" ? "提交中…" : "添加证据"}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="compliance-export">
          <button className="btn-primary" onClick={handleExport}>
            导出合规报告
          </button>
        </section>

        {error && <p className="page-error-inline">{error}</p>}
      </div>
    </main>
  );
}
