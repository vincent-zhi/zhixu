import { getPrismaClient } from "@zhixu/db";

export async function createAgentSession(input: { projectId: string; workflowIntent: string }) {
  const prisma = getPrismaClient();
  return prisma.agentSession.create({
    data: {
      projectId: input.projectId,
      workflowIntent: input.workflowIntent,
    },
  });
}

export async function updateAgentSession(
  id: string,
  input: {
    currentPhase?: string;
    selectedDecision?: string | null;
    briefJson?: Record<string, unknown>;
    canvasStateJson?: Record<string, unknown>;
    progressJson?: unknown[];
    agentsJson?: unknown[];
  }
) {
  const prisma = getPrismaClient();
  const data: Record<string, unknown> = {};
  if (input.currentPhase !== undefined) data.currentPhase = input.currentPhase;
  if (input.selectedDecision !== undefined) data.selectedDecision = input.selectedDecision;
  if (input.briefJson !== undefined) data.briefJson = input.briefJson;
  if (input.canvasStateJson !== undefined) data.canvasStateJson = input.canvasStateJson;
  if (input.progressJson !== undefined) data.progressJson = input.progressJson;
  if (input.agentsJson !== undefined) data.agentsJson = input.agentsJson;
  return prisma.agentSession.update({ where: { id }, data });
}

export async function saveWorkflowCheckpoint(input: {
  agentSessionId: string;
  phase: string;
  state: Record<string, unknown>;
  canvasStateJson?: Record<string, unknown>;
  progress: unknown[];
  agents: unknown[];
}) {
  const prisma = getPrismaClient();
  const canvasStateJson = JSON.parse(JSON.stringify({
    ...(input.canvasStateJson ?? {}),
    workflowCheckpoint: input.state,
  }));
  const progressJson = JSON.parse(JSON.stringify(input.progress));
  const agentsJson = JSON.parse(JSON.stringify(input.agents));

  return prisma.agentSession.update({
    where: { id: input.agentSessionId },
    data: {
      currentPhase: input.phase,
      canvasStateJson,
      progressJson,
      agentsJson,
    },
  });
}
