import type { FastifyInstance } from "fastify";
import { getPrismaClient } from "@zhixu/db";

export async function registerAgentSessionRoutes(fastify: FastifyInstance): Promise<void> {
  const getDb = () => getPrismaClient();

  fastify.post("/api/agent-sessions", async (request, reply) => {
    const { projectId, workflowIntent } = request.body as { projectId?: string; workflowIntent?: string };
    if (!projectId) {
      reply.status(400).send({ error: { code: "BAD_REQUEST", message: "projectId is required" } });
      return;
    }
    const session = await getDb().agentSession.create({
      data: {
        projectId,
        workflowIntent: workflowIntent ?? "general",
      },
    });
    reply.send({ data: session });
  });

  fastify.get("/api/agent-sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getDb().agentSession.findUnique({ where: { id } });
    if (!session) {
      reply.status(404).send({ error: { code: "NOT_FOUND", message: "Agent session not found" } });
      return;
    }
    reply.send({ data: session });
  });

  fastify.patch("/api/agent-sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.currentPhase !== undefined) data.currentPhase = body.currentPhase;
    if (body.selectedDecision !== undefined) data.selectedDecision = body.selectedDecision;
    if (body.briefJson !== undefined) data.briefJson = body.briefJson;
    if (body.canvasStateJson !== undefined) data.canvasStateJson = body.canvasStateJson;
    if (body.progressJson !== undefined) data.progressJson = body.progressJson;
    if (body.agentsJson !== undefined) data.agentsJson = body.agentsJson;

    const session = await getDb().agentSession.update({ where: { id }, data });
    reply.send({ data: session });
  });

  fastify.post("/api/agent-sessions/:id/advance", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { phase } = request.body as { phase?: string };
    if (!phase) {
      reply.status(400).send({ error: { code: "BAD_REQUEST", message: "phase is required" } });
      return;
    }
    const session = await getDb().agentSession.update({
      where: { id },
      data: { currentPhase: phase },
    });
    reply.send({ data: session });
  });

  fastify.post("/api/agent-sessions/:id/canvas-patch", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await getDb().agentSession.findUnique({ where: { id } });
    if (!existing) {
      reply.status(404).send({ error: { code: "NOT_FOUND", message: "Agent session not found" } });
      return;
    }
    const current = (existing.canvasStateJson ?? {}) as Record<string, unknown>;
    const patched = { ...current, ...body };
    const session = await getDb().agentSession.update({
      where: { id },
      data: { canvasStateJson: JSON.parse(JSON.stringify(patched)) },
    });
    reply.send({ data: session });
  });

  fastify.get("/api/agent-sessions/project/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const sessions = await getDb().agentSession.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    reply.send({ data: sessions });
  });
}
