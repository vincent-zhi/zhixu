"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ApiClientError,
  chat,
  chatStream,
  confirmHumanGate,
  convertChatToDocument,
  createProject,
  generateAllSlides,
  exportArtifactPptx,
  listArtifactBlocks,
  postProjectEvent,
  workspaceFileDownloadUrl,
  createAgentSession,
  updateAgentSession,
  type ChatResult,
  type ArtifactBlockSummary,
} from "./api-client";
import { useChat, type Msg, type AssistantMsg } from "./chat-context";
import {
  IconBook,
  IconBrain,
  IconCheck,
  IconChevronRight,
  IconDocument,
  IconExam,
  IconExperiment,
  IconFeedback,
  IconPaper,
  IconPPT,
  IconPrivacy,
  IconSend,
  IconWarning,
  IconZhiXu,
} from "./icons";
import { AgentProcessPanel } from "./components/agent-process-panel";
import { DecisionCardSet } from "./components/decision-card-set";
import { TaskBriefCard } from "./components/task-brief-card";
import { CanvasPanel } from "./components/canvas-panel";

type ToolCallInfo = { name: string; result?: string; loading?: boolean };

const SUGGESTIONS = [
  { icon: IconPPT, label: "做课程 PPT", desc: "上传资料，自动选题、大纲、讲稿、导出", prompt: "帮我做一份课程 PPT，需要先给我 3 个选题方向" },
  { icon: IconPaper, label: "组会论文汇报", desc: "上传多篇论文，自动精读、对比、做 PPT", prompt: "帮我读这几篇论文，做组会汇报 PPT" },
  { icon: IconDocument, label: "写报告", desc: "把要求、资料和证据整理成可编辑文档", prompt: "帮我整理一份课程报告，先拆解结构和资料缺口" },
  { icon: IconExam, label: "备考", desc: "重排计划，生成题目和错题归因", prompt: "帮我制定期末复习计划，按风险和掌握度排序" },
  { icon: IconExperiment, label: "实验", desc: "记录参数、异常归因和下次计划", prompt: "帮我整理实验记录，并生成下次实验计划" },
  { icon: IconFeedback, label: "导师反馈", desc: "拆解意见，绑定位置，追踪整改", prompt: "导师给了修改意见，帮我拆成可执行清单" },
];

const SKILL_LABELS: Record<string, string> = {
  list_projects: "查找项目",
  skill_project_list: "查找项目",
  skill_source_intake: "导入资料",
  skill_literature_search: "文献检索",
  skill_knowledge_summarize: "知识总结",
  skill_ppt_export: "生成 PPT",
  skill_docx_export: "生成文档",
  skill_exam_generate: "生成试题",
  skill_experiment_plan: "实验规划",
  skill_web_research: "网络调研",
  skill_translation: "翻译",
  skill_outline_generate: "生成大纲",
  skill_citation_verify: "引用核验",
  skill_risk_assess: "风险评估",
  thinking: "理解任务",
  read_file: "读取文件",
  write_file: "写入文件",
  patch: "编辑文件",
  list_dir: "查看目录",
  search_files: "搜索文件",
  terminal: "执行命令",
  web_search: "联网搜索",
  web_extract: "提取网页",
  execute_code: "执行代码",
  create_pptx: "生成 PPT",
  create_docx: "生成文档",
  delete_file: "删除文件",
  append_file: "追加内容",
};

function getSkillLabel(name: string): string {
  return SKILL_LABELS[name] ?? name.replace(/^skill_/, "").replace(/_/g, " ");
}

