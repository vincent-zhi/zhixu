"use client";

import type { CollaborationSnapshot } from "../chat-context";

const STATUS_DOT_CLASS: Record<string, string> = {
  idle: "collab-graph__dot--idle",
  working: "collab-graph__dot--working",
  waiting: "collab-graph__dot--waiting",
  completed: "collab-graph__dot--completed",
  failed: "collab-graph__dot--failed",
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatRemaining(ms: number | null): string {
  if (ms === null) return "计算中…";
  return formatElapsed(ms);
}

interface CollaborationGraphProps {
  snapshot: CollaborationSnapshot;
}

export function CollaborationGraph({ snapshot }: CollaborationGraphProps) {
  return (
    <div className="collab-graph">
      <div className="collab-graph__nodes">
        {snapshot.agents.map((agent, i) => (
          <div key={agent.agentId} className="collab-graph__node-wrapper">
            <div className="collab-graph__node">
              <span className={`collab-graph__dot ${STATUS_DOT_CLASS[agent.status]}`} />
              <span className="collab-graph__node-name">{agent.agentName}</span>
            </div>
            {i < snapshot.agents.length - 1 && (
              <div className="collab-graph__arrow-spacer">
                {snapshot.edges
                  .filter((e) => e.from === agent.agentId)
                  .map((edge, j) => (
                    <div key={j} className="collab-graph__edge">
                      <span className="collab-graph__edge-label">{edge.dataType}</span>
                      <span className="collab-graph__edge-arrow">→</span>
                    </div>
                  ))}
                {snapshot.edges.filter((e) => e.from === agent.agentId).length === 0 && (
                  <span className="collab-graph__edge-arrow">→</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="collab-graph__meta">
        {snapshot.bottleneck && (
          <div className="collab-graph__bottleneck">
            🚧 瓶颈: {snapshot.bottleneck}
          </div>
        )}
        <div className="collab-graph__timing">
          <span className="collab-graph__elapsed">⏱ 已用时 {formatElapsed(snapshot.elapsedTime)}</span>
          <span className="collab-graph__remaining">⏳ 预计剩余 {formatRemaining(snapshot.estimatedRemaining)}</span>
        </div>
      </div>
    </div>
  );
}
