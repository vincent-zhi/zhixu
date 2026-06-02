"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  listArtifacts,
  updateArtifactBlock,
  exportArtifactPptx,
  exportArtifactDocx,
  exportArtifactMarkdown,
  confirmHumanGate,
  verifyCitations,
  createVersion,
  listEvidence,
  addEvidence,
  listVersions,
  createArtifactBlock,
  deleteArtifactBlock,
  reorderArtifactBlocks,
  executeAICommand,
  generatePPTSlide,
  generateAllSlides,
  generateDocSection,
  getVersionDiff,
  rollbackVersion,
  sensenovaGenerateImage,
  ApiClientError,
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
  VersionDiffResult,
} from "../../api-client";
import {
  IconSpinner,
  IconCheck,
  IconDownload,
  IconRefresh,
  IconFile,
} from "../../icons";

type ArtifactKind = "ppt" | "document" | "literature" | "exam" | "experiment" | "other";
type AICommand = "shorten" | "expand" | "formalize" | "add_example" | "add_citation" | "paraphrase";

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

const AI_COMMANDS: Array<{ command: AICommand; label: string }> = [
  { command: "shorten", label: "缩短" },
  { command: "expand", label: "扩展" },
  { command: "formalize", label: "学术化" },
  { command: "add_example", label: "加案例" },
  { command: "add_citation", label: "加引用" },
  { command: "paraphrase", label: "改写" },
];

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
  const [pendingExportGate, setPendingExportGate] = useState<{
    format: "pptx" | "docx" | "markdown";
    gateIds: string[];
    message: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"detail" | "version">("detail");
  const [diffV1, setDiffV1] = useState<string | null>(null);
  const [diffV2, setDiffV2] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<VersionDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [evidencePageNumber, setEvidencePageNumber] = useState("");
  const [evidenceTextSpan, setEvidenceTextSpan] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  // SenseNova Image Generation state
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenLoading, setImageGenLoading] = useState(false);
  const [imageGenResult, setImageGenResult] = useState<string | null>(null);
  const [showImageGen, setShowImageGen] = useState(false);

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

  const handleContentJsonUpdate = useCallback(
    async (blockId: string, contentJson: Record<string, unknown>) => {
      if (!currentArtifact) return;
      try {
        await updateArtifactBlock(currentArtifact.id, blockId, {
          contentJson,
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

  const handleAddBlock = useCallback(async () => {
    if (!currentArtifact) return;
    try {
      const maxOrder = currentArtifact.blocks.reduce((max, b) => Math.max(max, b.orderIndex), -1);
      await createArtifactBlock(currentArtifact.id, {
        blockType: artifactKind === "ppt" ? "slide" : "paragraph",
        contentJson: { text: "", title: artifactKind === "ppt" ? "新页面" : "" },
        orderIndex: maxOrder + 1,
        responsibilityColor: "gray",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }, [currentArtifact, artifactKind, loadData]);

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!currentArtifact) return;
      try {
        await deleteArtifactBlock(currentArtifact.id, blockId);
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null);
        }
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除失败");
      }
    },
    [currentArtifact, selectedBlockId, loadData]
  );

  const handleMoveBlock = useCallback(
    async (blockId: string, direction: "up" | "down") => {
      if (!currentArtifact) return;
      const sorted = [...currentArtifact.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
      const idx = sorted.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === sorted.length - 1) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      const newSorted = [...sorted];
      const a = newSorted[idx]!;
      const b = newSorted[swapIdx]!;
      newSorted[idx] = b;
      newSorted[swapIdx] = a;
      const blockIds = newSorted.map((b) => b.id);
      try {
        await reorderArtifactBlocks(currentArtifact.id, blockIds);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "排序失败");
      }
    },
    [currentArtifact, loadData]
  );

  const handleAICommand = useCallback(
    async (command: AICommand) => {
      if (!currentArtifact || !selectedBlock || !projectId) return;
      try {
        setAiLoading(true);
        await executeAICommand(projectId, currentArtifact.id, selectedBlock.id, command);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI命令执行失败");
      } finally {
        setAiLoading(false);
      }
    },
    [currentArtifact, selectedBlock, projectId, loadData]
  );

  const handleGenerateSlide = useCallback(
    async (blockId: string) => {
      if (!currentArtifact || !projectId) return;
      try {
        setGenerating(true);
        await generatePPTSlide(projectId, { artifactId: currentArtifact.id, blockId });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "生成失败");
      } finally {
        setGenerating(false);
      }
    },
    [currentArtifact, projectId, loadData]
  );

  const handleGenerateAllSlides = useCallback(async () => {
    if (!currentArtifact || !projectId) return;
    try {
      setGeneratingAll(true);
      await generateAllSlides(projectId, { artifactId: currentArtifact.id });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量生成失败");
    } finally {
      setGeneratingAll(false);
    }
  }, [currentArtifact, projectId, loadData]);

  const handleGenerateSection = useCallback(
    async (blockId: string) => {
      if (!currentArtifact || !projectId) return;
      try {
        setGenerating(true);
        await generateDocSection(projectId, { artifactId: currentArtifact.id, blockId });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "生成失败");
      } finally {
        setGenerating(false);
      }
    },
    [currentArtifact, projectId, loadData]
  );

  const handleExport = useCallback(
    async (format: "pptx" | "docx" | "markdown") => {
      if (!currentArtifact) return;
      try {
        setExporting(true);
        let blob: Blob;
        if (format === "pptx") blob = await exportArtifactPptx(currentArtifact.id, { userId: "current_user" });
        else if (format === "docx") blob = await exportArtifactDocx(currentArtifact.id, { userId: "current_user" });
        else blob = await exportArtifactMarkdown(currentArtifact.id, { userId: "current_user" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentArtifact.title}.${format === "markdown" ? "md" : format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "HUMAN_GATE_REQUIRED") {
          const gateIds = Array.isArray(err.details.pendingGates)
            ? err.details.pendingGates.filter((gateId): gateId is string => typeof gateId === "string")
            : [];
          setPendingExportGate({
            format,
            gateIds,
            message: err.message || "最终导出需要人工确认"
          });
          await loadData();
          return;
        }
        if (err instanceof ApiClientError && err.code === "VERIFIER_REQUIRED") {
          setError("导出前需要先完成 Verifier 核验，并为绿色内容绑定证据。");
          return;
        }
        setError(err instanceof Error ? err.message : "导出失败");
      } finally {
        setExporting(false);
      }
    },
    [currentArtifact, loadData]
  );

  const handleConfirmExportGate = useCallback(async () => {
    if (!pendingExportGate) return;
    try {
      setExporting(true);
      for (const gateId of pendingExportGate.gateIds) {
        await confirmHumanGate(gateId, { confirmedBy: "current_user" });
      }
      const format = pendingExportGate.format;
      setPendingExportGate(null);
      await loadData();
      await handleExport(format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认导出失败");
    } finally {
      setExporting(false);
    }
  }, [handleExport, loadData, pendingExportGate]);

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

  const handleCompareVersions = useCallback(async () => {
    if (!diffV1 || !diffV2 || !currentArtifact) return;
    try {
      setDiffLoading(true);
      const result = await getVersionDiff("artifact", currentArtifact.id, diffV1, diffV2);
      setDiffResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff对比失败");
    } finally {
      setDiffLoading(false);
    }
  }, [diffV1, diffV2, currentArtifact]);

  const handleRollback = useCallback(async (versionId: string) => {
    try {
      await rollbackVersion(versionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "回滚失败");
    }
  }, [loadData]);

  const handleGenerateImage = useCallback(async () => {
    if (!imagePrompt.trim() || !selectedBlock || !currentArtifact) return;
    try {
      setImageGenLoading(true);
      setImageGenResult(null);
      const result = await sensenovaGenerateImage({ prompt: imagePrompt });
      setImageGenResult(result?.imageUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片生成失败");
    } finally {
      setImageGenLoading(false);
    }
  }, [imagePrompt, selectedBlock, currentArtifact]);

  const handleInsertImage = useCallback(async () => {
    if (!imageGenResult || !selectedBlock || !currentArtifact) return;
    const existingText = (selectedBlock.contentJson.text as string) ?? "";
    const imageMarkdown = `![配图](${imageGenResult})`;
    await handleBlockUpdate(selectedBlock.id, existingText ? `${existingText}\n${imageMarkdown}` : imageMarkdown);
    setImageGenResult(null);
    setShowImageGen(false);
    setImagePrompt("");
  }, [imageGenResult, selectedBlock, currentArtifact, handleBlockUpdate]);

  const handleBindEvidence = useCallback(
    async (ev: EvidenceSummary) => {
      if (!selectedBlock || !currentArtifact) return;
      const existingRefs = Array.isArray(selectedBlock.contentJson["evidenceRefs"])
        ? (selectedBlock.contentJson["evidenceRefs"] as string[])
        : [];
      if (existingRefs.includes(ev.id)) return;
      await handleContentJsonUpdate(selectedBlock.id, {
        ...selectedBlock.contentJson,
        evidenceRefs: [...existingRefs, ev.id],
      });
    },
    [selectedBlock, currentArtifact, handleContentJsonUpdate]
  );

  const handleBindEvidenceWithAnchoring = useCallback(
    async (ev: EvidenceSummary) => {
      if (!selectedBlock || !currentArtifact || !projectId) return;
      const hasAnchoring = evidencePageNumber || evidenceTextSpan || evidenceUrl;
      if (hasAnchoring) {
        try {
          const created = await addEvidence(projectId, {
            ...(ev.sourceId ? { sourceId: ev.sourceId } : {}),
            artifactId: artifactId,
            blockId: selectedBlock.id,
            evidenceType: ev.evidenceType,
            ...(ev.quoteText ? { quoteText: ev.quoteText } : {}),
            ...(evidencePageNumber || ev.pageNumber ? { pageNumber: evidencePageNumber ? Number(evidencePageNumber) : ev.pageNumber! } : {}),
            ...(evidenceTextSpan || ev.textSpan ? { textSpan: (evidenceTextSpan || ev.textSpan!) as string } : {}),
            confidence: ev.confidence,
          });
          const existingRefs = Array.isArray(selectedBlock.contentJson["evidenceRefs"])
            ? (selectedBlock.contentJson["evidenceRefs"] as string[])
            : [];
          await handleContentJsonUpdate(selectedBlock.id, {
            ...selectedBlock.contentJson,
            evidenceRefs: [...existingRefs, created.id],
          });
          setEvidencePageNumber("");
          setEvidenceTextSpan("");
          setEvidenceUrl("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "带锚定绑定失败");
        }
      } else {
        await handleBindEvidence(ev);
      }
    },
    [selectedBlock, currentArtifact, projectId, artifactId, evidencePageNumber, evidenceTextSpan, evidenceUrl, handleContentJsonUpdate, handleBindEvidence]
  );

  if (loading && !currentArtifact) {
    return (
      <main className="studio-shell">
        <header className="studio-header">
          <div className="studio-header-info">
            <p className="eyebrow">Artifact Studio</p>
            <div className="skeleton skeleton-title" style={{ width: "40%" }} />
            <div className="skeleton skeleton-text" style={{ width: "60%", marginTop: 8 }} />
          </div>
        </header>
        <div className="studio-body">
          <aside className="studio-console">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="console-section">
                <div className="skeleton skeleton-text" style={{ width: "40%" }} />
                <div className="skeleton skeleton-text" style={{ width: "70%" }} />
              </div>
            ))}
          </aside>
          <section className="studio-canvas">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />
            ))}
          </section>
          <aside className="studio-inspector">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="inspector-section">
                <div className="skeleton skeleton-text" style={{ width: "50%" }} />
                <div className="skeleton skeleton-text" style={{ width: "80%" }} />
              </div>
            ))}
          </aside>
        </div>
      </main>
    );
  }

  if (error && !currentArtifact) {
    return (
      <main className="studio-shell">
        <div className="studio-error">
          <p>{error}</p>
          <button onClick={loadData} className="btn-primary">
            <IconRefresh size={16} />
            重试
          </button>
        </div>
      </main>
    );
  }

  if (!currentArtifact) {
    return (
      <main className="studio-shell">
        <div className="studio-error">
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
        <div className="studio-header-info">
          <p className="eyebrow">Artifact Studio</p>
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
            {pendingExportGate && (
              <div className="export-gate-panel">
                <div>
                  <strong>导出待确认</strong>
                  <p>{pendingExportGate.message}</p>
                </div>
                <button
                  className="console-action-btn"
                  onClick={handleConfirmExportGate}
                  disabled={exporting || pendingExportGate.gateIds.length === 0}
                >
                  <IconCheck size={14} />
                  确认并导出
                </button>
              </div>
            )}
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
                onClick={handleAddBlock}
              >
                + 添加块
              </button>
              {artifactKind === "ppt" && (
                <button
                  className="console-action-btn"
                  onClick={handleGenerateAllSlides}
                  disabled={generatingAll}
                >
                  {generatingAll ? <IconSpinner size={14} /> : null}
                  批量生成
                </button>
              )}
              <button
                className="console-action-btn"
                onClick={() => handleExport("pptx")}
                disabled={exporting}
              >
                <IconDownload size={14} />
                PPTX
              </button>
              <button
                className="console-action-btn"
                onClick={() => handleExport("docx")}
                disabled={exporting}
              >
                <IconDownload size={14} />
                DOCX
              </button>
              <button
                className="console-action-btn"
                onClick={() => handleExport("markdown")}
                disabled={exporting}
              >
                <IconDownload size={14} />
                MD
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
                const isEditingBlock = isSelected && editing;
                return (
                  <div
                    key={block.id}
                    className={`canvas-slide ${isSelected ? "canvas-slide-selected" : ""}`}
                    onClick={() => {
                      setSelectedBlockId(block.id);
                      setEditing(false);
                    }}
                  >
                    <div className={`canvas-slide-inner resp-border-${block.responsibilityColor}`}>
                      <div className="block-toolbar">
                        <span className="slide-type-tag">{block.blockType}</span>
                        <div className="block-toolbar-actions">
                          <button
                            className="block-move-btn"
                            onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "up"); }}
                            title="上移"
                          >↑</button>
                          <button
                            className="block-move-btn"
                            onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "down"); }}
                            title="下移"
                          >↓</button>
                          <button
                            className="block-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                            title="删除"
                          >×</button>
                        </div>
                      </div>
                      <div className="slide-content canvas-block-editable">
                        {isEditingBlock ? (
                          <textarea
                            ref={textareaRef}
                            className="canvas-block-editing"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => handleBlockUpdate(block.id, editContent)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditing(false);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditContent((block.contentJson.text as string) ?? "");
                              setEditing(true);
                            }}
                          >
                            <strong>{(block.contentJson.title as string) ?? ""}</strong>
                            <p>{(block.contentJson.text as string) ?? ""}</p>
                          </div>
                        )}
                      </div>
                      <div className="slide-footer">
                        <span className={`status-badge status-${block.verificationStatus}`}>
                          {block.verificationStatus}
                        </span>
                        <span className={`resp-tag resp-${block.responsibilityColor}`}>
                          {block.responsibilityColor}
                        </span>
                        {!(block.contentJson.text as string) && (
                          <button
                            className="block-toolbar-btn"
                            onClick={(e) => { e.stopPropagation(); handleGenerateSlide(block.id); }}
                            disabled={generating}
                          >
                            {generating ? <IconSpinner size={12} /> : "生成"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button className="block-add-btn" onClick={handleAddBlock}>
                + 添加页面
              </button>
            </div>
          )}

          {artifactKind === "document" && (
            <div className="canvas-document">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                const isEditingBlock = isSelected && editing;
                return (
                  <div
                    key={block.id}
                    className={`canvas-paragraph ${isSelected ? "canvas-paragraph-selected" : ""}`}
                    onClick={() => {
                      setSelectedBlockId(block.id);
                      setEditing(false);
                    }}
                  >
                    <div className={`paragraph-resp-bar resp-bg-${block.responsibilityColor}`} />
                    <div className="paragraph-body">
                      <div className="block-toolbar">
                        <div className="paragraph-type">{block.blockType}</div>
                        <div className="block-toolbar-actions">
                          <button
                            className="block-move-btn"
                            onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "up"); }}
                            title="上移"
                          >↑</button>
                          <button
                            className="block-move-btn"
                            onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "down"); }}
                            title="下移"
                          >↓</button>
                          <button
                            className="block-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                            title="删除"
                          >×</button>
                        </div>
                      </div>
                      <div className="paragraph-text canvas-block-editable">
                        {isEditingBlock ? (
                          <textarea
                            ref={textareaRef}
                            className="canvas-block-editing"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => handleBlockUpdate(block.id, editContent)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditing(false);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditContent((block.contentJson.text as string) ?? "");
                              setEditing(true);
                            }}
                          >
                            {block.blockType === "heading" ? (
                              <strong>{(block.contentJson.text as string) ?? ""}</strong>
                            ) : (
                              <p>{(block.contentJson.text as string) ?? ""}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="paragraph-meta">
                        <span className={`resp-tag resp-${block.responsibilityColor}`}>
                          {block.responsibilityColor}
                        </span>
                        <span className={`status-badge status-${block.verificationStatus}`}>
                          {block.verificationStatus}
                        </span>
                        {block.blockType === "paragraph" && !(block.contentJson.text as string) && (
                          <button
                            className="block-toolbar-btn"
                            onClick={(e) => { e.stopPropagation(); handleGenerateSection(block.id); }}
                            disabled={generating}
                          >
                            {generating ? <IconSpinner size={12} /> : "生成"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button className="block-add-btn" onClick={handleAddBlock}>
                + 添加段落
              </button>
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
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((block) => (
                    <tr
                      key={block.id}
                      className={`lit-row ${block.id === selectedBlockId ? "lit-row-selected" : ""}`}
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setEditing(false);
                      }}
                    >
                      <td>{block.blockType}</td>
                      <td>{(block.contentJson.type as string) ?? "—"}</td>
                      <td className="lit-content canvas-block-editable">
                        {selectedBlockId === block.id && editing ? (
                          <textarea
                            className="canvas-block-editing"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => handleBlockUpdate(block.id, editContent)}
                            autoFocus
                          />
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditContent((block.contentJson.text as string) ?? "");
                              setEditing(true);
                            }}
                          >
                            {(block.contentJson.text as string) ?? ""}
                          </div>
                        )}
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
                      <td>
                        <button
                          className="block-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="block-add-btn" onClick={handleAddBlock}>
                + 添加条目
              </button>
            </div>
          )}

          {(artifactKind === "exam" || artifactKind === "experiment" || artifactKind === "other") && (
            <div className="canvas-generic">
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                const isEditingBlock = isSelected && editing;
                return (
                  <div
                    key={block.id}
                    className={`generic-block ${isSelected ? "generic-block-selected" : ""}`}
                    onClick={() => {
                      setSelectedBlockId(block.id);
                      setEditing(false);
                    }}
                  >
                    <div className="block-toolbar">
                      <div className="generic-block-type">{block.blockType}</div>
                      <div className="block-toolbar-actions">
                        <button
                          className="block-move-btn"
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "up"); }}
                        >↑</button>
                        <button
                          className="block-move-btn"
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "down"); }}
                        >↓</button>
                        <button
                          className="block-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                        >×</button>
                      </div>
                    </div>
                    <div className="generic-block-text canvas-block-editable">
                      {isEditingBlock ? (
                        <textarea
                          ref={textareaRef}
                          className="canvas-block-editing"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => handleBlockUpdate(block.id, editContent)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditing(false);
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditContent((block.contentJson.text as string) ?? "");
                            setEditing(true);
                          }}
                        >
                          {(block.contentJson.text as string) ?? ""}
                        </div>
                      )}
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
              <button className="block-add-btn" onClick={handleAddBlock}>
                + 添加块
              </button>
            </div>
          )}
        </section>

        <aside className="studio-inspector">
          <div className="inspector-tabs">
            <button
              className={`inspector-tab ${inspectorTab === "detail" ? "inspector-tab-active" : ""}`}
              onClick={() => setInspectorTab("detail")}
            >
              详情
            </button>
            <button
              className={`inspector-tab ${inspectorTab === "version" ? "inspector-tab-active" : ""}`}
              onClick={() => setInspectorTab("version")}
            >
              版本
            </button>
          </div>

          {inspectorTab === "version" && (
            <div className="diff-panel">
              <div className="diff-version-list">
                <div className="inspector-label">版本历史</div>
                {versions.length === 0 && (
                  <div className="console-empty">暂无版本</div>
                )}
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`diff-version-item ${diffV1 === v.id ? "diff-version-selected diff-v1" : ""} ${diffV2 === v.id ? "diff-version-selected diff-v2" : ""}`}
                  >
                    <div className="diff-version-info">
                      <span className="version-reason">{v.createdReason}</span>
                      <span className="version-time">{formatDt(v.createdAt)}</span>
                      <span className="diff-version-author">{v.createdBy}</span>
                    </div>
                    <div className="diff-version-actions">
                      <button
                        className={`diff-select-btn ${diffV1 === v.id ? "diff-select-v1" : ""}`}
                        onClick={() => setDiffV1(diffV1 === v.id ? null : v.id)}
                      >
                        V1
                      </button>
                      <button
                        className={`diff-select-btn ${diffV2 === v.id ? "diff-select-v2" : ""}`}
                        onClick={() => setDiffV2(diffV2 === v.id ? null : v.id)}
                      >
                        V2
                      </button>
                      <button
                        className="diff-rollback-btn"
                        onClick={() => handleRollback(v.id)}
                      >
                        回滚
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="diff-compare">
                <button
                  className="btn-primary btn-sm"
                  onClick={handleCompareVersions}
                  disabled={!diffV1 || !diffV2 || diffLoading}
                >
                  {diffLoading ? <IconSpinner size={14} /> : "对比差异"}
                </button>
                {diffV1 && diffV2 && (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => { setDiffResult(null); setDiffV1(null); setDiffV2(null); }}
                  >
                    清除选择
                  </button>
                )}
              </div>

              {diffResult && (
                <div className="diff-result">
                  <div className="diff-summary">
                    <span className="diff-stat diff-stat-added">+{diffResult.summary.added} 新增</span>
                    <span className="diff-stat diff-stat-modified">~{diffResult.summary.modified} 修改</span>
                    <span className="diff-stat diff-stat-removed">-{diffResult.summary.deleted} 删除</span>
                  </div>

                  {diffResult.additions.length > 0 && (
                    <div className="diff-section">
                      <div className="inspector-label">新增内容</div>
                      {diffResult.additions.map((item, i) => (
                        <div key={i} className="diff-line diff-added">
                          <span className="diff-field">{item.field}</span>
                          <span className="diff-value">{JSON.stringify(item.value, null, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {diffResult.modifications.length > 0 && (
                    <div className="diff-section">
                      <div className="inspector-label">修改内容</div>
                      {diffResult.modifications.map((item, i) => (
                        <div key={i} className="diff-line diff-modified">
                          <span className="diff-field">{item.field}</span>
                          <div className="diff-values">
                            <span className="diff-old">{JSON.stringify(item.oldValue, null, 2)}</span>
                            <span className="diff-new">{JSON.stringify(item.newValue, null, 2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {diffResult.deletions.length > 0 && (
                    <div className="diff-section">
                      <div className="inspector-label">删除内容</div>
                      {diffResult.deletions.map((item, i) => (
                        <div key={i} className="diff-line diff-removed">
                          <span className="diff-field">{item.field}</span>
                          <span className="diff-value">{JSON.stringify(item.value, null, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {inspectorTab === "detail" && (
            selectedBlock ? (
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
                <div className="evidence-bind-list">
                  {blockEvidence.length === 0 && (
                    <div className="inspector-empty">无关联证据</div>
                  )}
                  {blockEvidence.map((e) => (
                    <div key={e.id} className={`evidence-bind-item resp-border-${e.responsibilityColor}`}>
                      <strong>{e.evidenceType}</strong>
                      {e.quoteText && (
                        <p className="inspector-evidence-quote">"{e.quoteText}"</p>
                      )}
                      <span>置信度：{Math.round(e.confidence * 100)}%</span>
                    </div>
                  ))}
                  {evidence.filter((e) => e.artifactId !== artifactId || e.blockId !== selectedBlockId).length > 0 && (
                    <div className="evidence-anchor-fields">
                      <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                        来源锚定（可选）
                      </label>
                      <input
                        type="number"
                        placeholder="页码"
                        value={evidencePageNumber}
                        onChange={(e) => setEvidencePageNumber(e.target.value)}
                        style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 6 }}
                      />
                      <input
                        type="text"
                        placeholder="段落/引用文本"
                        value={evidenceTextSpan}
                        onChange={(e) => setEvidenceTextSpan(e.target.value)}
                        style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 6 }}
                      />
                      <input
                        type="url"
                        placeholder="外部来源 URL"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 6 }}
                      />
                    </div>
                  )}
                  {evidence.filter((e) => e.artifactId !== artifactId || e.blockId !== selectedBlockId).length > 0 && (
                    <div className="evidence-bind-section">
                      <div className="inspector-label">可绑定证据</div>
                      {evidence
                        .filter((e) => e.artifactId !== artifactId || e.blockId !== selectedBlockId)
                        .slice(0, 5)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="evidence-bind-item evidence-bind-available"
                            onClick={() => handleBindEvidenceWithAnchoring(e)}
                          >
                            <strong>{e.evidenceType}</strong>
                            {e.quoteText && <span>"{e.quoteText.slice(0, 40)}…"</span>}
                            <span className="evidence-bind-action">绑定</span>
                          </div>
                        ))}
                    </div>
                  )}
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
                        <IconCheck size={14} />
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

              <div className="inspector-section">
                <div className="inspector-label">AI 命令</div>
                <div className="ai-command-menu">
                  {AI_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.command}
                      className="ai-command-item"
                      onClick={() => handleAICommand(cmd.command)}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <IconSpinner size={12} /> : cmd.label}
                    </button>
                  ))}
                </div>
              </div>

              {artifactKind === "ppt" && (
                <div className="inspector-section">
                  <div className="inspector-label">PPT 操作</div>
                  <div className="inspector-ppt-actions">
                    <button
                      className="console-action-btn"
                      onClick={() => handleGenerateSlide(selectedBlock.id)}
                      disabled={generating}
                    >
                      {generating ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
                      生成本页
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
                    <button
                      className="console-action-btn"
                      onClick={() => setShowImageGen(!showImageGen)}
                    >
                      生成配图
                    </button>
                  </div>
                  {showImageGen && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="描述你想要的配图..."
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleGenerateImage(); }}
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 6 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn-primary btn-sm"
                          onClick={handleGenerateImage}
                          disabled={imageGenLoading || !imagePrompt.trim()}
                        >
                          {imageGenLoading ? <IconSpinner size={14} /> : "生成"}
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => { setShowImageGen(false); setImageGenResult(null); setImagePrompt(""); }}
                        >
                          取消
                        </button>
                      </div>
                      {imageGenResult && (
                        <div style={{ marginTop: 8, border: "1px solid var(--color-border-card)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                          <img src={imageGenResult} alt="生成的配图" style={{ width: "100%", display: "block" }} />
                          <div style={{ padding: 6, display: "flex", gap: 6 }}>
                            <button className="btn-primary btn-sm" onClick={handleInsertImage}>
                              插入到当前块
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {artifactKind === "document" && selectedBlock.blockType === "paragraph" && (
                <div className="inspector-section">
                  <div className="inspector-label">段落操作</div>
                  <div className="inspector-ppt-actions">
                    <button
                      className="console-action-btn"
                      onClick={() => handleGenerateSection(selectedBlock.id)}
                      disabled={generating}
                    >
                      {generating ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
                      生成内容
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
              <IconFile size={32} style={{ color: "var(--color-text-muted)", marginBottom: 12 }} />
              选择一个内容块查看详情
            </div>
          )
          )}
        </aside>
      </div>

      {error && <div className="command-error studio-error">{error}</div>}
    </main>
  );
}