function renderMarkdown(raw: string): string {
  let html = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  html = html.replace(/((?:^\|[^\n]+\|$\n?)+)/gm, (block) => {
    const rows = block.trim().split("\n").filter((line) => line.trim().length > 0);
    if (rows.length < 2) return block;
    const headerRow = rows[0] ?? "";
    const isSeparator = (line: string) => /^\|[\s\-:]+\|$/.test(line.trim());
    const dataRows = rows.slice(1).filter((row) => !isSeparator(row));
    if (dataRows.length === 0) return block;

    const parseCells = (line: string) => {
      const trimmed = line.trim();
      const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
      const clean = inner.endsWith("|") ? inner.slice(0, -1) : inner;
      return clean.split("|").map((cell) => cell.trim());
    };

    const headerCells = parseCells(headerRow).map((cell) => `<th>${cell}</th>`).join("");
    const bodyRows = dataRows
      .map((row) => `<tr>${parseCells(row).map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, "<ul>$1</ul>");
  html = html.replace(/^---$/gm, "<hr />");
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = html.replace(/\n/g, " ");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<(h[1-4]|hr|ul|table)/g, "<$1");
  html = html.replace(/<\/(h[1-4]|ul|table)>\s*<\/p>/g, "</$1>");
  return html;
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function toToolCallInfo(result: NonNullable<ChatResult["toolResults"]>[number]): ToolCallInfo {
  const toolCall: ToolCallInfo = { name: result.functionName, loading: false };
  if (result.result) toolCall.result = result.result.slice(0, 300);
  return toolCall;
}

function ToolCallCard({ toolCall, index }: { toolCall: ToolCallInfo; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      className={`conv-tool-card${toolCall.loading ? " conv-tool-card-loading" : " conv-tool-card-done"}`}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => setExpanded((value) => !value)}
    >
      <span className={`conv-tool-icon${toolCall.loading ? " conv-tool-icon-loading" : " conv-tool-icon-done"}`}>
        {toolCall.loading ? <span className="conv-tool-spinner" /> : <IconCheck size={14} />}
      </span>
      <span className="conv-tool-body">
        <span className="conv-tool-name">{toolCall.loading ? "正在理解任务" : getSkillLabel(toolCall.name)}</span>
        {toolCall.result && <span className="conv-tool-result">{expanded ? toolCall.result : toolCall.result.slice(0, 72)}</span>}
      </span>
      <IconChevronRight size={14} className={expanded ? "rotate-90" : ""} />
    </button>
  );
}

function PPTCanvasPanel({ projectId, artifactId, onClose }: { projectId: string; artifactId: string; onClose: () => void }) {
  const [blocks, setBlocks] = useState<ArtifactBlockSummary[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listArtifactBlocks(artifactId)
      .then((d) => {
        setBlocks(d);
        if (d.length > 0) setSelectedBlockId(d[0]!.id);
      })
      .catch(() => {});
  }, [artifactId]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const result = await generateAllSlides(projectId, { artifactId });
      setBlocks(result);
      if (result.length > 0 && !selectedBlockId) setSelectedBlockId(result[0]!.id);
    } catch {}
    setGenerating(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportArtifactPptx(artifactId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presentation.pptx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  return (
    <div className="ppt-canvas-panel">
      <div className="ppt-canvas-header">
        <h3>PPT 共创</h3>
        <button type="button" className="ppt-canvas-close" onClick={onClose}>✕</button>
      </div>
      <div className="ppt-canvas-body">
        <div className="ppt-outline">
          {blocks.length === 0 && (
            <div className="ppt-outline-empty">暂无页面，请先生成大纲</div>
          )}
          {blocks.map((block, i) => (
            <div
              key={block.id}
              className={`ppt-outline-item${selectedBlockId === block.id ? " ppt-outline-item-selected" : ""}`}
              onClick={() => setSelectedBlockId(block.id)}
            >
              <span className="ppt-slide-num">{i + 1}</span>
              <span className="ppt-slide-title">{(block.contentJson as Record<string, unknown>)?.title as string ?? `第${i + 1}页`}</span>
            </div>
          ))}
        </div>
        <div className="ppt-preview">
          {selectedBlock ? (
            <div className="ppt-slide-preview">
              <div className="ppt-slide-preview-title">
                {(selectedBlock.contentJson as Record<string, unknown>)?.title as string ?? ""}
              </div>
              <div className="ppt-slide-preview-text">
                {((selectedBlock.contentJson as Record<string, unknown>)?.text as string ?? "")
                  .split("\n")
                  .map((line, i) => (
                    <div key={i} className="ppt-slide-bullet">{line.replace(/^[•\-\*]\s*/, "")}</div>
                  ))}
              </div>
              {!(selectedBlock.contentJson as Record<string, unknown>)?.text && (
                <div className="ppt-slide-preview-outline">
                  大纲：{(selectedBlock.contentJson as Record<string, unknown>)?.outline as string ?? "待生成"}
                </div>
              )}
            </div>
          ) : (
            <div className="ppt-preview-empty">选择一页查看预览</div>
          )}
        </div>
      </div>
      <div className="ppt-canvas-actions">
        <button type="button" className="btn-primary" onClick={handleGenerateAll} disabled={generating}>
          {generating ? "生成中..." : "生成全部页面"}
        </button>
        <button type="button" className="btn-secondary" onClick={handleExport} disabled={blocks.length === 0 || exporting}>
          {exporting ? "导出中..." : "导出 PPTX"}
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { session, setSession, addMessage, updateLastAssistant, updateAgentCard, setCollaboration, clearSession, setStreaming } = useChat();
  const { messages, projectId, agentSessionId, agentCards, collaboration } = session;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentPanelExpanded, setAgentPanelExpanded] = useState(false);
  const [converting, setConverting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef("");
  const contentRef = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConvertToDoc = useCallback(async () => {
    if (messages.length === 0) return;
    setConverting(true);
    try {
      const result = await convertChatToDocument({
        messages: messages
          .filter(m => "content" in m)
          .map(m => ({ role: m.role, content: (m as { content?: string }).content ?? "" })),
      });
      if (result.artifactId) {
        window.location.href = `/studio/${result.artifactId}${result.projectId ? `?projectId=${result.projectId}` : ""}`;
      }
    } catch (e) {
      console.error("Convert to doc failed:", e);
    } finally {
      setConverting(false);
    }
  }, [messages]);

  const ensureProject = useCallback(async (firstMessage: string): Promise<string> => {
    if (projectId) return projectId;
    const project = await createProject({
      workspaceId: "default",
      ownerId: "user",
      title: firstMessage.slice(0, 80),
      type: "other",
      priority: 3,
      privacyMode: "local_first",
      riskLevel: "L1",
    });
    setSession({ ...session, projectId: project.id });
    await postProjectEvent(project.id, { eventType: "user_goal_submitted", actorId: "user" }).catch(() => {});
    return project.id;
  }, [projectId, session, setSession]);

  const ensureAgentSession = useCallback(async (pid: string, intent?: string): Promise<string> => {
    if (agentSessionId) return agentSessionId;
    const input: { projectId: string; workflowIntent?: string } = { projectId: pid };
    if (intent) input.workflowIntent = intent;
    const as = await createAgentSession(input);
    setSession((prev) => ({ ...prev, agentSessionId: as.id }));
    return as.id;
  }, [agentSessionId, setSession]);

  const handleDecisionSelect = useCallback(async (optionId: string) => {
    if (!agentSessionId) return;
    try {
      await updateAgentSession(agentSessionId, { selectedDecision: optionId });
      addMessage({ role: "system", content: `已选择方案 ${optionId}，Agent 正在推进...` });
    } catch {}
  }, [agentSessionId, addMessage]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setInput("");
    setSending(true);
    setStreaming(true);
    addMessage({ role: "user", content });

    try {
      const pid = await ensureProject(content);
      await ensureAgentSession(pid);

      const history = messages
        .filter((message): message is Msg & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
        .map((message) => {
          if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
            const toolInfo = message.toolCalls
              .map((toolCall) => `[调用工具: ${getSkillLabel(toolCall.name)}]${toolCall.result ? ` 结果: ${toolCall.result}` : ""}`)
              .join("\n");
            return { role: "assistant" as const, content: message.content ? `${message.content}\n${toolInfo}` : toolInfo };
          }
          return { role: message.role, content: message.content };
        });
      history.push({ role: "user", content });

      addMessage({ role: "assistant", content: "", thinking: "正在思考..." });

      thinkingRef.current = "";
      contentRef.current = "";

      let streamUsed = false;
      let lastRenderTime = 0;
      const RENDER_INTERVAL = 150;

      const throttledUpdate = (update: Partial<AssistantMsg>) => {
        const now = Date.now();
        if (now - lastRenderTime >= RENDER_INTERVAL) {
          lastRenderTime = now;
          updateLastAssistant(update);
        }
      };

      const FILE_PATTERNS = [
        { regex: /(PPTX created|DOCX created|File written):\s*(\S+\.(?:pptx|docx|py|js|ts|json|txt|md|csv|html|css))/i, group: 2 },
        { regex: /Content appended to:\s*(\S+)/i, group: 1 },
      ];

      function extractFileInfo(text: string): Array<{ name: string; path: string }> {
        const files: Array<{ name: string; path: string }> = [];
        for (const pat of FILE_PATTERNS) {
          const match = pat.regex.exec(text);
          if (match && match[pat.group]) {
            const filePath = match[pat.group]!;
            files.push({ name: filePath.split("/").pop() ?? filePath, path: filePath });
          }
        }
        return files;
      }

      try {
        await chatStream(
          { messages: history },
          {
            onLifecycle: (data) => {
              if (data.phase === "start") {
                streamUsed = true;
              }
            },
            onToolStart: (data) => {
              streamUsed = true;
              addMessage({ role: "assistant", content: "", toolCalls: [{ name: data.functionName, loading: true }] });
            },
            onToolProgress: (_data) => {
            },
            onToolEnd: (data) => {
              streamUsed = true;
              const files = extractFileInfo(data.result ?? "");
              const update: Partial<AssistantMsg> = {
                toolCalls: [{ name: data.functionName, result: data.result?.slice(0, 300), loading: false }],
              };
              if (files.length > 0) update.files = files;
              updateLastAssistant(update);
            },
            onToolResult: (data) => {
              streamUsed = true;
              const files = extractFileInfo(data.result ?? "");
              const update: Partial<AssistantMsg> = {
                toolCalls: [{ name: data.functionName, result: data.result?.slice(0, 300), loading: false }],
              };
              if (files.length > 0) update.files = files;
              updateLastAssistant(update);
            },
            onThinkingStart: () => {
              streamUsed = true;
              thinkingRef.current = "";
              addMessage({ role: "assistant", content: "", thinking: "正在思考..." });
            },
            onThinkingDelta: (delta) => {
              streamUsed = true;
              thinkingRef.current += delta;
              throttledUpdate({ thinking: thinkingRef.current });
            },
            onThinkingEnd: (finalContent) => {
              streamUsed = true;
              thinkingRef.current = finalContent || thinkingRef.current;
              updateLastAssistant({ thinking: thinkingRef.current });
            },
            onContentDelta: (delta) => {
              streamUsed = true;
              contentRef.current += delta;
              throttledUpdate({ content: contentRef.current });
            },
            onDone: (data) => {
              const finalContent = contentRef.current || data.content || "";
              const finalThinking = thinkingRef.current || data.thinking || "";
              if (finalContent) {
                const update: Partial<AssistantMsg> = { content: finalContent };
                if (finalThinking) update.thinking = finalThinking;
                updateLastAssistant(update);
              } else if (finalThinking && !contentRef.current) {
                updateLastAssistant({ thinking: finalThinking });
              }
            },
            onError: (message) => {
              throw new Error(message);
            },
          },
        );
      } catch (streamErr) {
        if (streamUsed) throw streamErr;

        const result = await chat({ messages: history });
        const toolCalls = result.toolResults?.map(toToolCallInfo);

        if (toolCalls && toolCalls.length > 0) {
          updateLastAssistant({ toolCalls });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const assistantContent = result.response.content || "";
        const assistantMessage: AssistantMsg = {
          role: "assistant",
          content: assistantContent,
        };
        if (toolCalls && toolCalls.length > 0) assistantMessage.toolCalls = toolCalls;
        updateLastAssistant(assistantMessage);
      }
    } catch (error) {
      let message = "请求失败，请稍后重试";
      if (error instanceof ApiClientError) {
        message = error.code === "NOT_IMPLEMENTED"
          ? "AI 模型尚未配置，请先到设置页配置 API Key 和模型接口。"
          : error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      const lastMsg = session.messages[session.messages.length - 1];
      if (lastMsg?.role === "assistant" && !lastMsg.content) {
        const msgs = [...session.messages];
        msgs.pop();
        msgs.push({ role: "system", content: message });
        setSession({ ...session, messages: msgs });
      } else {
        addMessage({ role: "system", content: message });
      }
    } finally {
      setSending(false);
      setStreaming(false);
    }
  }, [ensureProject, ensureAgentSession, input, messages, sending, session, addMessage, updateLastAssistant, setSession, setStreaming]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleConfirmGate = async (gateId: string) => {
    try {
      await confirmHumanGate(gateId, { confirmedBy: "user" });
      const updated = session.messages.map((message) => (
        message.role === "gate" && message.gateId === gateId ? { ...message, resolved: true } : message
      ));
      setSession({ ...session, messages: [...updated, { role: "system" as const, content: "已确认，AI 会继续推进下一步。" }] });
    } catch {
      addMessage({ role: "system", content: "确认失败，请稍后重试。" });
    }
  };

  const isEmpty = messages.length === 0;
  const hasActiveAgents = agentCards.some((c) => c.status === "working");

  return (
    <div className="workspace-outer">
      <div className="workspace-conversation">
        <header className="conv-header">
          <div className="conv-header-title">
            <IconZhiXu size={18} />
            <span>{hasActiveAgents ? `${agentCards.filter(c => c.status === "working").length} 个 Agent 正在协作` : projectId ? "任务对话进行中" : "AI 对话首页"}</span>
          </div>
          <div className="conv-header-actions">
            {messages.length > 0 && (
              <button
                className="btn-secondary"
                onClick={handleConvertToDoc}
                disabled={converting}
                style={{ marginLeft: 8, fontSize: 13 }}
              >
                {converting ? "转换中..." : "转为文档"}
              </button>
            )}
            <span className="mode-pill"><IconPrivacy size={13} /> 本地优先</span>
            {projectId && (
              <button
                type="button"
                className="conv-header-btn"
                onClick={() => {
                  clearSession();
                  setInput("");
                }}
              >
                <IconBook size={14} />
                新对话
              </button>
            )}
          </div>
        </header>

        <div className="conv-messages">
        {isEmpty ? (
          <div className="conv-empty-state">
            <div className="conv-empty-logo anim-fade-in-scale">
              <IconZhiXu size={32} />
            </div>
            <h1 className="conv-empty-title anim-fade-in-up delay-1">你好，知序为你准备就绪</h1>
            <p className="conv-empty-subtitle anim-fade-in-up delay-2">
              我是你的 AI 学习科研管家，可以帮你做 PPT、读论文、准备汇报，告诉我你要做什么
            </p>
            <div className="conv-suggestions">
              {SUGGESTIONS.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={suggestion.label}
                    type="button"
                    className={`conv-suggestion-btn anim-fade-in-up delay-${index + 1}`}
                    onClick={() => handleSend(suggestion.prompt)}
                  >
                    <span className="conv-suggestion-icon">
                      <Icon size={18} />
                    </span>
                    <span className="conv-suggestion-text">{suggestion.label}</span>
                    <span className="conv-suggestion-desc">{suggestion.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              if (msg.role === "user") {
                return (
                  <div key={index} className="conv-message conv-message-user">
                    <div className="conv-avatar conv-avatar-user">我</div>
                    <div className="conv-bubble conv-bubble-user">{msg.content}</div>
                  </div>
                );
              }

              if (msg.role === "assistant") {
                const isLastAssistant = index === messages.length - 1 && sending;
                return (
                  <div key={index} className="conv-message">
                    <div className="conv-avatar conv-avatar-ai">知</div>
                    <div className="conv-message-stack">
                      {msg.thinking && (
                        <details className="thinking-panel" open>
                          <summary className="thinking-summary">
                            <IconBrain size={14} />
                            思考过程
                          </summary>
                          <div className="thinking-content">
                            {msg.thinking}
                          </div>
                        </details>
                      )}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="conv-tool-calls">
                          {msg.toolCalls.map((toolCall, toolIndex) => (
                            <ToolCallCard key={`${toolCall.name}-${toolIndex}`} toolCall={toolCall} index={toolIndex} />
                          ))}
                        </div>
                      )}
                      {msg.files && msg.files.length > 0 && (
                        <div className="conv-file-cards">
                          {msg.files.map((file, fileIndex) => {
                            const href = workspaceFileDownloadUrl(file.path, projectId);
                            if (!href) {
                              return (
                                <div key={`file-${fileIndex}`} className="conv-file-card conv-file-card-muted">
                                  <span className="conv-file-icon">文件</span>
                                  <span className="conv-file-info">
                                    <span className="conv-file-name">{file.name}</span>
                                    <span className="conv-file-action">需绑定到当前项目后下载</span>
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <a
                                key={`file-${fileIndex}`}
                                href={href}
                                className="conv-file-card"
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                              >
                                <span className="conv-file-icon">文件</span>
                                <span className="conv-file-info">
                                  <span className="conv-file-name">{file.name}</span>
                                  <span className="conv-file-action">点击下载</span>
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {msg.decisionCards && (
                        <DecisionCardSet data={msg.decisionCards} onSelect={handleDecisionSelect} />
                      )}
                      {msg.taskBrief && (
                        <TaskBriefCard brief={msg.taskBrief} />
                      )}
                      {msg.agentProcess && (
                        <div className="conv-agent-status">
                          <span className={`agent-status-dot agent-status-${msg.agentProcess.status}`} />
                          <span className="agent-status-name">{msg.agentProcess.agentName}</span>
                          <span className="agent-status-task">{msg.agentProcess.currentTask}</span>
                        </div>
                      )}
                      {msg.agentThinking && (
                        <div className="conv-agent-thinking">
                          <span className={`agent-thinking-type agent-thinking-${msg.agentThinking.type}`}>{msg.agentThinking.type}</span>
                          <span className="agent-thinking-content">{msg.agentThinking.content}</span>
                        </div>
                      )}
                      {msg.content && (
                        <div className="conv-bubble conv-bubble-ai">
                          <div className="md-content">
                            <MarkdownContent content={msg.content} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (msg.role === "gate") {
                return (
                  <div key={index} className="conv-message">
                    <div className="conv-avatar conv-avatar-gate">
                      <IconWarning size={14} />
                    </div>
                    <div className="conv-bubble conv-bubble-ai gate-card">
                      <strong>待确认：{msg.gateType}</strong>
                      <p>{msg.reason}</p>
                      {msg.resolved ? (
                        <span className="gate-resolved"><IconCheck size={12} /> 已确认</span>
                      ) : (
                        <div className="gate-actions">
                          <button type="button" className="btn-primary" onClick={() => handleConfirmGate(msg.gateId)}>确认</button>
                          <button type="button" className="btn-secondary">暂不处理</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="conv-system-msg">
                  <IconWarning size={14} />
                  {msg.content}
                </div>
              );
            })}

            {sending && (
              <div className="conv-message">
                <div className="conv-avatar conv-avatar-ai">知</div>
                <div className="conv-typing">
                  <span className="conv-typing-dot" />
                  <span className="conv-typing-dot" />
                  <span className="conv-typing-dot" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      <footer className="conv-input-area">
        <div className="conv-input-wrapper">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述任务、粘贴要求，或让知序继续推进当前项目..."
            rows={1}
            className="conv-textarea"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="conv-send-btn"
            aria-label="发送"
          >
            <IconSend size={18} />
          </button>
        </div>
        <div className="conv-input-hint">重要内容会进入可追溯流程，高风险操作会先请求确认。</div>
      </footer>
      </div>

      {(agentCards.length > 0 || collaboration) && (
        <div className={`workspace-agent-panel${agentPanelExpanded ? " workspace-agent-panel-expanded" : ""}`}>
          <AgentProcessPanel
            agentCards={agentCards}
            collaboration={collaboration}
            expanded={agentPanelExpanded}
            onToggle={() => setAgentPanelExpanded((v) => !v)}
          />
        </div>
      )}

      {projectId && !isEmpty && (
        <div className="workspace-canvas">
          <CanvasPanel projectId={projectId} agentSessionId={agentSessionId} />
        </div>
      )}
    </div>
  );
}
