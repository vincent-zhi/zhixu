import { describe, expect, it } from "vitest";
import { harnessEventToSSE } from "./sse-bridge.js";

describe("harnessEventToSSE", () => {
  it("maps node_started to agent_status working", () => {
    const result = harnessEventToSSE({
      type: "node_started",
      runId: "r1",
      traceId: "t1",
      nodeId: "understanding",
      nodeRef: "understanding.analyze",
      superstep: 0,
      timestamp: "2026-06-01T00:00:00.000Z"
    });
    expect(result).toEqual({
      event: "agent_status",
      data: { agentId: "understanding.analyze", status: "working", currentTask: "Executing node understanding" }
    });
  });

  it("maps node_completed to agent_status completed", () => {
    const result = harnessEventToSSE({
      type: "node_completed",
      runId: "r1",
      traceId: "t1",
      nodeId: "understanding",
      nodeRef: "understanding.analyze",
      superstep: 0,
      timestamp: "2026-06-01T00:00:00.000Z"
    });
    expect(result?.event).toBe("agent_status");
  });

  it("maps workflow_interrupted to agent_decision", () => {
    const result = harnessEventToSSE({
      type: "workflow_interrupted",
      runId: "r1",
      traceId: "t1",
      nodeId: "select_plan",
      nodeRef: "presentation.selectPlan",
      superstep: 2,
      timestamp: "2026-06-01T00:00:00.000Z"
    });
    expect(result?.event).toBe("agent_decision");
  });

  it("maps workflow_completed to workflow_complete", () => {
    const result = harnessEventToSSE({
      type: "workflow_completed",
      runId: "r1",
      traceId: "t1",
      superstep: 5,
      timestamp: "2026-06-01T00:00:00.000Z"
    });
    expect(result?.event).toBe("workflow_complete");
  });

  it("maps workflow_failed to workflow_error", () => {
    const result = harnessEventToSSE({
      type: "workflow_failed",
      runId: "r1",
      traceId: "t1",
      superstep: 3,
      timestamp: "2026-06-01T00:00:00.000Z",
      detail: { reason: "max_supersteps_exceeded" }
    });
    expect(result?.event).toBe("workflow_error");
    expect((result?.data as Record<string, unknown>)["message"]).toContain("max_supersteps_exceeded");
  });

  it("maps superstep_completed to agent_progress", () => {
    const result = harnessEventToSSE({
      type: "superstep_completed",
      runId: "r1",
      traceId: "t1",
      superstep: 1,
      timestamp: "2026-06-01T00:00:00.000Z"
    });
    expect(result?.event).toBe("agent_progress");
  });
});
