import type { HarnessEvent } from "../types.js";

export interface SSEEvent {
  event: string;
  data: unknown;
}

export function harnessEventToSSE(harnessEvent: HarnessEvent): SSEEvent | null {
  switch (harnessEvent.type) {
    case "node_started":
      return {
        event: "agent_status",
        data: {
          agentId: harnessEvent.nodeRef ?? "unknown",
          status: "working",
          currentTask: `Executing node ${harnessEvent.nodeId ?? "unknown"}`
        }
      };
    case "node_completed":
      return {
        event: "agent_status",
        data: {
          agentId: harnessEvent.nodeRef ?? "unknown",
          status: "completed",
          currentTask: `Completed node ${harnessEvent.nodeId ?? "unknown"}`
        }
      };
    case "node_failed":
      return {
        event: "agent_status",
        data: {
          agentId: harnessEvent.nodeRef ?? "unknown",
          status: "failed",
          currentTask: `Failed node ${harnessEvent.nodeId ?? "unknown"}`
        }
      };
    case "workflow_interrupted":
      return {
        event: "agent_decision",
        data: {
          type: "decision_cards",
          title: "Human gate",
          nodeId: harnessEvent.nodeId,
          nodeRef: harnessEvent.nodeRef
        }
      };
    case "workflow_completed":
      return {
        event: "workflow_complete",
        data: { status: "completed", runId: harnessEvent.runId }
      };
    case "workflow_failed":
      return {
        event: "workflow_error",
        data: { message: `Workflow failed: ${harnessEvent.detail?.["reason"] ?? "unknown"}`, runId: harnessEvent.runId }
      };
    case "superstep_completed":
      return {
        event: "agent_progress",
        data: {
          phase: "executing",
          message: `Superstep ${harnessEvent.superstep ?? 0} completed`,
          runId: harnessEvent.runId
        }
      };
    default:
      return null;
  }
}
