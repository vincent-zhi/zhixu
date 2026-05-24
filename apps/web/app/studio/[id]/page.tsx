"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  listArtifacts,
  updateArtifactBlock,
  exportArtifactPptx,
  exportArtifactDocx,
  exportArtifactMarkdown,
  verifyCitations,
  createVersion,
  listEvidence,
  listVersions,
} from "../../api-client";
import type {
  ProjectDetail,
  ArtifactSummary,
  ArtifactBlockSummary,
} from "@zhixu/core";
import type {
  EvidenceSummary,
  VersionSummary,
  CitationVerificationResult,
} from "../../api-client";

type ArtifactKind = "ppt" | "document" | "literature" | "exam" | "experiment" | "other";

function detectArtifactKind(type: string): ArtifactKind {
  const t = type.toLowerCase();
  if (t.includes("ppt") || t.includes("presentation") || t.includes("slide")) return "ppt";
  if (t.includes("doc") || t.includes("paper") || t.includes("thesis") || t.includes("report"))
    return "document";
  if (t.includes("literature") || t.includes("review") || t.includes("matrix")) return "literature";
  if (t.includes("exam") || t.includes("quiz") || t.includes("question")) return "exam";
  if (t.includes("experiment") || t.includes("lab")) return "experiment";
  return "other";
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

export default function ArtifactStudioPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const artifactId = params.id;
  const projectId = searchParams.get("projectId") ?? "";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactSummary | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [citationResults, setCitationResults] = useState<CitationVerificationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let proj: ProjectDetail | null = null;
      if (projectId) {
        proj = await getProject(projectId);
        setProject(proj);
      }

      let artifactList: ArtifactSummary[] = [];
      if (projectId) {
        artifactList = await listArtifacts(projectId);
        setArtifacts(artifactList);
      }

      const found = artifactList.find((a) => a.id === artifactId) ?? null;
      setCurrentArtifact(found);

      if (found && !selectedBlockId && found.blocks.length > 0) {
        setSelectedBlockId(found.blocks[0]!.id);
      }

      if (projectId) {
        const ev = await listEvidence(projectId);
        setEvidence(ev);
      }

      try {
        const v = await listVersions("artifact", artifactId);
        setVersions(v);
      } catch {
        setVersions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [artifactId, projectId, selectedBlockId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedBlock = currentArtifact?.blocks.find((b) => b.id === selectedBlockId) ?? null;

  const blockEvidence = evidence.filter(
    (e) => e.artifactId === artifactId && e.blockId === selectedBlockId
  );

  const artifactKind = currentArtifact ? detectArtifactKind(currentArtifact.type) : "other";

  const handleBlockUpdate = useCallback(
    async (blockId: string, newText: string) => {
      if (!currentArtifact) return;
      try {
        setEditing(false);
        await updateArtifactBlock(currentArtifact.id, blockId, {
          contentJson: { text: newText },
          responsibilityColor: selectedBlock?.responsibilityColor ?? "yellow",
          verificationStatus: selectedBlock?.verificationStatus ?? "unverified",
          updatedBy: "current_user",
        });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新失败");
      }
    },
    [currentArtifact, selectedBlock, loadData]
  );

  const handleExport = useCallback(
    async (format: "pptx" | "docx" | "markdown") => {
      if (!currentArtifact) return;
      try {
        setExporting(true);
        let blob: Blob;
        if (format === "pptx") blob = await exportArtifactPptx(currentArtifact.id);
        else if (format === "docx") blob = await exportArtifactDocx(currentArtifact.id);
        else blob = await exportArtifactMarkdown(currentArtifact.id);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentArtifact.title}.${format === "markdown" ? "md" : format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "导出失败");
      } finally {
        setExporting(false);
      }
    },
    [currentArtifact]
  );

  const handleVerifyCitations = useCallback(async () => {
    if (!selectedBlock) return;
    const text = (selectedBlock.contentJson.text as string) ?? "";
    const citations = text
      .split(/[\n。]/)
      .filter((line) => line.includes("(") || line.includes("（"))
      .map((rawText) => ({ rawText }));
    if (citations.length === 0) return;
    try {
      const results = await verifyCitations(citations);
      setCitationResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "引用验证失败");
    }
  }, [selectedBlock]);

  const handleCreateVersion = useCallback(async () => {
    if (!currentArtifact || !projectId) return;
    try {
      await createVersion(projectId, {
        entityType: "artifact",
        entityId: currentArtifact.id,
        snapshotJson: { blocks: currentArtifact.blocks.map((b) => b.contentJson) },
        createdBy: "current_user",
        createdReason: "手动版本快照",
      });
      const v = await listVersions("artifact", artifactId);
      setVersions(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "版本创建失败");
    }
  }, [currentArtifact, projectId, artifactId]);

  if (loading && !currentArtifact) {
    return (
      <main className="studio-shell">
        <div className="workspace-loading">加载中…</div>
      </main>
    );
  }

  if (error && !currentArtifact) {
    return (
      <main className="studio-shell">
        <div className="workspace-error">
          <p>{error}</p>
          <button onClick={loadData} className="btn-primary">重试</button>
        </div>
      </main>
    );
  }

  if (!currentArtifact) {
    return (
      <main className="studio-shell">
        <div className="workspace-error">
          <p>未找到该交付物</p>
          {projectId && (
            <Link href={`/projects/${projectId}`} className="btn-primary">返回项目</Link>
          )}
        </div>
      </main>
    );
  }

  const sortedBlocks = [...currentArtifact.blocks].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <Link
          href={projectId ? `/projects/${projectId}` : "/"}
          className="back-link"
        >
          ← 返回项目
        </Link>
        <div className="studio-header-info">
          <h1>{currentArtifact.title}</h1>
          <div className="studio-header-meta">
            <span className={`status-badge status-${currentArtifact.status}`}>
              {currentArtifact.status}
            </span>
            <span>类型：{currentArtifact.type}</span>
            <span>证据覆盖：{Math.round(currentArtifact.evidenceCoverage * 100)}%</span>
            <span>{sortedBlocks.length} 个内容块</span>
          </div>
        </div>
      </header>

      <div className="studio-body">
        <aside className="studio-console">
          <div className="console-section">
            <div className="console-label">交付物状态</div>
            <div className="console-status">
              <span className={`status-badge status-${currentArtifact.status}`}>
                {currentArtifact.status}
              </span>
              <span className={`status-badge status-${currentArtifact.exportStatus}`}>
                导出：{currentArtifact.exportStatus.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="console-section">
            <div className="console-label">AI 建议</div>
            <div className="console-suggestions">
              {sortedBlocks.filter((b) => b.responsibilityColor === "gray").length > 0 && (
                <div className="console-suggestion-item suggestion-warn">
                  {sortedBlocks.filter((b) => b.responsibilityColor === "gray").length} 个灰色块需确认
                </div>
              )}
              {sortedBlocks.filter((b) => b.verificationStatus === "unverified").length > 0 && (
                <div className="console-suggestion-item suggestion-warn">
                  {sortedBlocks.filter((b) => b.verificationStatus === "unverified").length} 个块未核验
                </div>
              )}
              {currentArtifact.evidenceCoverage < 0.5 && (
                <div className="console-suggestion-item suggestion-warn">
                  证据覆盖率低于 50%
                </div>
              )}
              {sortedBlocks.filter((b) => b.responsibilityColor === "gray").length === 0 &&
                sortedBlocks.filter((b) => b.verificationStatus === "unverified").length === 0 &&
                currentArtifact.evidenceCoverage >= 0.5 && (
                  <div className="console-suggestion-item suggestion-ok">
                    交付物状态良好
                  </div>
                )}
            </div>
          </div>

          <div className="console-section">
            <div className="console-label">快速操作</div>
            <div className="console-actions">
              <button
                className="console-action-btn"
                onClick={handleVerifyCitations}
                disabled={!selectedBlock}
              >
                验证引用
              </button>
              <button
                className="console-action-btn"
                onClick={handleCreateVersion}
              >
                创建版本
              </button>
              <button
                className="console-action-btn"
                onClick={() => handleExport("pptx")}
                disabled={exporting}
              >
                导出 PPTX
              </button>
              <button
                className="console-action-btn"
                onClick={() => handleExport("docx")}
                disabled={exporting}
              >
                导出 DOCX
              </button>
              <button
                className="console-action-btn"
                onClick={() => handleExport("markdown")}
                disabled={exporting}
              >
                导出 Markdown
              </button>
            </div>
          </div>

          <div className="console-section">
            <div className="console-label">版本历史</div>
            <div className="console-versions">
              {versions.length === 0 && (
                <div className="console-empty">暂无版本</div>
              )}
              {versions.slice(0, 8).map((v) => (
                <div key={v.id} className="console-version-item">
                  <span className="version-reason">{v.createdReason}</span>
                  <span className="version-time">{formatDt(v.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="studio-canvas">
          {artifactKind === "ppt" && (
            <div className="canvas-ppt">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`canvas-slide ${isSelected ? "canvas-slide-selected" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className={`canvas-slide-inner resp-border-${block.responsibilityColor}`}>
                      <div className="slide-type-tag">{block.blockType}</div>
                      <div className="slide-content">
                        {(block.contentJson.text as string) ?? ""}
                      </div>
                      <div className="slide-footer">
                        <span className={`status-badge status-${block.verificationStatus}`}>
                          {block.verificationStatus}
                        </span>
                        <span className={`resp-tag resp-${block.responsibilityColor}`}>
                          {block.responsibilityColor}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {artifactKind === "document" && (
            <div className="canvas-document">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`canvas-paragraph ${isSelected ? "canvas-paragraph-selected" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className={`paragraph-resp-bar resp-bg-${block.responsibilityColor}`} />
                    <div className="paragraph-body">
                      <div className="paragraph-type">{block.blockType}</div>
                      <div className="paragraph-text">
                        {(block.contentJson.text as string) ?? ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {artifactKind === "literature" && (
            <div className="canvas-literature">
              <table className="literature-matrix">
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>类型</th>
                    <th>内容</th>
                    <th>权责</th>
                    <th>核验</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((block) => (
                    <tr
                      key={block.id}
                      className={`lit-row ${block.id === selectedBlockId ? "lit-row-selected" : ""}`}
                      onClick={() => setSelectedBlockId(block.id)}
                    >
                      <td>{block.blockType}</td>
                      <td>{(block.contentJson.type as string) ?? "—"}</td>
                      <td className="lit-content">
                        {(block.contentJson.text as string) ?? ""}
                      </td>
                      <td>
                        <span className={`resp-tag resp-${block.responsibilityColor}`}>
                          {block.responsibilityColor}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${block.verificationStatus}`}>
                          {block.verificationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {artifactKind === "exam" && (
            <div className="canvas-exam">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`exam-question ${isSelected ? "exam-question-selected" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className="exam-q-type">{block.blockType}</div>
                    <div className="exam-q-text">
                      {(block.contentJson.text as string) ?? ""}
                    </div>
                    <div className="exam-q-meta">
                      <span className={`resp-tag resp-${block.responsibilityColor}`}>
                        {block.responsibilityColor}
                      </span>
                      <span className={`status-badge status-${block.verificationStatus}`}>
                        {block.verificationStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {artifactKind === "experiment" && (
            <div className="canvas-experiment">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`experiment-entry ${isSelected ? "experiment-entry-selected" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className="exp-field">{block.blockType}</div>
                    <div className="exp-value">
                      {(block.contentJson.text as string) ?? ""}
                    </div>
                    <div className="exp-meta">
                      <span className={`resp-tag resp-${block.responsibilityColor}`}>
                        {block.responsibilityColor}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {artifactKind === "other" && (
            <div className="canvas-generic">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    className={`generic-block ${isSelected ? "generic-block-selected" : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className="generic-block-type">{block.blockType}</div>
                    <div className="generic-block-text">
                      {(block.contentJson.text as string) ?? ""}
                    </div>
                    <div className="generic-block-meta">
                      <span className={`resp-tag resp-${block.responsibilityColor}`}>
                        {block.responsibilityColor}
                      </span>
                      <span className={`status-badge status-${block.verificationStatus}`}>
                        {block.verificationStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="studio-inspector">
          {selectedBlock ? (
            <>
              <div className="inspector-section">
                <div className="inspector-label">当前块目标</div>
                <div className="inspector-value">{selectedBlock.blockType}</div>
              </div>

              <div className="inspector-section">
                <div className="inspector-label">三色溯源</div>
                <div className={`inspector-resp resp-${selectedBlock.responsibilityColor}`}>
                  {selectedBlock.responsibilityColor === "green" && "绿色 · 可溯源内容"}
                  {selectedBlock.responsibilityColor === "yellow" && "黄色 · 需确认归纳"}
                  {selectedBlock.responsibilityColor === "gray" && "灰色 · AI 推断"}
                </div>
              </div>

              <div className="inspector-section">
                <div className="inspector-label">核验状态</div>
                <span className={`status-badge status-${selectedBlock.verificationStatus}`}>
                  {selectedBlock.verificationStatus}
                </span>
              </div>

              <div className="inspector-section">
                <div className="inspector-label">关联证据</div>
                <div className="inspector-evidence-list">
                  {blockEvidence.length === 0 && (
                    <div className="inspector-empty">无关联证据</div>
                  )}
                  {blockEvidence.map((e) => (
                    <div key={e.id} className={`inspector-evidence-item resp-border-${e.responsibilityColor}`}>
                      <strong>{e.evidenceType}</strong>
                      {e.quoteText && (
                        <p className="inspector-evidence-quote">"{e.quoteText}"</p>
                      )}
                      <span>置信度：{Math.round(e.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {citationResults.length > 0 && (
                <div className="inspector-section">
                  <div className="inspector-label">引用验证</div>
                  <div className="inspector-citations">
                    {citationResults.map((c, i) => (
                      <div
                        key={i}
                        className={`citation-result citation-${c.status}`}
                      >
                        <span className="citation-status">{c.status}</span>
                        <span className="citation-text">{c.rawText}</span>
                        {c.issues.length > 0 && (
                          <div className="citation-issues">
                            {c.issues.map((issue: string, j: number) => (
                              <span key={j} className="citation-issue">{issue}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="inspector-section">
                <div className="inspector-label">内容编辑</div>
                {editing ? (
                  <div className="inspector-edit">
                    <textarea
                      className="inspector-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="inspector-edit-actions">
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => handleBlockUpdate(selectedBlock.id, editContent)}
                      >
                        保存
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setEditing(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inspector-content-preview">
                    <p>{(selectedBlock.contentJson.text as string) ?? ""}</p>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setEditContent((selectedBlock.contentJson.text as string) ?? "");
                        setEditing(true);
                      }}
                    >
                      编辑
                    </button>
                  </div>
                )}
              </div>

              {artifactKind === "ppt" && (
                <div className="inspector-section">
                  <div className="inspector-label">PPT 操作</div>
                  <div className="inspector-ppt-actions">
                    <button
                      className="console-action-btn"
                      onClick={() => handleBlockUpdate(selectedBlock.id, "")}
                    >
                      重写本页
                    </button>
                    <button
                      className="console-action-btn"
                      onClick={() => {
                        const text = (selectedBlock.contentJson.text as string) ?? "";
                        const shortened = text.length > 100 ? text.slice(0, 100) + "…" : text;
                        handleBlockUpdate(selectedBlock.id, shortened);
                      }}
                    >
                      缩短内容
                    </button>
                  </div>
                </div>
              )}

              <div className="inspector-section">
                <div className="inspector-label">块信息</div>
                <div className="inspector-meta-grid">
                  <span>顺序：{selectedBlock.orderIndex}</span>
                  <span>创建：{formatDt(selectedBlock.createdAt)}</span>
                  <span>更新：{formatDt(selectedBlock.updatedAt)}</span>
                  <span>创建者：{selectedBlock.createdBy}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="inspector-empty-state">
              选择一个内容块查看详情
            </div>
          )}
        </aside>
      </div>

      {error && <div className="command-error studio-error">{error}</div>}
    </main>
  );
}
