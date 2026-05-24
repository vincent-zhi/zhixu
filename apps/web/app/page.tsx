"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ApiClientError,
  chat,
  confirmHumanGate,
  createProject,
  postProjectEvent,
  type ChatResult,
} from "./api-client";
import {
  IconBook,
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

type ToolCallInfo = { name: string; result?: string; loading?: boolean };

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCallInfo[] }
  | { role: "gate"; gateId: string; gateType: string; reason: string; riskLevel: string; resolved: boolean }
  | { role: "system"; content: string };

const SUGGESTIONS = [
  { icon: IconPPT, label: "做 PPT", desc: "解析资料，生成选题、大纲和逐页共创", prompt: "帮我做一份课程 PPT，需要先给我 3 个选题方向" },
  { icon: IconDocument, label: "写报告", desc: "把要求、资料和证据整理成可编辑文档", prompt: "帮我整理一份课程报告，先拆解结构和资料缺口" },
  { icon: IconPaper, label: "读论文", desc: "提炼贡献、局限、引用和组会角度", prompt: "帮我精读这篇论文，整理贡献、方法、局限和可汇报角度" },
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

export default function HomePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ensureProject = useCallback(async (firstMessage: string): Promise<string> => {
    if (projectId) return projectId;
    const project = await createProject({
      workspaceId: "default",
      ownerId: "user",
      title: firstMessage.slice(0, 80),
      type: "other",
      priority: 3,
      privacyMode: "cloud",
      riskLevel: "L1",
    });
    setProjectId(project.id);
    await postProjectEvent(project.id, { eventType: "user_goal_submitted", actorId: "user" }).catch(() => {});
    return project.id;
  }, [projectId]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content }]);

    try {
      await ensureProject(content);
      const history = messages
        .filter((message): message is Extract<Msg, { role: "user" | "assistant" }> => message.role === "user" || message.role === "assistant")
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

      setMessages((prev) => [...prev, { role: "assistant", content: "", toolCalls: [{ name: "thinking", loading: true }] }]);

      const result = await chat({ messages: history });
      const toolCalls = result.toolResults?.map(toToolCallInfo);

      if (toolCalls && toolCalls.length > 0) {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { role: "assistant", content: "", toolCalls };
          }
          return updated;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const assistantContent = result.response.content || "";
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          const assistantMessage: Extract<Msg, { role: "assistant" }> = {
            role: "assistant",
            content: assistantContent || "已收到，我会继续整理任务、证据和下一步确认项。",
          };
          if (toolCalls && toolCalls.length > 0) assistantMessage.toolCalls = toolCalls;
          updated[updated.length - 1] = assistantMessage;
        }
        return updated;
      });
    } catch (error) {
      let message = "请求失败，请稍后重试";
      if (error instanceof ApiClientError) {
        message = error.code === "NOT_IMPLEMENTED"
          ? "AI 模型尚未配置，请先到设置页配置 API Key 和模型接口。"
          : error.message;
      }
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) updated.pop();
        updated.push({ role: "system", content: message });
        return updated;
      });
    } finally {
      setSending(false);
    }
  }, [ensureProject, input, messages, sending]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleConfirmGate = async (gateId: string) => {
    try {
      await confirmHumanGate(gateId, { confirmedBy: "user" });
      setMessages((prev) => prev.map((message) => (
        message.role === "gate" && message.gateId === gateId ? { ...message, resolved: true } : message
      )));
      setMessages((prev) => [...prev, { role: "system", content: "已确认，AI 会继续推进下一步。" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "确认失败，请稍后重试。" }]);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="conv-page">
      <header className="conv-header">
        <div className="conv-header-title">
          <IconZhiXu size={18} />
          <span>{projectId ? "任务对话进行中" : "AI 对话首页"}</span>
        </div>
        <div className="conv-header-actions">
          <span className="mode-pill"><IconPrivacy size={13} /> 本地优先</span>
          {projectId && (
            <button
              type="button"
              className="conv-header-btn"
              onClick={() => {
                setMessages([]);
                setProjectId(null);
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
              我是你的 AI 学习科研管家，可以帮你做 PPT、写报告、读论文、准备考试，告诉我你要做什么
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
                return (
                  <div key={index} className="conv-message">
                    <div className="conv-avatar conv-avatar-ai">知</div>
                    <div className="conv-message-stack">
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="conv-tool-calls">
                          {msg.toolCalls.map((toolCall, toolIndex) => (
                            <ToolCallCard key={`${toolCall.name}-${toolIndex}`} toolCall={toolCall} index={toolIndex} />
                          ))}
                        </div>
                      )}
                      {msg.content && (
                        <div className="conv-bubble conv-bubble-ai">
                          <MarkdownContent content={msg.content} />
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
  );
}
