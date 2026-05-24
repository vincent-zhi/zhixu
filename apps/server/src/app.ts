import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  ConfirmHumanGateInputSchema,
  CreateArtifactInputSchema,
  CreateHumanGateInputSchema,
  CreateProjectInputSchema,
  CreateSourceInputSchema,
  CreateTaskInputSchema,
  GeneratePlanInputSchema,
  UpdateArtifactBlockInputSchema,
  VerifyOutputInputSchema,
  type ArtifactBlockSummary
} from "@zhixu/core";
import { getPrismaClient, PrismaProjectStore } from "@zhixu/db";
import {
  ExportPipeline,
  PptxRenderer,
  DocxRenderer,
  MarkdownRenderer,
  PptExportInputSchema,
  DocExportInputSchema
} from "@zhixu/artifact-factory";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions
} from "fastify";
import { ZodError } from "zod";
import { MockModelGateway, createLLMModelGateway, type ModelGateway, type LLMGatewayConfig } from "./model-gateway.js";
import { InMemoryProjectStore, type ProjectStore } from "./project-store.js";
import { ZhiXuSteward } from "./zhixu-steward.js";
import { WatcherService } from "./watcher.js";
import { CitationVerifier } from "./citation-verifier.js";
import { DocumentPipeline } from "./document-pipeline.js";
import { QuotaManager } from "./quota-manager.js";
import { ProjectEventSchema } from "@zhixu/agent-core";
import { TaskStateMachine, type StateDefinition } from "@zhixu/agent-os";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  HumanGateRequiredError,
  PermissionChecker,
  SandboxPolicy,
  SkillInvocationRunner,
  type SkillManifest
} from "@zhixu/skill-runtime";
import { SkillRegistry } from "./skill-registry.js";

export interface CreateServerAppOptions extends FastifyServerOptions {
  projectStore?: ProjectStore;
  modelGateway?: ModelGateway;
  storeType?: "memory" | "prisma";
  llmConfig?: LLMGatewayConfig;
}

