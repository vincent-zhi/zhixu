"use client";

import { useState } from "react";
import type { AgentProcessCard as AgentProcessCardType, ProgressDetail, ThinkingEntry } from "../chat-context";

const STATUS_BADGE_CLASS: Record<AgentProcessCardType["status"], string> = {
  idle: "agent-card__status-badge--idle",
  working: "agent-card__status-badge--working",
  waiting: "agent-card__status-badge--waiting",
  completed: "agent-card__status-badge--completed",
  failed: "agent-card__status-badge--failed",
};

const STATUS_LABEL: Record<AgentProcessCardType["status"], string> = {
  idle: "空闲",
  working: "执行中",
  waiting: "等待中",
  completed: "已完成",
  failed: "失败",
};

const PROGRESS_STATUS_ICON: Record<ProgressDetail["status"], string> = {
  completed: "✅",
  in_progress: "🔄",
  queued: "⏳",
  failed: "❌",
  skipped: "⏭️",
};

const THINKING_TYPE_ICON: Record<ThinkingEntry["type"], string> = {
  decision: "🤔",
  observation: "👁",
  plan: "📋",
  error: "⚠️",
};

function ProgressItem({ item }: { item: ProgressDetail }) {
  return (
    <div className="agent-card__progress-item">
      <span className="agent-card__progress-icon">{PROGRESS_STATUS_ICON[item.status]}</span>
      <span className="agent-card__progress-label">{item.label}</span>
      {item.detail && <span className="agent-card__progress-detail">{item.detail}</span>}
      {item.percentage > 0 && (
        <div className="agent-card__progress-bar">
          <div
            className="agent-card__progress-fill"
            style={{ width: `${item.percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ThinkingLog({ entries }: { entries: ThinkingEntry[] }) {
  return (
    <div className="agent-card__thinking">
      {entries.map((entry, i) => (
        <div key={i} className="agent-card__thinking-entry">
          <span className="agent-card__thinking-icon">{THINKING_TYPE_ICON[entry.type]}</span>
          <span className="agent-card__thinking-time">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
          <span className="agent-card__thinking-content">{entry.content}</span>
          {entry.relatedEvidence && entry.relatedEvidence.length > 0 && (
            <div className="agent-card__thinking-evidence">
              {entry.relatedEvidence.map((e, j) => (
                <span key={j} className="agent-card__thinking-evidence-tag">{e}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface AgentProcessCardComponentProps {
  card: AgentProcessCardType;
  onExpand?: () => void;
}

export function AgentProcessCardComponent({ card, onExpand }: AgentProcessCardComponentProps) {
  const [showThinking, setShowThinking] = useState(false);

  return (
    <div className="agent-card" data-status={card.status}>
      <div className="agent-card__header">
        <span className="agent-card__icon">{card.agentIcon}</span>
        <span className="agent-card__name">{card.agentName}</span>
        <span className={`agent-card__status-badge ${STATUS_BADGE_CLASS[card.status]}`}>
          {STATUS_LABEL[card.status]}
        </span>
      </div>

      {card.currentTask && (
        <div className="agent-card__task">{card.currentTask}</div>
      )}

      {card.progress.length > 0 && (
        <div className="agent-card__progress">
          {card.progress.map((item, i) => (
            <ProgressItem key={i} item={item} />
          ))}
        </div>
      )}

      {card.thinkingLog.length > 0 && (
        <div className="agent-card__thinking-toggle">
          <button
            className="agent-card__thinking-btn"
            onClick={() => {
              setShowThinking((prev) => !prev);
              onExpand?.();
            }}
          >
            {showThinking ? "隐藏思考过程" : `查看思考过程 (${card.thinkingLog.length})`}
          </button>
        </div>
      )}

      {showThinking && <ThinkingLog entries={card.thinkingLog} />}
    </div>
  );
}
