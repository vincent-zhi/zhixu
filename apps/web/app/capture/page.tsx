"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createProject,
  addSource,
  postProjectEvent,
  type StewardWorkflowRun,
} from "../api-client";
import type { ProjectType } from "@zhixu/core";

interface TaskTypeChip {
  label: string;
  type: ProjectType | "other";
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  parseStatus: "pending" | "parsing" | "parsed" | "error";
}

const TASK_TYPE_CHIPS: TaskTypeChip[] = [
  { label: "做PPT", type: "presentation" },
  { label: "写报告", type: "coursework" },
  { label: "读论文", type: "paper_reading" },
  { label: "准备考试", type: "exam_review" },
  { label: "整理实验", type: "experiment" },
  { label: "导师反馈", type: "other" },
  { label: "小组作业", type: "coursework" },
  { label: "上传资料", type: "other" },
];

const TYPE_LABELS: Record<string, string> = {
  presentation: "做PPT",
  coursework: "写报告",
  paper_reading: "读论文",
  literature_review: "文献综述",
  exam_review: "准备考试",
  experiment: "整理实验",
  research: "研究",
  other: "其他",
};

export default function CapturePage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [selectedType, setSelectedType] = useState<ProjectType>("other");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<StewardWorkflowRun | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = useCallback(
    (files: FileList | null, source: "file" | "camera") => {
      if (!files) return;
      const newFiles: AttachedFile[] = Array.from(files).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        type: f.type || "application/octet-stream",
        size: f.size,
        parseStatus: "pending" as const,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    },
    []
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: AttachedFile[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name || `screenshot-${Date.now()}.png`,
              type: file.type,
              size: file.size,
              parseStatus: "pending",
            });
          }
        }
      }
      if (imageFiles.length > 0) {
        setAttachedFiles((prev) => [...prev, ...imageFiles]);
      }
    },
    []
  );

  const handleVoiceInput = useCallback(() => {
    const SpeechRecognitionCtor =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor || typeof SpeechRecognitionCtor !== "function") return;

    const recognition = new (SpeechRecognitionCtor as new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    })();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const project = await createProject({
        workspaceId: "default",
        ownerId: "user",
        title: description.trim().slice(0, 120),
        type: selectedType,
        description: description.trim(),
        priority: 3,
        privacyMode: "cloud",
        riskLevel: "L1",
      });

      setCreatedProjectId(project.id);

      for (const file of attachedFiles) {
        try {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, parseStatus: "parsing" as const } : f
            )
          );
          await addSource(project.id, {
            uploadedBy: "user",
            fileName: file.name,
            fileType: file.type,
            storageUri: `local://${file.name}`,
            sensitivityLevel: "normal",
          });
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, parseStatus: "parsed" as const } : f
            )
          );
        } catch {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, parseStatus: "error" as const } : f
            )
          );
        }
      }

      const workflow = await postProjectEvent(project.id, {
        eventType: "user_goal_submitted",
        actorId: "user",
      });
      setWorkflowResult(workflow);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "任务提交失败，请重试"
      );
    } finally {
      setSubmitting(false);
    }
  }, [description, selectedType, attachedFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseStatusLabel = (status: AttachedFile["parseStatus"]): string => {
    switch (status) {
      case "pending":
        return "等待解析";
      case "parsing":
        return "解析中…";
      case "parsed":
        return "已解析";
      case "error":
        return "解析失败";
    }
  };

  if (workflowResult && createdProjectId) {
    return (
      <main className="shell">
        <section className="capture-result">
          <div className="capture-result-card">
            <span className="status-dot" />
            <p className="eyebrow">AI 正在理解你的任务</p>
            <h2>任务已提交</h2>
            <p className="capture-result-type">
              类型：{TYPE_LABELS[selectedType] ?? selectedType}
            </p>

            {workflowResult.steps.length > 0 && (
              <div className="workflow-steps">
                {workflowResult.steps.map((step, i) => (
                  <div
                    key={i}
                    className={`workflow-step workflow-step-${step.status}`}
                  >
                    <span className="workflow-step-name">{step.name}</span>
                    <span className="workflow-step-status">
                      {step.status === "completed"
                        ? "完成"
                        : step.status === "skipped"
                          ? "跳过"
                          : "失败"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {workflowResult.riskFlags.length > 0 && (
              <div className="workflow-flags">
                <p>风险标记：</p>
                <ul>
                  {workflowResult.riskFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="capture-result-actions">
              <button
                className="btn-primary"
                onClick={() => router.push(`/review?projectId=${createdProjectId}`)}
              >
                查看进度
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setWorkflowResult(null);
                  setCreatedProjectId(null);
                  setDescription("");
                  setAttachedFiles([]);
                  setSelectedType("other");
                }}
              >
                继续添加
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="capture-hero">
        <p className="eyebrow">Task Capture</p>
        <h1>把任务丢给知序。</h1>
        <p className="capture-lede">
          描述你的任务，上传资料，AI 会帮你理解、拆解、规划。
        </p>
      </section>

      <section className="capture-input-card">
        <textarea
          ref={textareaRef}
          className="capture-textarea"
          placeholder="描述你的任务… 例如：下周三要交机器学习课程的 PPT，10 分钟 presentation"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onPaste={handlePaste}
          rows={4}
        />

        <div className="capture-actions">
          <button
            className="capture-action-btn"
            onClick={handleVoiceInput}
            title="语音输入"
            disabled={listening}
          >
            {listening ? "🎙️ 听写中…" : "🎤 语音"}
          </button>
          <button
            className="capture-action-btn"
            onClick={() => cameraInputRef.current?.click()}
            title="拍照"
          >
            📷 拍照
          </button>
          <button
            className="capture-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="上传文件"
          >
            📎 文件
          </button>
          <button
            className="capture-action-btn"
            onClick={async () => {
              try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                  for (const type of item.types) {
                    if (type.startsWith("image/")) {
                      const blob = await item.getType(type);
                      setAttachedFiles((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          name: `clipboard-${Date.now()}.png`,
                          type,
                          size: blob.size,
                          parseStatus: "pending",
                        },
                      ]);
                    }
                  }
                }
              } catch {
                // clipboard read not supported or denied
              }
            }}
            title="粘贴截图"
          >
            🖼️ 截图
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files, "file")}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files, "camera")}
          />
        </div>

        <div className="capture-chips">
          {TASK_TYPE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              className={`capture-chip ${selectedType === chip.type ? "capture-chip-active" : ""}`}
              onClick={() => setSelectedType(chip.type)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <button
          className="btn-primary capture-submit"
          disabled={!description.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "提交中…" : "交给知序"}
        </button>

        {error && <p className="capture-error">{error}</p>}
      </section>

      {attachedFiles.length > 0 && (
        <section className="capture-materials">
          <h2>已添加资料</h2>
          <div className="material-stack">
            {attachedFiles.map((file) => (
              <article key={file.id} className="material-card">
                <div className="material-card-main">
                  <strong className="material-name">{file.name}</strong>
                  <span className="material-type">{file.type.split("/").pop()}</span>
                </div>
                <div className="material-card-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span className={`material-parse material-parse-${file.parseStatus}`}>
                    {parseStatusLabel(file.parseStatus)}
                  </span>
                  <button
                    className="material-remove"
                    onClick={() => removeFile(file.id)}
                  >
                    移除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
