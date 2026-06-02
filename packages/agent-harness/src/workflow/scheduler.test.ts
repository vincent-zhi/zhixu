import { describe, expect, it } from "vitest";
import { getReadyNodeIds } from "./scheduler.js";
import type { WorkflowDefinition } from "../types.js";

const workflow: WorkflowDefinition = {
  id: "lab_meeting",
  name: "Lab Meeting",
  version: 1,
  startNodeId: "brief",
  stateSchemaVersion: 1,
  nodes: [
    { id: "brief", type: "agent", ref: "brief.create", inputKeys: [], outputKey: "brief", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "paper_a", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperA", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "paper_b", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperB", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "matrix", type: "agent", ref: "paper.matrix", inputKeys: ["paperA", "paperB"], outputKey: "matrix", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L1" } }
  ],
  edges: [
    { from: "brief", to: "paper_a" },
    { from: "brief", to: "paper_b" },
    { from: "paper_a", to: "matrix" },
    { from: "paper_b", to: "matrix" }
  ]
};

describe("getReadyNodeIds", () => {
  it("starts with the workflow start node", () => {
    expect(getReadyNodeIds(workflow, [])).toEqual(["brief"]);
  });

  it("returns parallel nodes after their shared dependency completes", () => {
    expect(getReadyNodeIds(workflow, ["brief"]).sort()).toEqual(["paper_a", "paper_b"]);
  });

  it("waits until all dependencies complete", () => {
    expect(getReadyNodeIds(workflow, ["brief", "paper_a"])).toEqual(["paper_b"]);
    expect(getReadyNodeIds(workflow, ["brief", "paper_a", "paper_b"])).toEqual(["matrix"]);
  });

  it("returns empty when all nodes are completed", () => {
    expect(getReadyNodeIds(workflow, ["brief", "paper_a", "paper_b", "matrix"])).toEqual([]);
  });

  it("does not reschedule failed nodes", () => {
    expect(getReadyNodeIds(workflow, ["brief", "paper_a"], ["paper_b"])).toEqual([]);
  });

  it("blocks dependents when one of their dependencies failed", () => {
    expect(getReadyNodeIds(workflow, ["brief", "paper_a"], ["paper_b"])).not.toContain("matrix");
  });

  it("handles single-node workflow", () => {
    const single: WorkflowDefinition = {
      id: "single",
      name: "Single",
      version: 1,
      startNodeId: "only",
      stateSchemaVersion: 1,
      nodes: [{ id: "only", type: "agent", ref: "only.run", inputKeys: [], outputKey: "result", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } }],
      edges: []
    };
    expect(getReadyNodeIds(single, [])).toEqual(["only"]);
    expect(getReadyNodeIds(single, ["only"])).toEqual([]);
  });
});
