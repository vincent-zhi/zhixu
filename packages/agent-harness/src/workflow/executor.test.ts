import { describe, expect, it } from "vitest";
import { WorkflowExecutor } from "./executor.js";
import { AgentRegistry } from "../registry/agent-registry.js";
import { InMemoryCheckpointStore } from "../checkpoint/checkpoint-store.js";
import { HarnessEventEmitter } from "../runtime/events.js";
import type { WorkflowDefinition, HarnessEvent } from "../types.js";

function makeSimpleWorkflow(): WorkflowDefinition {
  return {
    id: "simple",
    name: "Simple",
    version: 1,
    startNodeId: "step_a",
    stateSchemaVersion: 1,
    nodes: [
      { id: "step_a", type: "agent", ref: "a.run", inputKeys: [], outputKey: "a", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "step_b", type: "agent", ref: "b.run", inputKeys: ["a"], outputKey: "b", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } }
    ],
    edges: [{ from: "step_a", to: "step_b" }]
  };
}

function makeParallelWorkflow(): WorkflowDefinition {
  return {
    id: "parallel",
    name: "Parallel",
    version: 1,
    startNodeId: "brief",
    stateSchemaVersion: 1,
    nodes: [
      { id: "brief", type: "agent", ref: "brief.create", inputKeys: [], outputKey: "brief", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "paper_a", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperA", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "paper_b", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperB", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "matrix", type: "agent", ref: "paper.matrix", inputKeys: ["paperA", "paperB"], outputKey: "matrix", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L1" } }
    ],
    edges: [
      { from: "brief", to: "paper_a" },
      { from: "brief", to: "paper_b" },
      { from: "paper_a", to: "matrix" },
      { from: "paper_b", to: "matrix" }
    ]
  };
}

function makeHumanGateWorkflow(): WorkflowDefinition {
  return {
    id: "human_gate_flow",
    name: "Human Gate Flow",
    version: 1,
    startNodeId: "understanding",
    stateSchemaVersion: 1,
    nodes: [
      { id: "understanding", type: "agent", ref: "understanding.analyze", inputKeys: [], outputKey: "understanding", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
      { id: "select_topic", type: "human_gate", ref: "presentation.selectTopic", inputKeys: ["understanding"], outputKey: "selectedTopicId", policy: { timeoutMs: 86400000, maxAttempts: 1, riskLevel: "L1" } },
      { id: "outline", type: "agent", ref: "presentation.generateOutline", inputKeys: ["selectedTopicId"], outputKey: "outline", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L1" } }
    ],
    edges: [
      { from: "understanding", to: "select_topic" },
      { from: "select_topic", to: "outline" }
    ]
  };
}

function makeRetryWorkflow(): WorkflowDefinition {
  return {
    id: "retry_flow",
    name: "Retry Flow",
    version: 1,
    startNodeId: "flaky",
    stateSchemaVersion: 1,
    nodes: [
      { id: "flaky", type: "agent", ref: "flaky.run", inputKeys: [], outputKey: "result", policy: { timeoutMs: 5000, maxAttempts: 3, riskLevel: "L1" } }
    ],
    edges: []
  };
}

describe("WorkflowExecutor", () => {
  it("executes a two-node sequential workflow", async () => {
    const registry = new AgentRegistry();
    registry.register("a.run", async () => ({ value: "A" }));
    registry.register("b.run", async (input) => ({ value: "B", fromA: input }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeSimpleWorkflow(), {});

    expect(result.state.status).toBe("completed");
    expect(result.state.values["a"]).toEqual({ value: "A" });
    expect(result.state.values["b"]).toEqual({ value: "B", fromA: { a: { value: "A" } } });
    expect(result.state.completedNodeIds).toEqual(["step_a", "step_b"]);
  });

  it("executes parallel nodes in the same superstep", async () => {
    const registry = new AgentRegistry();
    registry.register("brief.create", async () => ({ title: "Test" }));
    registry.register("paper.read", async (input) => ({ paper: (input as Record<string, unknown>)["brief"] }));
    registry.register("paper.matrix", async (input) => ({
      papers: [(input as Record<string, unknown>)["paperA"], (input as Record<string, unknown>)["paperB"]]
    }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeParallelWorkflow(), {});

    expect(result.state.status).toBe("completed");
    expect(result.state.completedNodeIds).toContain("brief");
    expect(result.state.completedNodeIds).toContain("paper_a");
    expect(result.state.completedNodeIds).toContain("paper_b");
    expect(result.state.completedNodeIds).toContain("matrix");
  });

  it("saves checkpoints after each superstep", async () => {
    const registry = new AgentRegistry();
    registry.register("a.run", async () => ({ value: "A" }));
    registry.register("b.run", async () => ({ value: "B" }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeSimpleWorkflow(), {});

    const checkpoints = await store.list(result.state.runId);
    expect(checkpoints.length).toBeGreaterThanOrEqual(2);
  });

  it("passes runtime context into node handlers", async () => {
    const registry = new AgentRegistry();
    registry.register("a.run", (async (_input, context) => ({
      runId: context.runId,
      traceId: context.traceId,
      nodeId: context.nodeId,
      workflowId: context.workflowId
    })) as never);

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeSimpleWorkflow(), {}, {
      runId: "run-ctx",
      traceId: "trace-ctx"
    });

    expect(result.state.values["a"]).toEqual({
      runId: "run-ctx",
      traceId: "trace-ctx",
      nodeId: "step_a",
      workflowId: "simple"
    });
  });

  it("interrupts on human_gate node and returns waiting_human", async () => {
    const registry = new AgentRegistry();
    registry.register("understanding.analyze", async () => ({ goals: ["test"] }));
    registry.register("presentation.generateOutline", async (input) => ({ outline: input }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeHumanGateWorkflow(), {});

    expect(result.state.status).toBe("waiting_human");
    expect(result.interrupt).toBeDefined();
    expect(result.interrupt?.type).toBe("human_gate");
    expect(result.interrupt?.nodeId).toBe("select_topic");
    expect(result.state.completedNodeIds).toEqual(["understanding"]);
  });

  it("resumes from human_gate with provided input", async () => {
    const registry = new AgentRegistry();
    registry.register("understanding.analyze", async () => ({ goals: ["test"] }));
    registry.register("presentation.generateOutline", async (input) => ({ outline: input }));

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const first = await executor.run(makeHumanGateWorkflow(), {});
    expect(first.state.status).toBe("waiting_human");

    const resumedState: typeof first.state = {
      ...first.state,
      values: { ...first.state.values, selectedTopicId: "topic-1" },
      completedNodeIds: [...first.state.completedNodeIds, "select_topic"],
      status: "running"
    };

    const result = await executor.run(makeHumanGateWorkflow(), {}, { resumeFrom: resumedState });

    expect(result.state.status).toBe("completed");
    expect(result.state.values["selectedTopicId"]).toBe("topic-1");
    expect(result.state.completedNodeIds).toContain("outline");
  });

  it("retries a flaky handler and succeeds on second attempt", async () => {
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

    const result = await executor.run(makeRetryWorkflow(), {});

    expect(result.state.status).toBe("completed");
    expect(result.state.values["result"]).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("marks workflow as failed when all attempts exhausted", async () => {
    const registry = new AgentRegistry();
    registry.register("flaky.run", async () => {
      throw new Error("always fails");
    });

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const executor = new WorkflowExecutor(registry, store, emitter);

    const result = await executor.run(makeRetryWorkflow(), {});

    expect(result.state.status).toBe("failed");
    expect(result.state.failedNodeIds).toContain("flaky");
  });

  it("emits events in correct order", async () => {
    const registry = new AgentRegistry();
    registry.register("a.run", async () => "A");
    registry.register("b.run", async () => "B");

    const store = new InMemoryCheckpointStore();
    const emitter = new HarnessEventEmitter();
    const events: HarnessEvent[] = [];
    emitter.on((e) => events.push(e));

    const executor = new WorkflowExecutor(registry, store, emitter);
    await executor.run(makeSimpleWorkflow(), {});

    const types = events.map((e) => e.type);
    expect(types).toContain("node_started");
    expect(types).toContain("node_completed");
    expect(types).toContain("superstep_completed");
    expect(types).toContain("workflow_completed");
    expect(types.indexOf("workflow_completed")).toBeGreaterThan(types.indexOf("node_completed"));
  });

  it("continues with partial success when some parallel nodes fail", async () => {
    const workflow: WorkflowDefinition = {
      id: "partial_fail",
      name: "Partial Fail",
      version: 1,
      startNodeId: "start",
      stateSchemaVersion: 1,
      nodes: [
        { id: "start", type: "agent", ref: "start.run", inputKeys: [], outputKey: "start", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
        { id: "ok_branch", type: "agent", ref: "ok.run", inputKeys: ["start"], outputKey: "okResult", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } },
        { id: "fail_branch", type: "agent", ref: "fail.run", inputKeys: ["start"], outputKey: "failResult", policy: { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" } }
      ],
      edges: [
        { from: "start", to: "ok_branch" },
        { from: "start", to: "fail_branch" }
      ]
    };

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

    const result = await executor.run(workflow, {});

    expect(result.state.status).toBe("failed");
    expect(result.state.completedNodeIds).toContain("ok_branch");
    expect(result.state.failedNodeIds).toContain("fail_branch");
    expect(result.state.values["okResult"]).toBe("ok");
    expect(failedCalls).toBe(1);
  });
});
