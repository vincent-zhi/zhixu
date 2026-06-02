import { describe, expect, it } from "vitest";
import { AgentRegistry } from "@zhixu/agent-harness";
import { registerAgentOsHandlers } from "./agent-handlers.js";
import { coursePresentationWorkflow } from "./course-presentation.workflow.js";
import { labMeetingWorkflow } from "./lab-meeting.workflow.js";

describe("registerAgentOsHandlers", () => {
  it("registers every non-human node ref used by course and lab workflows", () => {
    const registry = new AgentRegistry();
    registerAgentOsHandlers(registry);

    const refs = [...coursePresentationWorkflow.nodes, ...labMeetingWorkflow.nodes]
      .filter((node) => node.type !== "human_gate")
      .map((node) => node.ref);

    for (const ref of refs) {
      expect(registry.has(ref), `missing handler for ${ref}`).toBe(true);
    }
  });
});