export async function createServerApp(
  options: CreateServerAppOptions = {}
): Promise<FastifyInstance> {
  const storeType = options.storeType ?? (process.env.STORE_TYPE === "prisma" ? "prisma" : "memory");
  const projectStore: ProjectStore =
    options.projectStore ??
    (storeType === "prisma"
      ? new PrismaProjectStore(getPrismaClient()) as unknown as ProjectStore
      : new InMemoryProjectStore());
  const watcher = new WatcherService(projectStore);
  const citationVerifier = new CitationVerifier();

  const llmConfigPath = join(process.cwd(), ".zhixu-llm-config.json");
  function loadPersistedLLMConfig(): LLMGatewayConfig | undefined {
    try {
      if (existsSync(llmConfigPath)) {
        const raw = readFileSync(llmConfigPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.apiKey && parsed.baseURL && parsed.model) return parsed;
      }
    } catch {}
    return undefined;
  }
  function persistLLMConfig(config: LLMGatewayConfig | undefined): void {
    try {
      if (config && config.apiKey && config.baseURL && config.model) {
        writeFileSync(llmConfigPath, JSON.stringify(config, null, 2), "utf-8");
      } else if (existsSync(llmConfigPath)) {
        writeFileSync(llmConfigPath, "{}", "utf-8");
      }
    } catch {}
  }

  let llmConfig = options.llmConfig ?? loadPersistedLLMConfig() ?? (
    process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL
      ? {
          apiKey: process.env.LLM_API_KEY,
          baseURL: process.env.LLM_BASE_URL,
          model: process.env.LLM_MODEL,
          enableThinking: process.env.LLM_ENABLE_THINKING === "true"
        }
      : undefined
  );
  let modelGateway = options.modelGateway ?? new MockModelGateway();
  const steward = new ZhiXuSteward(projectStore, modelGateway);
  const skills = new SkillRegistry();
  const permissionChecker = new PermissionChecker();
  const sandboxPolicy = new SandboxPolicy();
  const skillRunner = new SkillInvocationRunner(permissionChecker, sandboxPolicy);
  const quotaManager = new QuotaManager();
  const exportPipeline = new ExportPipeline(
    new PptxRenderer(),
    new DocxRenderer(),
    new MarkdownRenderer()
  );
  registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline);
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: (request) =>
      request.headers["x-request-id"]?.toString() ?? crypto.randomUUID()
  });

  if (!options.modelGateway && llmConfig) {
    try {
      modelGateway = await createLLMModelGateway(
        llmConfig,
        projectStore,
        citationVerifier,
        watcher
      );
      steward.setModelGateway(modelGateway);
      app.log.info({ model: llmConfig.model }, "LLM ModelGateway initialized");
    } catch (error) {
      app.log.warn({ error }, "Failed to initialize LLM ModelGateway, falling back to mock");
    }
  }

  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues.map((issue) => issue.message).join("; "),
          requestId: request.id
        }
      });
    }

    const statusCode = getStatusCode(error);
    request.log.error({ error, requestId: request.id }, "request failed");
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
        message: statusCode === 404 ? "Resource not found" : "Unexpected server error",
        requestId: request.id
      }
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "zhixu-server"
  }));

  app.get("/ready", async () => ({
    status: "ok",
    checks: {
      api: "ok",
      database: process.env.DATABASE_URL ? "configured" : "not_configured"
    }
  }));

  app.get("/api/projects", async () => ({ data: await projectStore.listProjects() }));

  app.post("/api/projects", async (request, reply) => {
    const input = CreateProjectInputSchema.parse(request.body);
    const project = await projectStore.createProject(input);
    return reply.status(201).send({ data: project });
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId", async (request, reply) => {
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    return { data: project };
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/state", async (request, reply) => {
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    const definition: StateDefinition = TaskStateMachine.getDefinition(project.status);
    return { data: definition };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/transition", async (request, reply) => {
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    const body = request.body as { trigger?: string; confirmations?: string[] };
    if (!body.trigger || typeof body.trigger !== "string") {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "trigger is required and must be a string",
          requestId: request.id
        }
      });
    }

    const nextStatus = TaskStateMachine.getNextStatus(project.status, body.trigger);
    if (!nextStatus) {
      return reply.status(422).send({
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from "${project.status}" with trigger "${body.trigger}"`,
          requestId: request.id
        }
      });
    }

    const transition = TaskStateMachine.getTransitionsFrom(project.status).find(
      (t) => t.trigger === body.trigger
    );
    if (transition && transition.requiredConfirmations.length > 0) {
      const providedConfirmations = body.confirmations ?? [];
      const missingConfirmations = transition.requiredConfirmations.filter(
        (c) => !providedConfirmations.includes(c)
      );
      if (missingConfirmations.length > 0) {
        return reply.status(422).send({
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: `Missing required confirmations: ${missingConfirmations.join(", ")}`,
            missingConfirmations,
            requestId: request.id
          }
        });
      }
    }

    const from = project.status;
    await projectStore.updateProjectStatus(request.params.projectId, nextStatus);
    return { data: { from, to: nextStatus } };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/sources", async (request, reply) => {
    const input = CreateSourceInputSchema.parse(request.body);
    const userId = input.uploadedBy;
    const quotaResult = quotaManager.consumeQuota(userId, "parse_source", 1);
    if (!quotaResult.allowed) {
      return reply.status(429).send({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Quota exceeded for parse_source",
          degradationOptions: quotaResult.degradationOptions,
          requestId: request.id
        }
      });
    }
    const source = await projectStore.addSource(request.params.projectId, input);
    try {
      const pipeline = new DocumentPipeline();
      const parseResult = await pipeline.parseSource({
        id: source.id,
        projectId: source.projectId,
        uploadedBy: source.uploadedBy,
        fileName: source.fileName,
        fileType: source.fileType,
        storageUri: source.storageUri,
        parseStatus: source.parseStatus,
        ocrStatus: source.ocrStatus,
        indexStatus: source.indexStatus,
        sensitivityLevel: source.sensitivityLevel,
        createdAt: source.createdAt
      }, `# ${source.fileName}\n\nPlaceholder content for ${source.fileType} file.`);
      app.log.info({ sourceId: source.id, parseResult }, "Source parsed successfully");
    } catch (error) {
      app.log.warn({ sourceId: source.id, error }, "Source parsing failed");
    }
    return reply.status(201).send({ data: source });
  });

  app.get("/api/agent-jobs", async () => ({
    data: await projectStore.listAgentJobs()
  }));

  app.get("/api/skills", async () => ({
    data: skills.listSkills()
  }));

  app.post<{
    Params: { skillId: string };
  }>("/api/skills/:skillId/invoke", async (request, reply) => {
    const manifest = skills.getSkillManifest(request.params.skillId);
    if (!manifest) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Skill not found",
          requestId: request.id
        }
      });
    }

    const body = request.body as Record<string, unknown>;
    const userId = typeof body?.userId === "string" ? body.userId : "anonymous";
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const input = typeof body?.input === "object" && body?.input !== null
      ? (body.input as Record<string, unknown>)
      : {};

    const quotaResult = quotaManager.consumeQuota(userId, "skill_invocation", 1);
    if (!quotaResult.allowed) {
      return reply.status(429).send({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Quota exceeded for skill_invocation",
          degradationOptions: quotaResult.degradationOptions,
          requestId: request.id
        }
      });
    }

    try {
      const result = await skillRunner.invoke(manifest, { userId, projectId, input });
      return reply.status(200).send({ data: result });
    } catch (error) {
      if (error instanceof HumanGateRequiredError) {
        return reply.status(403).send({
          error: {
            code: "HUMAN_GATE_REQUIRED",
            message: error.message,
            skillId: error.skillId,
            missingScopes: error.missingScopes,
            riskLevel: error.riskLevel,
            requestId: request.id
          }
        });
      }
      throw error;
    }
  });

  app.post<{
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/export/pptx", async (request, reply) => {
    const artifact = await projectStore.getArtifact(request.params.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }

    const exportUserId = (request.body as Record<string, unknown>)?.userId as string ?? "anonymous";
    const quotaResult = quotaManager.consumeQuota(exportUserId, "export", 1);
    if (!quotaResult.allowed) {
      return reply.status(429).send({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Quota exceeded for export",
          degradationOptions: quotaResult.degradationOptions,
          requestId: request.id
        }
      });
    }

    const project = await projectStore.getProject(artifact.projectId);
    if (project) {
      const pendingGates = project.humanGates.filter(
        (gate) => gate.status === "pending" && gate.gateType.includes("artifact")
      );
      if (pendingGates.length > 0) {
        return reply.status(403).send({
          error: {
            code: "HUMAN_GATE_REQUIRED",
            message: "Artifact has pending human gate confirmations that must be resolved before export",
            pendingGates: pendingGates.map((g) => g.id),
            requestId: request.id
          }
        });
      }
    }

    const pptInput = PptExportInputSchema.parse({
      title: artifact.title,
      slides: artifact.blocks.map((block: ArtifactBlockSummary) => ({
        title: block.contentJson["title"] as string ?? block.blockType,
        contentBlocks: [
          {
            type: "text" as const,
            text: typeof block.contentJson["text"] === "string"
              ? block.contentJson["text"] as string
              : JSON.stringify(block.contentJson),
            responsibilityColor: block.responsibilityColor
          }
        ],
        evidenceRefs: Array.isArray(block.contentJson["evidenceRefs"])
          ? block.contentJson["evidenceRefs"] as string[]
          : []
      }))
    });

    const result = await exportPipeline.exportPptx(pptInput);
    return reply
      .header("Content-Type", result.mimeType)
      .header("Content-Disposition", `attachment; filename="${result.fileName}"`)
      .send(result.buffer);
  });

  app.post<{
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/export/docx", async (request, reply) => {
    const artifact = await projectStore.getArtifact(request.params.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }

    const exportUserId = (request.body as Record<string, unknown>)?.userId as string ?? "anonymous";
    const quotaResult = quotaManager.consumeQuota(exportUserId, "export", 1);
    if (!quotaResult.allowed) {
      return reply.status(429).send({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Quota exceeded for export",
          degradationOptions: quotaResult.degradationOptions,
          requestId: request.id
        }
      });
    }

    const project = await projectStore.getProject(artifact.projectId);
    if (project) {
      const pendingGates = project.humanGates.filter(
        (gate) => gate.status === "pending" && gate.gateType.includes("artifact")
      );
      if (pendingGates.length > 0) {
        return reply.status(403).send({
          error: {
            code: "HUMAN_GATE_REQUIRED",
            message: "Artifact has pending human gate confirmations that must be resolved before export",
            pendingGates: pendingGates.map((g) => g.id),
            requestId: request.id
          }
        });
      }
    }

    const docInput = DocExportInputSchema.parse({
      title: artifact.title,
      sections: artifact.blocks.map((block: ArtifactBlockSummary) => ({
        type: block.blockType === "heading" ? "heading" as const : "paragraph" as const,
        level: typeof block.contentJson["level"] === "number" ? block.contentJson["level"] : undefined,
        text: typeof block.contentJson["text"] === "string"
          ? block.contentJson["text"] as string
          : JSON.stringify(block.contentJson),
        responsibilityColor: block.responsibilityColor,
        evidenceRefs: Array.isArray(block.contentJson["evidenceRefs"])
          ? block.contentJson["evidenceRefs"] as string[]
          : []
      }))
    });

    const result = await exportPipeline.exportDocx(docInput);
    return reply
      .header("Content-Type", result.mimeType)
      .header("Content-Disposition", `attachment; filename="${result.fileName}"`)
      .send(result.buffer);
  });

  app.post<{
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/export/markdown", async (request, reply) => {
    const artifact = await projectStore.getArtifact(request.params.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }

    const exportUserId = (request.body as Record<string, unknown>)?.userId as string ?? "anonymous";
    const quotaResult = quotaManager.consumeQuota(exportUserId, "export", 1);
    if (!quotaResult.allowed) {
      return reply.status(429).send({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "Quota exceeded for export",
          degradationOptions: quotaResult.degradationOptions,
          requestId: request.id
        }
      });
    }

    const project = await projectStore.getProject(artifact.projectId);
    if (project) {
      const pendingGates = project.humanGates.filter(
        (gate) => gate.status === "pending" && gate.gateType.includes("artifact")
      );
      if (pendingGates.length > 0) {
        return reply.status(403).send({
          error: {
            code: "HUMAN_GATE_REQUIRED",
            message: "Artifact has pending human gate confirmations that must be resolved before export",
            pendingGates: pendingGates.map((g) => g.id),
            requestId: request.id
          }
        });
      }
    }

    const mdInput = DocExportInputSchema.parse({
      title: artifact.title,
      sections: artifact.blocks.map((block: ArtifactBlockSummary) => ({
        type: block.blockType === "heading" ? "heading" as const : "paragraph" as const,
        level: typeof block.contentJson["level"] === "number" ? block.contentJson["level"] : undefined,
        text: typeof block.contentJson["text"] === "string"
          ? block.contentJson["text"] as string
          : JSON.stringify(block.contentJson),
        responsibilityColor: block.responsibilityColor,
        evidenceRefs: Array.isArray(block.contentJson["evidenceRefs"])
          ? block.contentJson["evidenceRefs"] as string[]
          : []
      }))
    });

    const result = await exportPipeline.exportMarkdown(mdInput);
    return reply
      .header("Content-Type", result.mimeType)
      .header("Content-Disposition", `attachment; filename="${result.fileName}"`)
      .send(result.buffer);
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/memory-candidates", async (request) => ({
    data: await projectStore.listMemoryCandidates(request.params.projectId)
  }));

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/tasks", async (request, reply) => {
    const input = CreateTaskInputSchema.parse(request.body);
    const task = await projectStore.addTask(request.params.projectId, input);
    return reply.status(201).send({ data: task });
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/human-gates", async (request, reply) => {
    const input = CreateHumanGateInputSchema.parse(request.body);
    const gate = await projectStore.createHumanGate(request.params.projectId, input);
    return reply.status(201).send({ data: gate });
  });

  app.post("/api/artifacts", async (request, reply) => {
    const input = CreateArtifactInputSchema.parse(request.body);
    const artifact = await projectStore.createArtifact(input);
    return reply.status(201).send({ data: artifact });
  });

  app.patch<{
    Params: { artifactId: string; blockId: string };
  }>("/api/artifacts/:artifactId/blocks/:blockId", async (request, reply) => {
    const input = UpdateArtifactBlockInputSchema.parse(request.body);
    const block = await projectStore.updateArtifactBlock(
      request.params.artifactId,
      request.params.blockId,
      input
    );
    if (!block) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    return { data: block };
  });

  app.post<{
    Params: { gateId: string };
  }>("/api/human-gates/:gateId/confirm", async (request, reply) => {
    const input = ConfirmHumanGateInputSchema.parse(request.body);
    const gate = await projectStore.confirmHumanGate(request.params.gateId, input);
    if (!gate) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    return { data: gate };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/agent/plan", async (request, reply) => {
    const input = GeneratePlanInputSchema.parse(request.body);
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    const job = await projectStore.enqueueAgentJob({
      projectId: project.id,
      jobType: "generate_plan",
      inputRef: { goal: input.goal }
    });
    const output = await modelGateway.generatePlan({
      projectTitle: project.title,
      goal: input.goal
    });
    const completed = await projectStore.completeAgentJob(job.id, output);
    return reply.status(201).send({ data: completed });
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/agent/verify", async (request, reply) => {
    const input = VerifyOutputInputSchema.parse(request.body);
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    const job = await projectStore.enqueueAgentJob({
      projectId: project.id,
      jobType: "verify_output",
      inputRef: {
        outputType: input.outputType,
        evidenceRefs: input.evidenceRefs
      }
    });
    const output = await modelGateway.verifyOutput(input);
    const completed = await projectStore.completeAgentJob(job.id, output);
    return reply.status(201).send({ data: completed });
  });

  app.get("/api/settings/llm", async (_request, reply) => {
    return reply.send({
      data: {
        configured: llmConfig !== undefined,
        baseURL: llmConfig?.baseURL ?? "",
        model: llmConfig?.model ?? "",
        enableThinking: llmConfig?.enableThinking ?? false,
        apiKeySet: llmConfig?.apiKey ? true : false,
        isLLMGateway: typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function"
      }
    });
  });

  app.put("/api/settings/llm", async (request, reply) => {
    const body = request.body as {
      apiKey?: string;
      baseURL?: string;
      model?: string;
      enableThinking?: boolean;
    };

    if (!body.baseURL || !body.model) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "baseURL and model are required",
          requestId: request.id
        }
      });
    }

    const apiKey = body.apiKey || (llmConfig?.apiKey ?? "");
    if (!apiKey) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "apiKey is required for initial configuration",
          requestId: request.id
        }
      });
    }

    const newConfig: LLMGatewayConfig = {
      apiKey,
      baseURL: body.baseURL,
      model: body.model,
      enableThinking: body.enableThinking ?? false
    };

    try {
      const newGateway = await createLLMModelGateway(
        newConfig,
        projectStore,
        citationVerifier,
        watcher
      );
      modelGateway = newGateway;
      steward.setModelGateway(newGateway);
      registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline);
      llmConfig = newConfig;
      persistLLMConfig(newConfig);

      app.log.info({ model: newConfig.model }, "LLM ModelGateway reconfigured via API");

      return reply.send({
        data: {
          configured: true,
          baseURL: newConfig.baseURL,
          model: newConfig.model,
          enableThinking: newConfig.enableThinking,
          apiKeySet: true,
          isLLMGateway: true
        }
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: "LLM_CONFIG_FAILED",
          message: `Failed to configure LLM gateway: ${error instanceof Error ? error.message : String(error)}`,
          requestId: request.id
        }
      });
    }
  });

  app.delete("/api/settings/llm", async (_request, reply) => {
    modelGateway = new MockModelGateway();
    steward.setModelGateway(modelGateway);
    registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline);
    llmConfig = undefined;
    persistLLMConfig(undefined);

    return reply.send({
      data: {
        configured: false,
        baseURL: "",
        model: "",
        enableThinking: false,
        apiKeySet: false,
        isLLMGateway: false
      }
    });
  });

  app.post("/api/chat", async (request, reply) => {
    const gw = modelGateway as ModelGateway;
    if (typeof (gw as unknown as Record<string, unknown>).chatWithTools !== "function") {
      return reply.status(501).send({
        error: {
          code: "NOT_IMPLEMENTED",
          message: "LLM gateway not configured. Set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL environment variables.",
          requestId: request.id
        }
      });
    }

    const body = request.body as { messages?: Array<{ role: string; content: string }>; systemPrompt?: string };
    if (!body.messages || !Array.isArray(body.messages)) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "messages array is required",
          requestId: request.id
        }
      });
    }

    const chatInput: { messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null }>; systemPrompt?: string } = {
      messages: body.messages as any
    };
    chatInput.systemPrompt = body.systemPrompt || `你是「知序」，一位专业的 AI 学习科研管家。

核心身份：
- 你叫「知序」，不是其他任何 AI 模型
- 你是用户的学习和科研助手，专注于学术场景
- 你的回答应该专业、准确、有条理
- 当用户问你是什么模型、用什么模型、底层模型是什么时，你必须回答：「我是知序深度定制的大语言模型，由 DeepSeek V4 提供基座模型。」绝对不能提及 Claude、GPT、OpenAI、Anthropic 等其他模型或公司名称

工具使用（非常重要）：
你拥有以下工具，必须在需要时主动调用，不要凭空编造信息：
- list_projects：当用户询问项目、任务、进度时，必须先调用此工具获取真实数据
- get_project：当用户提到某个具体项目时，用此工具获取详情
- create_project：当用户要创建新项目时调用
- add_source：当用户要上传文件/资料时调用
- add_task：当用户要添加任务时调用
- create_artifact / update_artifact_block：当用户要创建或编辑产物（PPT、文档等）时调用
- verify_citations：当用户要验证引用时调用
- check_watcher：当用户询问项目问题或提醒时调用
- add_evidence / create_capsule：当需要记录证据或知识时调用

工具调用原则：
1. 用户问"我有什么项目"、"项目列表"、"进度"等 → 必须先调用 list_projects
2. 用户提到具体项目名或ID → 必须先调用 get_project 获取详情
3. 先调用工具获取真实数据，再基于数据回答，不要凭记忆或猜测
4. 工具返回的数据是真实的，基于它来组织回答
5. 如果工具返回空结果，如实告知用户

能力范围：
- 帮助制作课程 PPT、报告、论文整理
- 制定考试复习计划、生成练习题
- 文献检索与知识总结
- 实验数据整理与报告生成
- 翻译、大纲生成、引用验证
- 项目管理与任务拆解

输出格式：
- 用中文回答，除非用户使用其他语言
- 回答简洁实用，避免冗长空洞
- 项目列表、对比信息等用 Markdown 表格展示
- 涉及专业内容时标注来源或说明可信度
- 需要用户确认的重要操作会明确提示
- 不确定的内容如实说明，不编造`;

    const lastUserMsg = body.messages.filter((m) => m.role === "user").pop();
    const preToolResults: Array<{ toolCallId: string; functionName: string; arguments: Record<string, unknown>; result: string }> = [];

    if (lastUserMsg && typeof (gw as Required<ModelGateway>).chatWithTools === "function") {
      const msg = lastUserMsg.content.toLowerCase();
      const shouldListProjects = /项目|project|进度|任务列表|我有什么|有哪些/.test(msg) && !/创建|新建|添加/.test(msg);
      if (shouldListProjects) {
        try {
          const projects = await projectStore.listProjects();
          preToolResults.push({
            toolCallId: "pre_list_projects",
            functionName: "list_projects",
            arguments: {},
            result: JSON.stringify(projects),
          });
          chatInput.systemPrompt += `\n\n[系统自动获取的数据 - list_projects 结果]：\n${JSON.stringify(projects, null, 2)}\n\n请基于以上真实数据回答用户的问题。如果项目列表为空，请如实告知用户还没有项目。用 Markdown 表格展示项目列表。`;
        } catch {
          request.log.error("pre-tool listProjects failed");
        }
      }
    }

    let result;
    try {
      result = await (gw as Required<ModelGateway>).chatWithTools(chatInput);
    } catch (chatErr: any) {
      const errMsg = chatErr?.error?.message ?? chatErr?.message ?? String(chatErr);
      const errCode = chatErr?.error?.code ?? chatErr?.code ?? "CHAT_ERROR";
      if (errCode === "invalid_api_key" || /api.?key/i.test(errMsg)) {
        return reply.status(401).send({
          error: {
            code: "INVALID_API_KEY",
            message: "API Key 无效或已过期，请在「设置 → 模型设置」中重新配置",
            requestId: request.id
          }
        });
      }
      request.log.error({ err: chatErr }, "chatWithTools failed");
      return reply.status(502).send({
        error: {
          code: "LLM_ERROR",
          message: `AI 模型调用失败：${errMsg}`,
          requestId: request.id
        }
      });
    }

    if (preToolResults.length > 0 && result.toolResults.length === 0) {
      result.toolResults = preToolResults;
    } else if (preToolResults.length > 0) {
      result.toolResults = [...preToolResults, ...result.toolResults];
    }

    return { data: result };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/events", async (request, reply) => {
    const event = ProjectEventSchema.parse(request.body);
    const run = await steward.handleProjectEvent(request.params.projectId, event);
    if (!run) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    return reply.status(202).send({ data: run });
  });

  app.get("/api/watcher/check", async () => ({
    data: await watcher.checkAllProjects()
  }));

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/reminders", async (request, reply) => {
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    return { data: watcher.checkProject(project) };
  });

  app.post("/api/citations/verify", async (request) => {
    const body = request.body as { citations?: Array<{ rawText: string; doi?: string; title?: string; year?: number }> };
    const citations = Array.isArray(body?.citations) ? body.citations : [];
    return { data: citationVerifier.batchVerify(citations) };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/evidence", async (request, reply) => {
    const body = request.body as { sourceId?: string; artifactId?: string; blockId?: string; evidenceType: string; quoteText?: string; pageNumber?: number; confidence?: number };
    const evidence = await projectStore.addEvidence(request.params.projectId, body);
    return reply.status(201).send({ data: evidence });
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/evidence", async (request) => {
    return { data: await projectStore.listEvidence(request.params.projectId) };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/capsules", async (request, reply) => {
    const body = request.body as { title: string; capsuleType?: string; summary: string; reusableStructureJson?: Record<string, unknown>; reusableTasksJson?: Record<string, unknown>[]; keyEvidenceIds?: string[]; privacyScope?: string };
    const capsule = await projectStore.addCapsule(request.params.projectId, body);
    return reply.status(201).send({ data: capsule });
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/capsules", async (request) => {
    return { data: await projectStore.listCapsules(request.params.projectId) };
  });

  app.get<{
    Params: { traceId: string };
  }>("/api/traces/:traceId", async (request, reply) => {
    const jobs = await projectStore.listAgentJobs();
    const job = jobs.find((j) => j.traceId === request.params.traceId);
    if (!job) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return { data: job };
  });

  app.post("/api/feedback/parse", async (request) => {
    const body = request.body as { sourceId?: string; feedbackType?: string; comment?: string };
    app.log.info({ body }, "Parse feedback received");
    return { data: { received: true } };
  });

  app.get<{
    Params: { userId: string };
  }>("/api/quota/:userId", async (request) => {
    const userId = request.params.userId;
    const quotaTypes = ["parse_source", "long_context", "export", "skill_invocation"];
    const quotas = quotaTypes.map((quotaType) => quotaManager.checkQuota(userId, quotaType, 0));
    return { data: quotas };
  });

  app.post<{
    Params: { userId: string };
  }>("/api/quota/:userId/check", async (request) => {
    const body = request.body as { quotaType: string; requestedAmount?: number };
    const result = quotaManager.checkQuota(
      request.params.userId,
      body.quotaType,
      body.requestedAmount ?? 1
    );
    return { data: result };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/versions", async (request, reply) => {
    const body = request.body as { entityType: string; entityId: string; snapshotJson: Record<string, unknown>; createdBy: string; createdReason?: string };
    const versionInput: { entityType: string; entityId: string; projectId: string; snapshotJson: Record<string, unknown>; createdBy: string; createdReason?: string } = {
      entityType: body.entityType,
      entityId: body.entityId,
      projectId: request.params.projectId,
      snapshotJson: body.snapshotJson,
      createdBy: body.createdBy,
    };
    if (body.createdReason !== undefined) {
      versionInput.createdReason = body.createdReason;
    }
    const version = await projectStore.createVersion(versionInput);
    return reply.status(201).send({ data: version });
  });

  app.get<{
    Params: { entityType: string; entityId: string };
  }>("/api/versions/:entityType/:entityId", async (request) => {
    const versions = await projectStore.listVersions(
      request.params.entityType,
      request.params.entityId
    );
    return { data: versions };
  });

  app.get<{
    Params: { versionId: string };
  }>("/api/versions/:versionId", async (request, reply) => {
    const version = await projectStore.getVersion(request.params.versionId);
    if (!version) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return { data: version };
  });

  app.post<{
    Params: { versionId: string };
  }>("/api/versions/:versionId/rollback", async (request, reply) => {
    const version = await projectStore.rollbackToVersion(request.params.versionId);
    if (!version) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return reply.status(201).send({ data: version });
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/mentor-feedback", async (request, reply) => {
    const body = request.body as { sourceType: string; sourceId?: string; rawContent: string; feedbackType?: string };
    const feedback = await projectStore.addMentorFeedback(request.params.projectId, body);
    return reply.status(201).send({ data: feedback });
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/mentor-feedback", async (request) => {
    return { data: await projectStore.listMentorFeedback(request.params.projectId) };
  });

  app.patch<{
    Params: { feedbackId: string };
  }>("/api/mentor-feedback/:feedbackId/bind", async (request, reply) => {
    const body = request.body as { actionItemId: string; entityType: string; entityId: string };
    const feedback = await projectStore.bindFeedbackItem(request.params.feedbackId, body);
    if (!feedback) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return { data: feedback };
  });

  app.post<{
    Params: { feedbackId: string };
  }>("/api/mentor-feedback/:feedbackId/resolve", async (request, reply) => {
    const body = request.body as { resolvedBy: string };
    const feedback = await projectStore.resolveFeedbackItem(request.params.feedbackId, body);
    if (!feedback) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return { data: feedback };
  });

  return app;
}

