import { describe, expect, it } from "vitest";
import { defineWorkflow, validateWorkflowDefinition } from "./definition.js";
import type { WorkflowDefinition } from "../types.js";

function validWorkflow(): WorkflowDefinition {
  return {
    id: "valid",
    name: "Valid",
    version: 1,
    startNodeId: "start",
    stateSchemaVersion: 1,
    nodes: [
      {
        id: "start",
        type: "agent",
        ref: "agent.start",
        inputKeys: [],
        outputKey: "start",
        policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" }
      },
      {
        id: "finish",
        type: "verifier",
        ref: "agent.finish",
        inputKeys: ["start"],
        outputKey: "finish",
        policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L1" }
      }
    ],
    edges: [{ from: "start", to: "finish" }]
  };
}

describe("workflow definition helpers", () => {
  it("returns a valid workflow definition unchanged", () => {
    const workflow = validWorkflow();

    expect(defineWorkflow(workflow)).toBe(workflow);
    expect(validateWorkflowDefinition(workflow)).toEqual([]);
  });

  it("reports missing start node, duplicate nodes, bad edges, and invalid policy", () => {
    const workflow = validWorkflow();
    const errors = validateWorkflowDefinition({
      ...workflow,
      startNodeId: "missing",
      nodes: [
        workflow.nodes[0]!,
        { ...workflow.nodes[0]!, policy: { timeoutMs: 0, maxAttempts: 0, riskLevel: "L0" } }
      ],
      edges: [{ from: "start", to: "unknown" }]
    });

    expect(errors).toEqual(expect.arrayContaining([
      "startNodeId must reference an existing node: missing",
      "duplicate node id: start",
      "edge target does not reference an existing node: unknown",
      "node start policy.timeoutMs must be greater than 0",
      "node start policy.maxAttempts must be greater than 0"
    ]));
  });
});
