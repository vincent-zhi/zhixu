import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowRoutes } from "./workflow.js";
import { createAgentSession, saveWorkflowCheckpoint } from "./agent-session-helpers.js";

vi.mock("./agent-session-helpers.js", () => ({
  createAgentSession: vi.fn(),
  updateAgentSession: vi.fn(),
  saveWorkflowCheckpoint: vi.fn()
}));

function parseSSE(payload: string): Array<{ event: string; data: unknown }> {
  return payload
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1] ?? "";
      const dataRaw = block.match(/^data: (.+)$/m)?.[1] ?? "null";
      return { event, data: JSON.parse(dataRaw) as unknown };
    });
}

describe("workflow routes", () => {
  beforeEach(() => {
    vi.mocked(createAgentSession).mockReset();
    vi.mocked(saveWorkflowCheckpoint).mockReset();
    vi.mocked(createAgentSession).mockResolvedValue({
      id: "session-1",
      projectId: "project-1",
      workflowIntent: "course_presentation",
      currentPhase: "task_capture",
      briefJson: {},
      selectedDecision: null,
      canvasStateJson: {},
      progressJson: [],
      agentsJson: [],
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z")
    });
  });

  it("emits the course presentation SSE event family and saves a checkpoint", async () => {
    const app = Fastify({ logger: false });
    await registerWorkflowRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/workflows/course-presentation",
      payload: {
        projectId: "project-1",
        rawInput: "我需要做一份机器学习课程PPT",
        sources: [{ id: "source-1", fileName: "机器学习基础.pdf" }],
        presentationDuration: 10
      }
    });

    const events = parseSSE(response.body);
    const eventNames = events.map((event) => event.event);

    expect(response.statusCode).toBe(200);
    expect(eventNames).toEqual(expect.arrayContaining([
      "agent_thinking",
      "agent_progress",
      "agent_status",
      "canvas_patch",
      "agent_decision",
      "workflow_complete"
    ]));
    expect(saveWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      agentSessionId: "session-1",
      phase: "completed"
    }));

    await app.close();
  });

  it("emits the lab meeting SSE event family and saves a checkpoint", async () => {
    const app = Fastify({ logger: false });
    await registerWorkflowRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/workflows/lab-meeting",
      payload: {
        projectId: "project-1",
        rawInput: "我要准备两篇论文的组会汇报",
        sources: [
          { id: "paper-1", fileName: "paper-1.pdf" },
          { id: "paper-2", fileName: "paper-2.pdf" }
        ],
        presentationDuration: 15
      }
    });

    const events = parseSSE(response.body);
    const eventNames = events.map((event) => event.event);

    expect(response.statusCode).toBe(200);
    expect(eventNames).toEqual(expect.arrayContaining([
      "agent_thinking",
      "agent_progress",
      "agent_status",
      "canvas_patch",
      "agent_decision",
      "workflow_complete"
    ]));
    expect(saveWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      agentSessionId: "session-1",
      phase: "completed"
    }));

    await app.close();
  });
});
