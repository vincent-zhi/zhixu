import type { AgentOutput } from "@zhixu/core";

export interface ModelGateway {
  generatePlan(input: { projectTitle: string; goal: string }): Promise<AgentOutput>;
  verifyOutput(input: {
    outputType: string;
    text: string;
    evidenceRefs: string[];
  }): Promise<AgentOutput>;
  chatWithTools?(input: {
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; toolCalls?: unknown[]; toolCallId?: string }>;
    systemPrompt?: string;
    thinkingBudget?: number;
  }): Promise<{ response: unknown; toolResults: unknown[] }>;
}

export class MockModelGateway implements ModelGateway {
  async generatePlan(input: { projectTitle: string; goal: string }): Promise<AgentOutput> {
    return {
      outputType: "agent.plan",
      structuredResult: {
        projectTitle: input.projectTitle,
        goal: input.goal,
        recommendedPlan: [
          "Confirm deliverable and due date",
          "Parse uploaded sources and identify evidence",
          "Draft outline with Human Gate before generation"
        ],
        urgentPlan: [
          "Use existing source summaries",
          "Generate minimal outline",
          "Require user confirmation before export"
        ],
        conservativePlan: [
          "Ask for missing requirements",
          "Build evidence map",
          "Generate artifact only after verification"
        ]
      },
      confidence: 0.78,
      requiredConfirmations: ["plan_selection"],
      evidenceRefs: [],
      riskFlags: [],
      nextActions: ["select_plan", "register_missing_sources"],
      costEstimate: {
        provider: "mock",
        model: "mock-planner-v1",
        inputTokens: 320,
        outputTokens: 180,
        estimatedUsd: 0
      }
    };
  }

  async verifyOutput(input: {
    outputType: string;
    text: string;
    evidenceRefs: string[];
  }): Promise<AgentOutput> {
    const hasEvidence = input.evidenceRefs.length > 0;

    return {
      outputType: "agent.verification",
      structuredResult: {
        checkedOutputType: input.outputType,
        textLength: input.text.length,
        evidenceCoverage: hasEvidence ? 1 : 0,
        verdict: hasEvidence ? "pass_with_sources" : "needs_evidence"
      },
      confidence: hasEvidence ? 0.86 : 0.62,
      requiredConfirmations: hasEvidence ? [] : ["evidence_review"],
      evidenceRefs: input.evidenceRefs,
      riskFlags: hasEvidence ? [] : ["missing_evidence"],
      nextActions: hasEvidence ? ["continue_editing"] : ["attach_source_or_mark_gray"],
      costEstimate: {
        provider: "mock",
        model: "mock-verifier-v1",
        inputTokens: 220,
        outputTokens: 90,
        estimatedUsd: 0
      }
    };
  }
}

export interface LLMGatewayConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  enableThinking?: boolean;
}

export async function createLLMModelGateway(
  config: LLMGatewayConfig,
  projectStore: import("./project-store.js").ProjectStore,
  citationVerifier: import("./citation-verifier.js").CitationVerifier,
  watcherService: import("./watcher.js").WatcherService
): Promise<ModelGateway> {
  const { LLMClient, LLMModelGateway, createZhiXuToolRegistry } = await import("@zhixu/model-gateway");

  const client = new LLMClient({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
    enableThinking: config.enableThinking ?? false
  });

  const toolContext = createProjectStoreToolContext(projectStore, citationVerifier, watcherService);
  const toolRegistry = createZhiXuToolRegistry(toolContext);
  const gateway = new LLMModelGateway(client, toolRegistry, { maxToolRounds: 5 });
  return gateway;
}

function createProjectStoreToolContext(
  store: import("./project-store.js").ProjectStore,
  citationVerifier: import("./citation-verifier.js").CitationVerifier,
  watcherService: import("./watcher.js").WatcherService
): import("@zhixu/model-gateway").ToolHandlerContext {
  return {
    listProjects: () => store.listProjects(),
    getProject: (id) => store.getProject(id),
    createProject: (input) => store.createProject(input as any),
    addSource: (projectId, input) => store.addSource(projectId, input as any),
    addTask: (projectId, input) => store.addTask(projectId, input as any),
    createArtifact: (input) => store.createArtifact(input as any),
    updateArtifactBlock: (artifactId, blockId, input) => store.updateArtifactBlock(artifactId, blockId, input as any),
    createHumanGate: (projectId, input) => store.createHumanGate(projectId, input as any),
    confirmHumanGate: (gateId, input) => store.confirmHumanGate(gateId, input as any),
    addEvidence: (projectId, input) => store.addEvidence(projectId, input as any),
    addCapsule: (projectId, input) => store.addCapsule(projectId, input as any),
    addMentorFeedback: (projectId, input) => store.addMentorFeedback(projectId, input as any),
    verifyCitations: (citations) => Promise.resolve(citationVerifier.batchVerify(citations as any)),
    checkWatcher: (projectId) => store.getProject(projectId).then(p => p ? watcherService.checkProject(p) : [])
  };
}
