import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveWorkflowCheckpoint } from "./agent-session-helpers.js";
import { getPrismaClient } from "@zhixu/db";

vi.mock("@zhixu/db", () => ({
  getPrismaClient: vi.fn()
}));

describe("agent-session-helpers", () => {
  const update = vi.fn();

  beforeEach(() => {
    update.mockReset();
    vi.mocked(getPrismaClient).mockReturnValue({
      agentSession: { update }
    } as unknown as ReturnType<typeof getPrismaClient>);
  });

  it("persists workflow checkpoint fields into AgentSession JSON columns", async () => {
    update.mockResolvedValueOnce({ id: "session-1" });

    await saveWorkflowCheckpoint({
      agentSessionId: "session-1",
      phase: "decision",
      state: {
        runId: "run-1",
        traceId: "trace-1",
        values: { selectedTopicId: "topic-1" },
        completedNodeIds: ["understanding"],
        failedNodeIds: []
      },
      progress: [{ phase: "decision", percentage: 25 }],
      agents: [{ agentId: "presentation", status: "waiting" }]
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: {
        currentPhase: "decision",
        canvasStateJson: {
          workflowCheckpoint: {
            runId: "run-1",
            traceId: "trace-1",
            values: { selectedTopicId: "topic-1" },
            completedNodeIds: ["understanding"],
            failedNodeIds: []
          }
        },
        progressJson: [{ phase: "decision", percentage: 25 }],
        agentsJson: [{ agentId: "presentation", status: "waiting" }]
      }
    });
  });
});
