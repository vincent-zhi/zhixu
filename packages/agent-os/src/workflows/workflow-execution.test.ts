import { describe, expect, it } from "vitest";
import { AgentRegistry, HarnessEventEmitter, InMemoryCheckpointStore, WorkflowExecutor } from "@zhixu/agent-harness";
import type { WorkflowState } from "@zhixu/agent-harness";
import { registerAgentOsHandlers } from "./agent-handlers.js";
import { coursePresentationWorkflow } from "./course-presentation.workflow.js";
import { labMeetingWorkflow } from "./lab-meeting.workflow.js";

function createExecutor(): WorkflowExecutor {
  const registry = new AgentRegistry();
  registerAgentOsHandlers(registry);
  return new WorkflowExecutor(
    registry,
    new InMemoryCheckpointStore(),
    new HarnessEventEmitter()
  );
}

describe("agent-os workflow execution", () => {
  it("runs course presentation workflow through topic selection", async () => {
    const executor = createExecutor();

    const first = await executor.run(coursePresentationWorkflow, {
      rawInput: "我需要做一份机器学习课程PPT",
      sources: [{ id: "source-1", fileName: "机器学习基础.pdf" }],
      presentationDuration: 10
    });

    expect(first.state.status).toBe("waiting_human");
    expect(first.interrupt?.nodeId).toBe("select_topic");
    expect(first.state.values["topicCandidates"]).toBeDefined();

    const topicCandidates = first.state.values["topicCandidates"] as Array<{ id: string }>;
    const resumedState: WorkflowState = {
      ...first.state,
      values: { ...first.state.values, selectedTopicId: topicCandidates[0]?.id ?? "topic-1" },
      completedNodeIds: [...first.state.completedNodeIds, "select_topic"],
      status: "running"
    };

    const result = await executor.run(coursePresentationWorkflow, {}, { resumeFrom: resumedState });

    expect(result.state.status).toBe("completed");
    expect(result.state.values["brief"]).toBeDefined();
    expect(result.state.values["slidePlans"]).toBeDefined();
    expect(result.state.values["speakerNotes"]).toBeDefined();
  });

  it("runs lab meeting workflow through path selection", async () => {
    const executor = createExecutor();

    const first = await executor.run(labMeetingWorkflow, {
      rawInput: "我要准备两篇论文的组会汇报",
      sources: [
        { id: "paper-1", fileName: "paper-1.pdf" },
        { id: "paper-2", fileName: "paper-2.pdf" }
      ],
      presentationDuration: 15
    });

    expect(first.state.status).toBe("waiting_human");
    expect(first.interrupt?.nodeId).toBe("select_path");
    expect(first.state.values["paperCards"]).toBeDefined();
    expect(first.state.values["presentationPaths"]).toBeDefined();

    const presentationPaths = first.state.values["presentationPaths"] as Array<{ id: string }>;
    const resumedState: WorkflowState = {
      ...first.state,
      values: { ...first.state.values, selectedPathId: presentationPaths[0]?.id ?? "path-comparison" },
      completedNodeIds: [...first.state.completedNodeIds, "select_path"],
      status: "running"
    };

    const result = await executor.run(labMeetingWorkflow, {}, { resumeFrom: resumedState });

    expect(result.state.status).toBe("completed");
    expect(result.state.values["comparisonMatrix"]).toBeDefined();
    expect(result.state.values["slidePlans"]).toBeDefined();
    expect(result.state.values["advisorQuestions"]).toBeDefined();
  });
});
