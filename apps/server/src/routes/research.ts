import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { PaperReader } from "@zhixu/research";
import type { LLMCallable } from "@zhixu/research";

function asLLMCallable(gateway: ModelGateway): LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [
          { role: "system", content: params.system },
          ...params.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            toolCalls: undefined,
            toolCallId: undefined,
          })),
        ],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

export async function registerResearchRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const reader = new PaperReader();
  const llm = asLLMCallable(gateway);

  // Enhanced paper reading — uses @zhixu/research package + LLM
  fastify.post("/api/projects/:projectId/research/paper-read-enhanced", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { sourceId: string; content: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    let result;
    if (llm) {
      result = await reader.readPaperEnhanced(body.content, llm);
    } else {
      result = reader.readPaper({ id: crypto.randomUUID(), fileName: "", content: body.content });
    }

    // Store as artifact with evidence
    const artifact = await store.createArtifact({ projectId, type: "report", title: `论文精读: ${result.title}` });
    await store.addEvidence(projectId, {
      sourceId: body.sourceId,
      artifactId: artifact.id,
      evidenceType: "citation",
      quoteText: result.mainResults ?? "",
      confidence: llm ? 0.7 : 0.5,
    });

    return result;
  });

  // Enhanced paper comparison
  fastify.post("/api/projects/:projectId/research/paper-compare-enhanced", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { papers: Array<{ title: string; content: string }> };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const entries = body.papers.map((p) =>
      reader.readPaper({ id: crypto.randomUUID(), fileName: "", content: p.content }),
    );
    if (llm) return reader.comparePapersEnhanced(entries, llm);
    return reader.comparePapers(entries);
  });
}
