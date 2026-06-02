import { describe, expect, it } from "vitest";
import { createRuntimeContext } from "./context.js";
import type { WorkflowState } from "../types.js";

describe("createRuntimeContext", () => {
  it("passes run, trace, node, input, checkpoint, and event helpers to handlers", async () => {
    const checkpoints: unknown[] = [];
    const events: unknown[] = [];
    const state: WorkflowState = {
      workflowId: "workflow-1",
      runId: "run-1",
      traceId: "trace-1",
      status: "running",
      values: { brief: { title: "Test" } },
      completedNodeIds: [],
      failedNodeIds: [],
      pendingNodeIds: ["node-1"]
    };

    const context = createRuntimeContext({
      workflowId: "workflow-1",
      nodeId: "node-1",
      nodeRef: "agent.node",
      input: { brief: state.values["brief"] },
      state,
      saveCheckpoint: async (nextState) => {
        checkpoints.push(nextState);
      },
      emitEvent: (event) => {
        events.push(event);
      }
    });

    await context.checkpoint({ ...state, currentNodeId: "node-1" });
    context.emit("node_started", { reason: "test" });

    expect(context.runId).toBe("run-1");
    expect(context.traceId).toBe("trace-1");
    expect(context.input).toEqual({ brief: { title: "Test" } });
    expect(checkpoints).toHaveLength(1);
    expect(events).toEqual([
      expect.objectContaining({
        type: "node_started",
        runId: "run-1",
        traceId: "trace-1",
        nodeId: "node-1",
        nodeRef: "agent.node",
        detail: { reason: "test" }
      })
    ]);
  });
});