function getStatusCode(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

function registerBuiltinSkillHandlers(
  runner: SkillInvocationRunner,
  registry: SkillRegistry,
  gateway: ModelGateway,
  store: ProjectStore,
  pipeline: ExportPipeline
): void {
  const allSkills = registry.listSkills();

  for (const manifest of allSkills) {
    runner.registerHandler(manifest.id, async (context) => {
      const { userId, projectId, input } = context;

      switch (manifest.id) {
        case "skill_source_parse":
        case "skill_pdf_parse":
        case "skill_ocr":
        case "skill_excel_data": {
          const sourceId = (input.sourceId as string) ?? "";
          const project = await store.getProject(projectId);
          const source = project?.sources.find((s) => s.id === sourceId);
          if (!source) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Source ${sourceId} not found` },
              confidence: 0,
              requiredConfirmations: [],
              evidenceRefs: [],
              riskFlags: ["source_not_found"],
              nextActions: ["upload_source_first"],
              costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
            };
          }
          const parseResult: Record<string, unknown> = {
            status: "completed",
            sourceId,
            fileName: source.fileName,
            document: { title: source.fileName, sections: [] as Array<Record<string, unknown>> },
            evidenceAnchors: [],
            responsibilityColor: "gray" as const
          };
          if (typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function") {
            try {
              const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
                messages: [{ role: "user", content: `请解析以下文件的结构和关键内容：${source.fileName}` }],
                systemPrompt: "你是知序AI的文档解析Agent。请提取文档的结构、关键信息和证据锚点。"
              });
              (parseResult.document as Record<string, unknown>)["sections"] = [{ type: "text", text: (llmResult.response as Record<string, unknown>)?.content as string ?? "" }];
            } catch { /* fallback to local result */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: parseResult,
            confidence: 0.7,
            requiredConfirmations: [],
            evidenceRefs: [sourceId],
            riskFlags: [],
            nextActions: ["review_parsed_content"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_artifact_verify": {
          const artifactId = (input.artifactId as string) ?? "";
          const blockId = (input.blockId as string) ?? "";
          try {
            const verifyResult = await gateway.verifyOutput({
              outputType: "artifact.block",
              text: `Verifying artifact ${artifactId} block ${blockId}`,
              evidenceRefs: []
            });
            return {
              outputType: "skill.result",
              structuredResult: {
                verdict: verifyResult.riskFlags.length === 0 ? "pass" : "needs_review",
                evidenceCoverage: verifyResult.evidenceRefs.length > 0 ? 0.8 : 0.2,
                artifactId,
                blockId
              },
              confidence: verifyResult.confidence,
              requiredConfirmations: verifyResult.requiredConfirmations,
              evidenceRefs: verifyResult.evidenceRefs,
              riskFlags: verifyResult.riskFlags,
              nextActions: verifyResult.nextActions,
              costEstimate: verifyResult.costEstimate
            };
          } catch {
            return {
              outputType: "skill.result",
              structuredResult: { verdict: "needs_review", evidenceCoverage: 0, artifactId, blockId },
              confidence: 0.3,
              requiredConfirmations: ["manual_verification"],
              evidenceRefs: [],
              riskFlags: ["verification_failed"],
              nextActions: ["manual_review"],
              costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
            };
          }
        }

        case "skill_memory_reflect": {
          const project = await store.getProject(projectId);
          const capsule = {
            status: "completed",
            projectId,
            capsuleType: "general",
            title: `Knowledge from project: ${project?.title ?? projectId}`,
            summary: `Reusable workflow pattern extracted from project with ${project?.sources.length ?? 0} sources`,
            responsibilityColor: "yellow" as const
          };
          await store.addCapsule(projectId, {
            title: capsule.title,
            summary: capsule.summary,
            capsuleType: "general"
          });
          return {
            outputType: "skill.result",
            structuredResult: capsule,
            confidence: 0.6,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["review_capsule"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_ppt_generate": {
          const aId = (input.artifactId as string) ?? "";
          const result = await pipeline.exportPptx({
            title: `Export-${aId}`,
            brandTheme: "academic_navy",
            slides: [{
              title: "Generated Slide",
              layoutType: "content",
              contentBlocks: [{ type: "text", text: "Auto-generated content", responsibilityColor: "gray" }],
              evidenceRefs: []
            }]
          });
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed",
              fileName: result.fileName,
              mimeType: result.mimeType,
              sizeBytes: result.buffer.length,
              responsibilitySummary: result.responsibilitySummary
            },
            confidence: 0.8,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["download_file"],
            costEstimate: { provider: "local", model: "pptx-renderer", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_docx_generate": {
          const aId2 = (input.artifactId as string) ?? "";
          const result = await pipeline.exportDocx({
            title: `Export-${aId2}`,
            sections: [
              { type: "heading", text: "Generated Document", level: 1, responsibilityColor: "gray", evidenceRefs: [] },
              { type: "paragraph", text: "Auto-generated content", responsibilityColor: "gray", evidenceRefs: [] }
            ]
          });
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed",
              fileName: result.fileName,
              mimeType: result.mimeType,
              sizeBytes: result.buffer.length,
              responsibilitySummary: result.responsibilitySummary
            },
            confidence: 0.8,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["download_file"],
            costEstimate: { provider: "local", model: "docx-renderer", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_task_breakdown": {
          const taskTitle = (input.taskTitle as string) ?? "";
          if (typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function") {
            try {
              const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
                messages: [{ role: "user", content: `请将以下任务拆解为子任务：${taskTitle}` }],
                systemPrompt: "你是知序AI的任务拆解Agent。请将复杂任务拆解为结构化子任务，包含标题、优先级和风险等级。以JSON数组格式输出。"
              });
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", taskTitle, subTasks: (llmResult.response as Record<string, unknown>)?.content, responsibilityColor: "gray" },
                confidence: 0.7,
                requiredConfirmations: [],
                evidenceRefs: [],
                riskFlags: [],
                nextActions: ["review_subtasks"],
                costEstimate: { provider: "dashscope", model: "qwen", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", taskTitle, subTasks: [{ title: `${taskTitle} - 子任务1`, priority: 1 }], responsibilityColor: "gray" },
            confidence: 0.5,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["review_subtasks"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_literature_search":
        case "skill_web_research":
        case "skill_github_repo": {
          const query = (input.query as string) ?? (input.repoUrl as string) ?? "";
          if (typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function") {
            try {
              const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
                messages: [{ role: "user", content: `请搜索以下内容的相关信息：${query}` }],
                systemPrompt: "你是知序AI的搜索Agent。请基于已有知识提供相关搜索结果摘要。"
              });
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", query, results: (llmResult.response as Record<string, unknown>)?.content, responsibilityColor: "yellow" },
                confidence: 0.6,
                requiredConfirmations: ["verify_sources"],
                evidenceRefs: [],
                riskFlags: ["ai_inferred_content"],
                nextActions: ["verify_results"],
                costEstimate: { provider: "dashscope", model: "qwen", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", query, results: [], responsibilityColor: "yellow" },
            confidence: 0.3,
            requiredConfirmations: ["verify_sources"],
            evidenceRefs: [],
            riskFlags: ["no_external_api_connected"],
            nextActions: ["configure_external_api"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_translation": {
          const text = (input.text as string) ?? "";
          const targetLang = (input.targetLang as string) ?? "en";
          if (typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function") {
            try {
              const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
                messages: [{ role: "user", content: `请将以下内容翻译为${targetLang}：${text}` }],
                systemPrompt: "你是知序AI的翻译Agent。请提供准确的学术翻译。"
              });
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", translated: (llmResult.response as Record<string, unknown>)?.content, responsibilityColor: "yellow" },
                confidence: 0.8,
                requiredConfirmations: [],
                evidenceRefs: [],
                riskFlags: [],
                nextActions: ["review_translation"],
                costEstimate: { provider: "dashscope", model: "qwen", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", translated: `[Translation placeholder] ${text}`, responsibilityColor: "gray" },
            confidence: 0.3,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: ["no_llm_available"],
            nextActions: ["configure_llm"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_mentor_feedback": {
          const rawContent = (input.rawContent as string) ?? "";
          const actionItems = rawContent.split(/[。.!\n]/).filter((s: string) => s.trim().length > 0).map((s: string, i: number) => ({
            id: `action-${i + 1}`,
            content: s.trim(),
            status: "pending",
            entityType: null as string | null,
            entityId: null as string | null
          }));
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", actionItems, responsibilityColor: "green" },
            confidence: 0.7,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["bind_action_items"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        default: {
          const hasLLM = typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function";
          if (hasLLM) {
            try {
              const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
                messages: [{ role: "user", content: `请执行技能 ${manifest.name}，输入参数：${JSON.stringify(input)}` }],
                systemPrompt: `你是知序AI的技能执行Agent。当前技能：${manifest.name}（${manifest.description}）。请根据输入参数生成结构化输出。`
              });
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", skillId: manifest.id, output: (llmResult.response as Record<string, unknown>)?.content, responsibilityColor: "gray" },
                confidence: 0.6,
                requiredConfirmations: [],
                evidenceRefs: [],
                riskFlags: [],
                nextActions: ["review_output"],
                costEstimate: { provider: "dashscope", model: "qwen", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", skillId: manifest.id, input, responsibilityColor: "gray" },
            confidence: 0.4,
            requiredConfirmations: [],
            evidenceRefs: [],
            riskFlags: [],
            nextActions: ["review_output"],
            costEstimate: { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }
      }
    });
  }
}
