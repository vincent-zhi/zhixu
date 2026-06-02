"use client";

import { useState } from "react";
import type { AgentProcessCard, CollaborationSnapshot } from "../chat-context";
import { AgentProcessCardComponent } from "./agent-process-card";
import { CollaborationGraph } from "./collaboration-graph";

const STATUS_LABEL: Record<AgentProcessCard["status"], string> = {
  idle: "空闲",
  working: "执行中",
  waiting: "等待中",
  completed: "已完成",
  failed: "失败",
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function buildSummary(cards: AgentProcessCard[], collaboration: CollaborationSnapshot | null): string {
  const workingCount = cards.filter((c) => c.status === "working").length;
  const completedCount = cards.filter((c) => c.status === "completed").length;
  const totalCount = cards.length;

  if (workingCount > 0) {
    return `${workingCount} 个 Agent 正在运行`;
  }
  if (completedCount === totalCount) {
    return `全部完成 · 已用时 ${collaboration ? formatElapsed(collaboration.elapsedTime) : "0s"}`;
  }
  return `${completedCount}/${totalCount} 已完成`;
}

interface AgentProcessPanelProps {
  agentCards: AgentProcessCard[];
  collaboration: CollaborationSnapshot | null;
  expanded: boolean;
  onToggle: () => void;
}

export function AgentProcessPanel({ agentCards, collaboration, expanded, onToggle }: AgentProcessPanelProps) {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  if (agentCards.length === 0) return null;

  const hasWorking = agentCards.some((c) => c.status === "working");

  return (
    <div className="agent-process-panel">
      <div className="agent-panel-summary" onClick={onToggle}>
        <span>Agent 协作状态</span>
        <span className="agent-panel-summary__status">
          {hasWorking && <span className="agent-panel-summary__dot" />}
          {buildSummary(agentCards, collaboration)}
        </span>
        <span className="agent-panel-summary__toggle">
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div className="agent-panel-expanded-content">
          <div className="agent-process-panel__cards">
            {agentCards.map((card) => (
              <AgentProcessCardComponent
                key={card.agentId}
                card={card}
                onExpand={() =>
                  setExpandedCardId((prev) =>
                    prev === card.agentId ? null : card.agentId
                  )
                }
              />
            ))}
          </div>

          {collaboration && (
            <div className="agent-process-panel__collaboration">
              <CollaborationGraph snapshot={collaboration} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
