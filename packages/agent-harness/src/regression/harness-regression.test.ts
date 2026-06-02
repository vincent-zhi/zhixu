import { describe, expect, it } from "vitest";
import { WorkflowExecutor } from "../workflow/executor.js";
import { AgentRegistry } from "../registry/agent-registry.js";
import { InMemoryCheckpointStore } from "../checkpoint/checkpoint-store.js";
import { HarnessEventEmitter } from "../runtime/events.js";
import { harnessEventToSSE } from "../adapter/sse-bridge.js";
import type { HarnessEvent, WorkflowDefinition, WorkflowState } from "../types.js";
import {
  coursePresentationMinimal,
  humanGateResume,
  labMeetingThreePapers,
  parallelPartialFailure,
  retryThenSuccess
} from "../testing/workflow-fixtures.js";

function makeHumanGateWorkflow(): WorkflowDefinition {
  return {
    id: "human_gate_regression",
    name: "Human Gate Regression",
    version: 1,
    startNodeId: "brief",
    stateSchemaVersion: 1,
    nodes: [
      { id: "brief", type: "agent", ref: "brief.create", inputKeys: ["rawInput"], outputKey: "brief", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "select", type: "human_gate", ref: "decision.select", inputKeys: ["brief"], outputKey: "selectedOptionId", policy: { timeoutMs: 86400000, maxAttempts: 1, riskLevel: "L1" } },
      { id: "outline", type: "agent", ref: "outline.create", inputKeys: ["selectedOptionId", "brief"], outputKey: "outline", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L1" } }
    ],
    edges: [
      { from: "brief", to: "select" },
      { from: "select", to: "outline" }
    ]
  };
}

function makeParallelFailureWorkflow(): WorkflowDefinition {
  return {
    id: "parallel_failure_regression",
    name: "Parallel Failure Regression",
    version: 1,
    startNodeId: "start",
    stateSchemaVersion: 1,
    nodes: [
      { id: "start", type: "agent", ref: "start.run", inputKeys: [], outputKey: "start", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "ok_branch", type: "agent", ref: "ok.run", inputKeys: ["start"], outputKey: "ok", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "fail_branch", type: "agent", ref: "fail.run", inputKeys: ["start"], outputKey: "failed", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L1" } }
    ],
    edges: [
      { from: "start", to: "ok_branch" },
      { from: "start", to: "fail_branch" }
    ]
  };
}

describe("Harness regression fixtures", () => {
  it("covers the named regression fixture inventory", () => {
    expect([
      coursePresentationMinimal.id,
      labMeetingThreePapers.id,
      humanGateResume.id,
      parallelPartialFailure.id,
      retryThenSuccess.id
    ]).toEqual([
      "course_presentation_minimal",
      "lab_meeting_three_papers",
      "human_gate_resume",
      "parallel_partial_failure",
      "retry_then_success"
    ]);
  });

  it("asserts final status, completed ids, checkpoint count, and event order for course presentation", async () => {
    const registry = new AgentRegistry();
    registry.register("understanding.run", async (input) => ({ rawInput: input["rawInput"] }));
    registry.register("outline.run", async (input) => ({ outlineFor: input["understanding"] }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const events: HarnessEvent[] = [];
    emitter.on((event) => events.push(event));

    const executor = new WorkflowExecutor(registry, store, emitter);
    const result = await executor.run(coursePresentationMinimal, { rawInput: "make slides" });

    expect(result.state.status).toBe("completed");
    expect(result.state.completedNodeIds).toEqual(["understanding", "outline"]);
    expect(await store.list(result.state.runId)).toHaveLength(3);
    expect(events.map((event) => event.type).at(-1)).toBe("workflow_completed");
  });

  it("executes lab meeting paper reads as one parallel superstep before matrix generation", async () => {
    const registry = new AgentRegistry();
    registry.register("brief.run", async () => ({ title: "brief" }));
    registry.register("paper.a", async () => ({ id: "a" }));
    registry.register("paper.b", async () => ({ id: "b" }));
    registry.register("paper.c", async () => ({ id: "c" }));
    registry.register("matrix.run", async (input) => ({ input }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const events: HarnessEvent[] = [];
    emitter.on((event) => events.push(event));

    const executor = new WorkflowExecutor(registry, store, emitter);
    const result = await executor.run(labMeetingThreePapers, {});

    expect(result.state.status).toBe("completed");
    expect(result.state.completedNodeIds).toEqual(["brief", "paper_a", "paper_b", "paper_c", "matrix"]);
    expect(await store.list(result.state.runId)).toHaveLength(4);
    const paperStartedSupersteps = events
      .filter((event) => event.type === "node_started" && event.nodeId?.startsWith("paper_"))
      .map((event) => event.superstep);
    expect(new Set(paperStartedSupersteps)).toEqual(new Set([1]));
    expect(events.find((event) => event.nodeId === "matrix")?.superstep).toBe(2);
  });

  it("records retry_then_success without duplicate successful node execution", async () => {
    let calls = 0;
    const registry = new AgentRegistry();
    registry.register("flaky.run", async () => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return { ok: true };
    });

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);
    const result = await executor.run(retryThenSuccess, {});

    expect(result.state.status).toBe("completed");
    expect(result.state.completedNodeIds).toEqual(["flaky"]);
    expect(await store.list(result.state.runId)).toHaveLength(2);
    expect(calls).toBe(2);
  });

  it("persists an interrupt and resumes without rerunning completed nodes", async () => {
    let briefCalls = 0;
    const registry = new AgentRegistry();
    registry.register("brief.create", async (input) => {
      briefCalls++;
      return { title: input["rawInput"] };
    });
    registry.register("outline.create", async (input) => ({ outlineFor: input["selectedOptionId"] }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const first = await executor.run(makeHumanGateWorkflow(), { rawInput: "test" });

    expect(first.state.status).toBe("waiting_human");
    expect(first.interrupt?.nodeId).toBe("select");

    const resumedState: WorkflowState = {
      ...first.state,
      values: { ...first.state.values, selectedOptionId: "option-a" },
      completedNodeIds: [...first.state.completedNodeIds, "select"],
      status: "running"
    };

    const result = await executor.run(makeHumanGateWorkflow(), {}, { resumeFrom: resumedState });

    expect(result.state.status).toBe("completed");
    expect(result.state.values["outline"]).toEqual({ outlineFor: "option-a" });
    expect(briefCalls).toBe(1);
  });

  it("covers human_gate_resume fixture resume behavior", async () => {
    let draftCalls = 0;
    const registry = new AgentRegistry();
    registry.register("draft.run", async () => {
      draftCalls++;
      return { title: "draft" };
    });
    registry.register("final.run", async (input) => ({ approval: input["approval"] }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);
    const first = await executor.run(humanGateResume, {});

    expect(first.state.status).toBe("waiting_human");
    expect(first.interrupt?.nodeId).toBe("approve");

    const resumedState: WorkflowState = {
      ...first.state,
      values: { ...first.state.values, approval: "approved" },
      completedNodeIds: [...first.state.completedNodeIds, "approve"],
      status: "running"
    };

    const result = await executor.run(humanGateResume, {}, { resumeFrom: resumedState });

    expect(result.state.status).toBe("completed");
    expect(result.state.completedNodeIds).toEqual(["draft", "approve", "final"]);
    expect(draftCalls).toBe(1);
  });

  it("records partial parallel success without retrying failed nodes forever", async () => {
    let failedCalls = 0;
    const registry = new AgentRegistry();
    registry.register("start.run", async () => "started");
    registry.register("ok.run", async () => "ok");
    registry.register("fail.run", async () => {
      failedCalls++;
      throw new Error("boom");
    });

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeParallelFailureWorkflow(), {});

    expect(result.state.status).toBe("failed");
    expect(result.state.completedNodeIds).toContain("ok_branch");
    expect(result.state.failedNodeIds).toContain("fail_branch");
    expect(result.state.values["ok"]).toBe("ok");
    expect(failedCalls).toBe(1);
  });

  it("covers parallel_partial_failure fixture checkpoint state", async () => {
    const registry = new AgentRegistry();
    registry.register("start.run", async () => "started");
    registry.register("ok.run", async () => "ok");
    registry.register("fail.run", async () => {
      throw new Error("boom");
    });

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);
    const result = await executor.run(parallelPartialFailure, {});

    expect(result.state.status).toBe("failed");
    expect(result.state.completedNodeIds).toEqual(["start", "ok_branch"]);
    expect(result.state.failedNodeIds).toEqual(["fail_branch"]);
    expect(await store.list(result.state.runId)).toHaveLength(2);
  });

  it("maps emitted harness events to SSE-compatible event names", async () => {
    const registry = new AgentRegistry();
    registry.register("brief.create", async () => ({ title: "test" }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const events: HarnessEvent[] = [];
    emitter.on((event) => events.push(event));
    const executor = new WorkflowExecutor(registry, store, emitter);

    await executor.run({
      id: "single",
      name: "Single",
      version: 1,
      startNodeId: "brief",
      stateSchemaVersion: 1,
      nodes: [
        { id: "brief", type: "agent", ref: "brief.create", inputKeys: [], outputKey: "brief", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } }
      ],
      edges: []
    }, {});

    const sseEvents = events
      .map((event) => harnessEventToSSE(event))
      .filter((event): event is NonNullable<typeof event> => event !== null);

    expect(sseEvents.map((event) => event.event)).toContain("agent_status");
    expect(sseEvents.map((event) => event.event)).toContain("workflow_complete");
  });
});
