import type { FastifyInstance } from "fastify";
import { AgentPipeline } from "@zhixu/agent-os";
import type { WorkflowResult } from "@zhixu/agent-os";
import { createAgentSession, saveWorkflowCheckpoint, updateAgentSession } from "./agent-session-helpers.js";

export async function registerWorkflowRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/api/workflows/course-presentation", async (request, reply) => {
    const { projectId, rawInput, sources, dueDate, presentationDuration } = request.body as {
      projectId?: string;
      rawInput?: string;
      sources?: Array<{ id: string; fileName: string; summary?: string }>;
      dueDate?: string;
      presentationDuration?: number;
    };

    if (!rawInput) {
      reply.status(400).send({ error: { code: "BAD_REQUEST", message: "rawInput is required" } });
      return;
    }

    const pipeline = new AgentPipeline();

    const agentSession = await createAgentSession({
      projectId: projectId ?? "default",
      workflowIntent: "course_presentation",
    });

    const sseReply = reply.raw;
    sseReply.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendSSE = (event: string, data: unknown) => {
      sseReply.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const progressEvents: unknown[] = [];
    const agentEvents: unknown[] = [];
    const canvasState: Record<string, unknown> = {};

    pipeline.onThinking((entry) => sendSSE("agent_thinking", entry));
    pipeline.onProgress((event) => {
      progressEvents.push(event);
      sendSSE("agent_progress", event);
    });
    pipeline.onAgentStatus((update) => {
      agentEvents.push(update);
      sendSSE("agent_status", update);
    });
    pipeline.onCanvasPatch((patch) => {
      Object.assign(canvasState, patch);
      sendSSE("canvas_patch", patch);
    });
    pipeline.onDecision((cards) => sendSSE("agent_decision", cards));

    try {
      const courseInput: Parameters<typeof pipeline.runCoursePresentation>[0] = {
        rawInput,
        sources: sources ?? [],
      };
      if (dueDate) courseInput.dueDate = dueDate;
      if (presentationDuration) courseInput.presentationDuration = presentationDuration;

      const result = await pipeline.runCoursePresentation(courseInput);

      await saveWorkflowCheckpoint({
        agentSessionId: agentSession.id,
        phase: pipeline.getPhase(),
        state: {
          workflowIntent: "course_presentation",
          phase: pipeline.getPhase(),
          result,
        },
        canvasStateJson: canvasState,
        progress: progressEvents,
        agents: agentEvents,
      });

      sendSSE("workflow_complete", result);
    } catch (err) {
      sendSSE("workflow_error", { message: err instanceof Error ? err.message : "Unknown error" });
    }

    sseReply.end();
  });

  fastify.post("/api/workflows/lab-meeting", async (request, reply) => {
    const { projectId, rawInput, sources, dueDate, presentationDuration } = request.body as {
      projectId?: string;
      rawInput?: string;
      sources?: Array<{ id: string; fileName: string; summary?: string }>;
      dueDate?: string;
      presentationDuration?: number;
    };

    if (!rawInput) {
      reply.status(400).send({ error: { code: "BAD_REQUEST", message: "rawInput is required" } });
      return;
    }

    const pipeline = new AgentPipeline();

    const agentSession = await createAgentSession({
      projectId: projectId ?? "default",
      workflowIntent: "lab_meeting",
    });

    const sseReply = reply.raw;
    sseReply.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendSSE = (event: string, data: unknown) => {
      sseReply.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const progressEvents: unknown[] = [];
    const agentEvents: unknown[] = [];
    const canvasState: Record<string, unknown> = {};

    pipeline.onThinking((entry) => sendSSE("agent_thinking", entry));
    pipeline.onProgress((event) => {
      progressEvents.push(event);
      sendSSE("agent_progress", event);
    });
    pipeline.onAgentStatus((update) => {
      agentEvents.push(update);
      sendSSE("agent_status", update);
    });
    pipeline.onCanvasPatch((patch) => {
      Object.assign(canvasState, patch);
      sendSSE("canvas_patch", patch);
    });
    pipeline.onDecision((cards) => sendSSE("agent_decision", cards));

    try {
      const labInput: Parameters<typeof pipeline.runLabMeeting>[0] = {
        rawInput,
        sources: sources ?? [],
      };
      if (dueDate) labInput.dueDate = dueDate;
      if (presentationDuration) labInput.presentationDuration = presentationDuration;

      const result = await pipeline.runLabMeeting(labInput);

      await saveWorkflowCheckpoint({
        agentSessionId: agentSession.id,
        phase: pipeline.getPhase(),
        state: {
          workflowIntent: "lab_meeting",
          phase: pipeline.getPhase(),
          result,
        },
        canvasStateJson: canvasState,
        progress: progressEvents,
        agents: agentEvents,
      });

      sendSSE("workflow_complete", result);
    } catch (err) {
      sendSSE("workflow_error", { message: err instanceof Error ? err.message : "Unknown error" });
    }

    sseReply.end();
  });

  fastify.post("/api/workflows/resume", async (request, reply) => {
    const { agentSessionId, decision } = request.body as {
      agentSessionId?: string;
      decision?: string;
    };

    if (!agentSessionId) {
      reply.status(400).send({ error: { code: "BAD_REQUEST", message: "agentSessionId is required" } });
      return;
    }

    await updateAgentSession(agentSessionId, {
      selectedDecision: decision ?? null,
    });

    reply.send({ data: { resumed: true, decision: decision ?? null } });
  });
}
