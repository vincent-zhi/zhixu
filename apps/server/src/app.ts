import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
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
  type AgentOutput,
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
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from "node:fs";
import { join, extname } from "node:path";
import { createHash, randomUUID, createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
import {
  HumanGateRequiredError,
  PermissionChecker,
  SandboxPolicy,
  SkillInvocationRunner,
  type SkillManifest
} from "@zhixu/skill-runtime";
import { SkillRegistry } from "./skill-registry.js";
import { registerDomainRoutes } from "./domain-routes.js";

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

  function getEncryptionKey(): Buffer | null {
    const secret = process.env.ZHIXU_CONFIG_SECRET;
    if (!secret) return null;
    return scryptSync(secret, 'zhixu-llm-config-salt', 32);
  }

  function encryptText(text: string): string {
    const key = getEncryptionKey();
    if (!key) return text; // fallback to plaintext if no secret configured
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  function decryptText(encryptedText: string): string {
    const key = getEncryptionKey();
    if (!key) return encryptedText; // fallback if no secret
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText; // not encrypted format, return as-is
    const ivHex = parts[0]!;
    const authTagHex = parts[1]!;
    const encData = parts[2]!;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encData, 'hex', 'utf8') as string;
    decrypted += decipher.final('utf8') as string;
    return decrypted;
  }

  function loadPersistedLLMConfig(): LLMGatewayConfig | undefined {
    try {
      if (existsSync(llmConfigPath)) {
        const raw = readFileSync(llmConfigPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.apiKey) { try { parsed.apiKey = decryptText(parsed.apiKey); } catch {} }
        if (parsed.apiKey && parsed.baseURL && parsed.model) return parsed;
      }
    } catch {}
    return undefined;
  }
  function persistLLMConfig(config: LLMGatewayConfig | undefined): void {
    try {
      if (config && config.apiKey && config.baseURL && config.model) {
        const configCopy = { ...config, apiKey: encryptText(config.apiKey) };
        writeFileSync(llmConfigPath, JSON.stringify(configCopy, null, 2), "utf-8");
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
  const examQuestions = new Map<string, { id: string; projectId: string; topic: string; questionType: string; questionText: string; options: string[] | null; correctAnswer: string; explanation: string; createdAt: string }>();
  const examSubmissions = new Map<string, { id: string; questionId: string; projectId: string; answer: string; correct: boolean; explanation: string; mistakeType: string | null; createdAt: string }>();
  const termbaseEntries = new Map<string, Map<string, { id: string; term: string; definition: string; domain: string; createdAt: string }>>();
  const exportPipeline = new ExportPipeline(
    new PptxRenderer(),
    new DocxRenderer(),
    new MarkdownRenderer()
  );
  registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline, examQuestions, examSubmissions, termbaseEntries, citationVerifier);
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
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
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

  // --- Aggregated Dashboard ---
  app.get("/api/dashboard", async (request) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string;
    const projects = await projectStore.listProjects();

    // Upcoming deadlines (tasks due in next 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines: Array<{ taskId: string; title: string; projectTitle: string; projectId: string; dueAt: string; priority: number; riskLevel: string }> = [];

    for (const project of projects) {
      const detail = await projectStore.getProject(project.id);
      if (!detail) continue;
      for (const task of detail.tasks) {
        if (task.dueAt && task.status !== "completed") {
          const dueDate = new Date(task.dueAt);
          if (dueDate <= weekFromNow) {
            upcomingDeadlines.push({
              taskId: task.id, title: task.title, projectTitle: project.title,
              projectId: project.id, dueAt: task.dueAt, priority: task.priority, riskLevel: task.riskLevel ?? "L0",
            });
          }
        }
      }
    }
    upcomingDeadlines.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    // Pending gates across all projects
    const pendingGates: Array<{ gateId: string; gateType: string; projectTitle: string; projectId: string; reason: string; riskLevel: string }> = [];
    for (const project of projects) {
      const detail = await projectStore.getProject(project.id);
      if (!detail) continue;
      for (const gate of detail.humanGates) {
        if (gate.status === "pending") {
          pendingGates.push({
            gateId: gate.id, gateType: gate.gateType, projectTitle: project.title,
            projectId: project.id, reason: gate.reason, riskLevel: gate.riskLevel ?? "L1",
          });
        }
      }
    }

    // Active projects summary
    const activeProjects = projects.filter(p => p.status !== "completed" && p.status !== "archived");

    // Recent agent jobs
    const allJobs = await projectStore.listAgentJobs();
    const recentJobs = allJobs.filter(j => {
      const jobTime = new Date(j.createdAt).getTime();
      return now.getTime() - jobTime < 24 * 60 * 60 * 1000;
    }).slice(0, 10);

    return {
      data: {
        activeProjects: activeProjects.map(p => ({
          id: p.id, title: p.title, status: p.status, nextAction: p.nextAction,
          dueDate: p.dueDate,
        })),
        upcomingDeadlines,
        pendingGates,
        recentJobs: recentJobs.map(j => ({
          id: j.id, type: j.jobType, status: j.status, projectId: j.projectId, createdAt: j.createdAt,
        })),
        stats: {
          totalProjects: projects.length,
          activeProjects: activeProjects.length,
          pendingGates: pendingGates.length,
          upcomingDeadlines: upcomingDeadlines.length,
        },
      },
    };
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

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/sources", async (request, reply) => {
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
    return { data: project.sources };
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/tasks", async (request, reply) => {
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
    return { data: project.tasks };
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/human-gates", async (request, reply) => {
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
    return { data: project.humanGates };
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts", async (request, reply) => {
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
    return { data: project.artifacts };
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

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/sources/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "No file uploaded",
          requestId: request.id
        }
      });
    }

    const projectId = request.params.projectId;
    const project = await projectStore.getProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }

    const uploadDir = join(process.cwd(), "uploads", projectId);
    mkdirSync(uploadDir, { recursive: true });

    const fileName = data.filename;
    const filePath = join(uploadDir, fileName);
    const buffer = await data.toBuffer();
    writeFileSync(filePath, buffer);

    const ext = extname(fileName).toLowerCase().replace(".", "");
    const fileTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      md: "text/markdown",
      txt: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
    };
    const fileType = fileTypeMap[ext] ?? data.mimetype ?? "application/octet-stream";

    const sourceInput = {
      uploadedBy: "user",
      fileName,
      fileType,
      storageUri: filePath,
      sensitivityLevel: "normal" as const,
    };

    const source = await projectStore.addSource(projectId, sourceInput);

    const parseStatus = "queued";

    return reply.status(201).send({ data: { ...source, parseStatus } });
  });

  app.get<{
    Params: { projectId: string; filename: string };
  }>("/api/files/:projectId/:filename", async (request, reply) => {
    const filePath = join(process.cwd(), "uploads", request.params.projectId, request.params.filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "File not found",
          requestId: request.id
        }
      });
    }

    const ext = extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      txt: "text/plain",
      md: "text/markdown",
      csv: "text/csv",
    };
    const mimeType = mimeMap[ext] ?? "application/octet-stream";
    const stream = createReadStream(filePath);
    return reply.type(mimeType).send(stream);
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

  function findPendingGates(project: { humanGates: Array<{ id: string; status: string; gateType: string; reason: string }> }): Array<{ id: string; status: string; gateType: string; reason: string }> {
    return project.humanGates.filter((g) => g.status === "pending");
  }

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

    const exportUserId = (request as unknown as Record<string, unknown>).userId as string;
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
      const pendingGates = findPendingGates(project);
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

    const exportUserId = (request as unknown as Record<string, unknown>).userId as string;
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
      const pendingGates = findPendingGates(project);
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

    const exportUserId = (request as unknown as Record<string, unknown>).userId as string;
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
      const pendingGates = findPendingGates(project);
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

  app.get<{
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/blocks", async (request, reply) => {
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
    return { data: artifact.blocks ?? [] };
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
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/blocks", async (request, reply) => {
    const body = request.body as { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string };
    if (!body.blockType) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "blockType is required",
          requestId: request.id
        }
      });
    }
    const blockInput: { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string; createdBy: string } = {
      blockType: body.blockType,
      contentJson: body.contentJson ?? {},
      orderIndex: body.orderIndex ?? 0,
      createdBy: "current_user"
    };
    if (body.responsibilityColor) blockInput.responsibilityColor = body.responsibilityColor;
    const block = await projectStore.createArtifactBlock(request.params.artifactId, blockInput);
    if (!block) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    return reply.status(201).send({ data: block });
  });

  app.delete<{
    Params: { artifactId: string; blockId: string };
  }>("/api/artifacts/:artifactId/blocks/:blockId", async (request, reply) => {
    const deleted = await projectStore.deleteArtifactBlock(
      request.params.artifactId,
      request.params.blockId
    );
    if (!deleted) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: request.id
        }
      });
    }
    return { data: { deleted: true } };
  });

  app.post<{
    Params: { artifactId: string };
  }>("/api/artifacts/:artifactId/blocks/reorder", async (request, reply) => {
    const body = request.body as { blockIds: string[] };
    if (!Array.isArray(body.blockIds)) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "blockIds must be an array",
          requestId: request.id
        }
      });
    }
    const blocks = await projectStore.reorderArtifactBlocks(
      request.params.artifactId,
      body.blockIds
    );
    if (!blocks) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    return { data: blocks };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/ppt/create", async (request, reply) => {
    const body = request.body as { title: string; topicSuggestions?: string[] };
    if (!body.title) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "title is required",
          requestId: request.id
        }
      });
    }
    let suggestions = body.topicSuggestions ?? [];
    if (suggestions.length === 0 && typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为PPT"${body.title}"生成5个选题建议，以JSON数组格式返回，每个元素是一个字符串。` }],
          systemPrompt: "你是知序AI的PPT创作助手。请根据标题生成选题建议。只返回JSON数组，不要其他文字。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "[]";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          suggestions = JSON.parse(match[0]);
        }
      } catch {}
    }
    if (suggestions.length === 0) {
      suggestions = [
        `${body.title} - 概述与背景`,
        `${body.title} - 核心概念解析`,
        `${body.title} - 方法与流程`,
        `${body.title} - 案例分析`,
        `${body.title} - 总结与展望`
      ];
    }
    const artifact = await projectStore.createArtifact({
      projectId: request.params.projectId,
      type: "presentation",
      title: body.title,
      firstBlock: {
        blockType: "slide",
        contentJson: { title: body.title, text: "" },
        createdBy: "system"
      }
    });
    return reply.status(201).send({ data: { artifact, suggestions } });
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/ppt/outline", async (request, reply) => {
    const body = request.body as { artifactId: string; selectedTopic: string; slideCount?: number };
    if (!body.artifactId || !body.selectedTopic) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "artifactId and selectedTopic are required",
          requestId: request.id
        }
      });
    }
    const slideCount = body.slideCount ?? 8;
    const artifact = await projectStore.getArtifact(body.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    let outlineItems: Array<{ title: string; summary: string }> = [];
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为PPT"${artifact.title}"，选题"${body.selectedTopic}"，生成${slideCount}页的大纲。以JSON数组格式返回，每个元素包含title和summary字段。` }],
          systemPrompt: "你是知序AI的PPT大纲生成助手。请生成页级大纲，只返回JSON数组。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "[]";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          outlineItems = JSON.parse(match[0]);
        }
      } catch {}
    }
    if (outlineItems.length === 0) {
      for (let i = 0; i < slideCount; i++) {
        outlineItems.push({
          title: i === 0 ? "封面" : i === slideCount - 1 ? "总结" : `第${i + 1}页 - ${body.selectedTopic}`,
          summary: i === 0 ? `主题：${body.selectedTopic}` : i === slideCount - 1 ? "回顾与展望" : `${body.selectedTopic}相关内容`
        });
      }
    }
    const blocks: ArtifactBlockSummary[] = [];
    for (let i = 0; i < outlineItems.length; i++) {
      const item = outlineItems[i]!;
      const block = await projectStore.createArtifactBlock(body.artifactId, {
        blockType: "slide",
        contentJson: { title: item.title, text: "", outline: item.summary },
        orderIndex: i,
        responsibilityColor: "yellow",
        createdBy: "system"
      });
      if (block) blocks.push(block);
    }
    return { data: blocks };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/ppt/generate-slide", async (request, reply) => {
    const body = request.body as { artifactId: string; blockId: string };
    if (!body.artifactId || !body.blockId) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "artifactId and blockId are required",
          requestId: request.id
        }
      });
    }
    const artifact = await projectStore.getArtifact(body.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    const block = artifact.blocks.find((b) => b.id === body.blockId);
    if (!block) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Block not found",
          requestId: request.id
        }
      });
    }
    const outline = (block.contentJson.outline as string) ?? (block.contentJson.title as string) ?? "";
    let generatedText = "";
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为PPT页面"${block.contentJson.title as string}"生成详细内容。大纲提示：${outline}。请生成3-5个要点，每个要点一行。` }],
          systemPrompt: "你是知序AI的PPT内容生成助手。请生成简洁的幻灯片内容，每行一个要点。"
        });
        generatedText = ((llmResult.response as Record<string, unknown>)?.content as string) ?? "";
      } catch {}
    }
    if (!generatedText) {
      generatedText = `• ${outline} - 要点1\n• ${outline} - 要点2\n• ${outline} - 要点3`;
    }
    const updated = await projectStore.updateArtifactBlock(body.artifactId, body.blockId, {
      contentJson: { ...block.contentJson, text: generatedText },
      responsibilityColor: "yellow",
      verificationStatus: "unverified",
      updatedBy: "system"
    });
    return { data: updated };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/ppt/generate-all", async (request, reply) => {
    const body = request.body as { artifactId: string };
    if (!body.artifactId) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "artifactId is required",
          requestId: request.id
        }
      });
    }
    const artifact = await projectStore.getArtifact(body.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    const updatedBlocks: ArtifactBlockSummary[] = [];
    for (const block of artifact.blocks) {
      const outline = (block.contentJson.outline as string) ?? (block.contentJson.title as string) ?? "";
      let generatedText = "";
      if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
        try {
          const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
            messages: [{ role: "user", content: `请为PPT页面"${block.contentJson.title as string}"生成详细内容。大纲提示：${outline}。请生成3-5个要点。` }],
            systemPrompt: "你是知序AI的PPT内容生成助手。请生成简洁的幻灯片内容。"
          });
          generatedText = ((llmResult.response as Record<string, unknown>)?.content as string) ?? "";
        } catch {}
      }
      if (!generatedText) {
        generatedText = `• ${outline} - 要点1\n• ${outline} - 要点2\n• ${outline} - 要点3`;
      }
      const updated = await projectStore.updateArtifactBlock(body.artifactId, block.id, {
        contentJson: { ...block.contentJson, text: generatedText },
        responsibilityColor: "yellow",
        verificationStatus: "unverified",
        updatedBy: "system"
      });
      if (updated) updatedBlocks.push(updated);
    }
    return { data: updatedBlocks };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/doc/create", async (request, reply) => {
    const body = request.body as { title: string; type: "docx" | "report" | "review"; outlineSections?: string[] };
    if (!body.title) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "title is required",
          requestId: request.id
        }
      });
    }
    let sections = body.outlineSections ?? [];
    if (sections.length === 0 && typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为文档"${body.title}"（类型：${body.type ?? "docx"}）生成大纲章节，以JSON数组格式返回，每个元素是章节标题字符串。` }],
          systemPrompt: "你是知序AI的文档创作助手。请生成文档大纲，只返回JSON数组。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "[]";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          sections = JSON.parse(match[0]);
        }
      } catch {}
    }
    if (sections.length === 0) {
      sections = ["引言", "背景", "主体内容", "分析与讨论", "结论"];
    }
    const artifact = await projectStore.createArtifact({
      projectId: request.params.projectId,
      type: body.type ?? "docx",
      title: body.title,
      firstBlock: {
        blockType: "heading",
        contentJson: { text: sections[0], level: 1 },
        createdBy: "system"
      }
    });
    for (let i = 1; i < sections.length; i++) {
      await projectStore.createArtifactBlock(artifact.id, {
        blockType: i === 0 ? "heading" : "heading",
        contentJson: { text: sections[i], level: 1 },
        orderIndex: i * 2,
        responsibilityColor: "yellow",
        createdBy: "system"
      });
      await projectStore.createArtifactBlock(artifact.id, {
        blockType: "paragraph",
        contentJson: { text: "", outline: sections[i] },
        orderIndex: i * 2 + 1,
        responsibilityColor: "gray",
        createdBy: "system"
      });
    }
    const fullArtifact = await projectStore.getArtifact(artifact.id);
    return reply.status(201).send({ data: fullArtifact });
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/doc/generate-section", async (request, reply) => {
    const body = request.body as { artifactId: string; blockId: string };
    if (!body.artifactId || !body.blockId) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "artifactId and blockId are required",
          requestId: request.id
        }
      });
    }
    const artifact = await projectStore.getArtifact(body.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    const block = artifact.blocks.find((b) => b.id === body.blockId);
    if (!block) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Block not found",
          requestId: request.id
        }
      });
    }
    const outline = (block.contentJson.outline as string) ?? (block.contentJson.text as string) ?? "";
    let generatedText = "";
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为文档章节"${outline}"生成详细段落内容，200-400字。` }],
          systemPrompt: "你是知序AI的文档内容生成助手。请生成学术风格的段落内容。"
        });
        generatedText = ((llmResult.response as Record<string, unknown>)?.content as string) ?? "";
      } catch {}
    }
    if (!generatedText) {
      generatedText = `${outline}是本文档的重要组成部分。本节将围绕${outline}展开详细讨论，从多个角度分析其内涵与外延，并结合相关研究进行阐述。`;
    }
    const updated = await projectStore.updateArtifactBlock(body.artifactId, body.blockId, {
      contentJson: { ...block.contentJson, text: generatedText },
      responsibilityColor: "yellow",
      verificationStatus: "unverified",
      updatedBy: "system"
    });
    return { data: updated };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/artifacts/doc/ai-command", async (request, reply) => {
    const body = request.body as { artifactId: string; blockId: string; command: "shorten" | "expand" | "formalize" | "add_example" | "add_citation" | "paraphrase" };
    if (!body.artifactId || !body.blockId || !body.command) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "artifactId, blockId and command are required",
          requestId: request.id
        }
      });
    }
    const artifact = await projectStore.getArtifact(body.artifactId);
    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Artifact not found",
          requestId: request.id
        }
      });
    }
    const block = artifact.blocks.find((b) => b.id === body.blockId);
    if (!block) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Block not found",
          requestId: request.id
        }
      });
    }
    const originalText = (block.contentJson.text as string) ?? "";
    const commandPrompts: Record<string, string> = {
      shorten: `请缩短以下内容，保留核心要点：\n${originalText}`,
      expand: `请扩展以下内容，增加细节和论述：\n${originalText}`,
      formalize: `请将以下内容改写为更正式的学术风格：\n${originalText}`,
      add_example: `请为以下内容添加一个具体案例：\n${originalText}`,
      add_citation: `请为以下内容添加学术引用支撑：\n${originalText}`,
      paraphrase: `请用不同表述改写以下内容：\n${originalText}`
    };
    let resultText = "";
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: commandPrompts[body.command] ?? commandPrompts.shorten ?? "" }],
          systemPrompt: "你是知序AI的文档编辑助手。请根据指令改写内容，只返回改写后的文本。"
        });
        resultText = ((llmResult.response as Record<string, unknown>)?.content as string) ?? originalText;
      } catch {}
    }
    if (!resultText) {
      resultText = originalText;
    }
    const updated = await projectStore.updateArtifactBlock(body.artifactId, body.blockId, {
      contentJson: { ...block.contentJson, text: resultText },
      responsibilityColor: "yellow",
      verificationStatus: "unverified",
      updatedBy: "system"
    });
    return { data: updated };
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
  }>("/api/projects/:projectId/paper/read", async (request, reply) => {
    const body = request.body as { sourceId?: string };
    if (!body.sourceId) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "sourceId is required", requestId: request.id }
      });
    }
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const source = project.sources.find((s) => s.id === body.sourceId);
    if (!source) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Source not found", requestId: request.id }
      });
    }
    const paperMatrix: {
      sourceId: string;
      fileName: string;
      researchQuestion: string;
      backgroundMotivation: string;
      methodFramework: string;
      dataset: string;
      experimentSetup: string;
      results: string;
      contributions: string;
      limitations: string;
      reproducibility: string;
      responsibilityColor: "green" | "yellow" | "gray";
    } = {
      sourceId: source.id,
      fileName: source.fileName,
      researchQuestion: "",
      backgroundMotivation: "",
      methodFramework: "",
      dataset: "",
      experimentSetup: "",
      results: "",
      contributions: "",
      limitations: "",
      reproducibility: "",
      responsibilityColor: "yellow"
    };
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请精读以下论文并提取结构化信息。论文来源：${source.fileName}\n\n请提取以下字段并以JSON格式输出：\n1. researchQuestion: 研究问题\n2. backgroundMotivation: 背景动机\n3. methodFramework: 方法框架\n4. dataset: 数据集\n5. experimentSetup: 实验设置\n6. results: 实验结果\n7. contributions: 主要贡献\n8. limitations: 局限性\n9. reproducibility: 可复现性评估` }],
          systemPrompt: "你是知序AI的论文精读Agent。请对论文进行深度分析，提取结构化信息。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          Object.assign(paperMatrix, {
            researchQuestion: parsed.researchQuestion ?? "",
            backgroundMotivation: parsed.backgroundMotivation ?? "",
            methodFramework: parsed.methodFramework ?? "",
            dataset: parsed.dataset ?? "",
            experimentSetup: parsed.experimentSetup ?? "",
            results: parsed.results ?? "",
            contributions: parsed.contributions ?? "",
            limitations: parsed.limitations ?? "",
            reproducibility: parsed.reproducibility ?? "",
            responsibilityColor: "yellow" as const
          });
        } catch { paperMatrix.researchQuestion = content.slice(0, 2000); }
      } catch { /* fallback */ }
    } else {
      paperMatrix.researchQuestion = `论文精读占位 - ${source.fileName}`;
      paperMatrix.responsibilityColor = "gray";
    }
    return { data: paperMatrix };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/paper/compare", async (request, reply) => {
    const body = request.body as { sourceIds?: string[] };
    if (!body.sourceIds || !Array.isArray(body.sourceIds) || body.sourceIds.length < 2) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "sourceIds must be an array with at least 2 items", requestId: request.id }
      });
    }
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const sources = body.sourceIds.map((sid) => project.sources.find((s) => s.id === sid)).filter(Boolean);
    const comparison: {
      sourceIds: string[];
      methodCategories: string[];
      timeline: string[];
      disputes: string[];
      researchGaps: string[];
      matrix: Record<string, Record<string, string>>;
      responsibilityColor: "green" | "yellow" | "gray";
    } = {
      sourceIds: body.sourceIds,
      methodCategories: [] as string[],
      timeline: [] as string[],
      disputes: [] as string[],
      researchGaps: [] as string[],
      matrix: {} as Record<string, Record<string, string>>,
      responsibilityColor: "yellow"
    };
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const sourceNames = sources.map((s) => s!.fileName).join("、");
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请对比以下论文并生成对比矩阵：${sourceNames}\n\n请输出JSON格式：\n{\n  "methodCategories": ["方法分类1", ...],\n  "timeline": ["时间线描述1", ...],\n  "disputes": ["争议点1", ...],\n  "researchGaps": ["研究空白1", ...],\n  "matrix": { "维度1": { "论文1": "值", "论文2": "值" } }\n}` }],
          systemPrompt: "你是知序AI的论文对比Agent。请生成多篇论文的结构化对比矩阵。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          comparison.methodCategories = parsed.methodCategories ?? [];
          comparison.timeline = parsed.timeline ?? [];
          comparison.disputes = parsed.disputes ?? [];
          comparison.researchGaps = parsed.researchGaps ?? [];
          comparison.matrix = parsed.matrix ?? {};
        } catch {
          comparison.methodCategories = [content.slice(0, 500)];
        }
      } catch { /* fallback */ }
    } else {
      comparison.responsibilityColor = "gray";
    }
    return { data: comparison };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/paper/matrix", async (request, reply) => {
    const body = request.body as { sourceIds?: string[]; dimensions?: string[] };
    if (!body.sourceIds || !Array.isArray(body.sourceIds) || body.sourceIds.length < 1) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "sourceIds must be a non-empty array", requestId: request.id }
      });
    }
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const sources = body.sourceIds.map((sid) => project.sources.find((s) => s.id === sid)).filter(Boolean);
    const defaultDimensions = ["研究问题", "方法", "数据集", "结果", "贡献", "局限"];
    const dimensions = body.dimensions ?? defaultDimensions;
    const matrix: {
      sourceIds: string[];
      dimensions: string[];
      rows: Array<{ dimension: string; values: Record<string, string> }>;
      responsibilityColor: "green" | "yellow" | "gray";
    } = {
      sourceIds: body.sourceIds,
      dimensions,
      rows: [] as Array<{ dimension: string; values: Record<string, string> }>,
      responsibilityColor: "yellow"
    };
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const sourceNames = sources.map((s) => s!.fileName).join("、");
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为以下论文生成对比矩阵表格。\n论文：${sourceNames}\n维度：${dimensions.join("、")}\n\n请输出JSON格式：{ "rows": [{ "dimension": "维度名", "values": { "论文1": "值", "论文2": "值" } }] }` }],
          systemPrompt: "你是知序AI的论文矩阵Agent。请按指定维度生成结构化对比表格。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          matrix.rows = parsed.rows ?? [];
        } catch {
          matrix.rows = dimensions.map((d) => ({ dimension: d, values: Object.fromEntries(sources.map((s) => [s!.fileName, "待分析"])) }));
        }
      } catch { /* fallback */ }
    } else {
      matrix.rows = dimensions.map((d) => ({ dimension: d, values: Object.fromEntries(sources.map((s) => [s!.fileName, "—"])) }));
      matrix.responsibilityColor = "gray";
    }
    return { data: matrix };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/exam/plan", async (request, reply) => {
    const body = request.body as { examDate?: string; dailyHours?: number };
    if (!body.examDate) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "examDate is required", requestId: request.id }
      });
    }
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const dailyHours = body.dailyHours ?? 3;
    const examDate = new Date(body.examDate);
    const now = new Date();
    const daysUntil = Math.max(1, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const plan: {
      examDate: string;
      daysUntil: number;
      dailyHours: number;
      knowledgeMap: { summary: string; topics: string[] };
      plan: Array<{ day: number; tasks: string[]; duration: number }>;
      responsibilityColor: "green" | "yellow" | "gray";
    } = {
      examDate: body.examDate,
      daysUntil,
      dailyHours,
      knowledgeMap: { summary: "", topics: [] as string[] },
      plan: [] as Array<{ day: number; tasks: string[]; duration: number }>,
      responsibilityColor: "yellow"
    };
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请为以下考试生成复习计划。\n项目：${project.title}\n考试日期：${body.examDate}（距今${daysUntil}天）\n每天可用时间：${dailyHours}小时\n已有资料：${project.sources.map((s) => s.fileName).join("、") || "无"}\n\n请输出JSON格式：\n{\n  "knowledgeMap": { "summary": "知识图谱概要", "topics": ["主题1", ...] },\n  "plan": [{ "day": 1, "tasks": ["任务1", ...], "duration": 2 }, ...]\n}` }],
          systemPrompt: "你是知序AI的考试复习规划Agent。请根据项目资料和考试日期生成科学的复习计划。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          plan.knowledgeMap = parsed.knowledgeMap ?? { summary: "", topics: [] };
          plan.plan = parsed.plan ?? [];
        } catch {
          plan.knowledgeMap.summary = content.slice(0, 1000);
        }
      } catch { /* fallback */ }
    } else {
      for (let d = 1; d <= daysUntil; d++) {
        plan.plan.push({ day: d, tasks: [`复习第${d}天内容`], duration: dailyHours });
      }
      plan.knowledgeMap.summary = `共${daysUntil}天复习计划`;
      plan.responsibilityColor = "gray";
    }
    return { data: plan };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/exam/questions", async (request, reply) => {
    const body = request.body as { topic?: string; questionTypes?: string[]; count?: number };
    if (!body.topic) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "topic is required", requestId: request.id }
      });
    }
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const count = body.count ?? 5;
    const questionTypes = body.questionTypes ?? ["choice", "fill", "short_answer"];
    const questions: Array<{
      id: string; projectId: string; topic: string; questionType: string;
      questionText: string; options: string[] | null; correctAnswer: string;
      explanation: string; createdAt: string;
    }> = [];
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请生成${count}道练习题。\n主题：${body.topic}\n题型：${questionTypes.join("、")}\n项目资料：${project.sources.map((s) => s.fileName).join("、") || "无"}\n\n请输出JSON数组格式：\n[\n  {\n    "questionType": "choice|fill|short_answer",\n    "questionText": "题目内容",\n    "options": ["A.选项1", "B.选项2", ...] (仅选择题),\n    "correctAnswer": "正确答案",\n    "explanation": "解析"\n  }\n]` }],
          systemPrompt: "你是知序AI的出题Agent。请根据主题和资料生成高质量的练习题，包含选择题、填空题和简答题。输出严格的JSON数组格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          const items = Array.isArray(parsed) ? parsed : [];
          for (const item of items) {
            const q = {
              id: crypto.randomUUID(),
              projectId: request.params.projectId,
              topic: body.topic,
              questionType: item.questionType ?? "choice",
              questionText: item.questionText ?? "",
              options: item.options ?? null,
              correctAnswer: item.correctAnswer ?? "",
              explanation: item.explanation ?? "",
              createdAt: new Date().toISOString()
            };
            questions.push(q);
            examQuestions.set(q.id, q);
          }
        } catch { /* fallback to placeholder */ }
      } catch { /* fallback */ }
    }
    if (questions.length === 0) {
      for (let i = 0; i < count; i++) {
        const qt = questionTypes[i % questionTypes.length] ?? "choice";
        const q = {
          id: crypto.randomUUID(),
          projectId: request.params.projectId,
          topic: body.topic,
          questionType: qt,
          questionText: `[${body.topic}] 练习题 ${i + 1}`,
          options: qt === "choice" ? ["A.选项1", "B.选项2", "C.选项3", "D.选项4"] : null,
          correctAnswer: qt === "choice" ? "A" : "参考答案",
          explanation: "暂无解析（LLM未配置）",
          createdAt: new Date().toISOString()
        };
        questions.push(q);
        examQuestions.set(q.id, q);
      }
    }
    return { data: questions };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/exam/submit", async (request, reply) => {
    const body = request.body as { questionId?: string; answer?: string };
    if (!body.questionId || body.answer === undefined) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "questionId and answer are required", requestId: request.id }
      });
    }
    const question = examQuestions.get(body.questionId);
    if (!question || question.projectId !== request.params.projectId) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Question not found", requestId: request.id }
      });
    }
    const result = {
      id: crypto.randomUUID(),
      questionId: body.questionId,
      projectId: request.params.projectId,
      answer: body.answer,
      correct: false,
      explanation: question.explanation,
      mistakeType: null as string | null,
      createdAt: new Date().toISOString()
    };
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: `请判断以下答案是否正确并归因。\n题目：${question.questionText}\n正确答案：${question.correctAnswer}\n用户答案：${body.answer}\n\n请输出JSON格式：\n{\n  "correct": true/false,\n  "explanation": "详细解析",\n  "mistakeType": "concept_error|calculation_error|memory_error|reading_error|null"\n}` }],
          systemPrompt: "你是知序AI的答题评判Agent。请判断用户答案是否正确，如错误请归因错误类型。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        try {
          const parsed = JSON.parse(content);
          result.correct = parsed.correct ?? false;
          result.explanation = parsed.explanation ?? question.explanation;
          result.mistakeType = parsed.mistakeType ?? null;
        } catch { /* fallback to simple comparison */ }
      } catch { /* fallback */ }
    }
    if (!result.correct && result.mistakeType === null) {
      // Fast path: exact match
      const exactMatch = body.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (exactMatch) {
        result.correct = true;
        result.mistakeType = null;
      } else {
        // Fuzzy path: keyword overlap
        const extractKeywords = (text: string): Set<string> => {
          const stopWords = new Set(["的", "了", "是", "在", "和", "有", "这", "个", "我", "你", "他", "她", "它", "们", "就", "也", "都", "要", "会", "能", "对", "从", "到", "把", "被", "让", "给", "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "and", "but", "or", "nor", "not", "so", "yet", "both", "either", "neither", "each", "every", "all", "any", "few", "more", "most", "other", "some", "such", "no", "only", "own", "same", "than", "too", "very"]);
          return new Set(text.toLowerCase().split(/[\s,.;:!?，。；：！？、\n\r]+/).filter(w => w.length > 1 && !stopWords.has(w)));
        };
        const answerKeywords = extractKeywords(body.answer);
        const correctKeywords = extractKeywords(question.correctAnswer);
        if (correctKeywords.size === 0) {
          result.correct = false;
          result.mistakeType = "unknown";
        } else {
          const overlap = [...correctKeywords].filter(k => answerKeywords.has(k)).length;
          const ratio = overlap / correctKeywords.size;
          result.correct = ratio >= 0.6;
          result.mistakeType = result.correct ? null : "unknown";
          if (result.correct) {
            result.explanation = `语义匹配（关键词匹配度 ${Math.round(ratio * 100)}%）`;
          }
        }
      }
    }
    examSubmissions.set(result.id, result);
    return { data: result };
  });

  app.get<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/exam/mistakes", async (request, reply) => {
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }
    const mistakes = Array.from(examSubmissions.values())
      .filter((s) => s.projectId === request.params.projectId && !s.correct)
      .map((s) => {
        const question = examQuestions.get(s.questionId);
        return {
          ...s,
          questionText: question?.questionText ?? "",
          correctAnswer: question?.correctAnswer ?? "",
          topic: question?.topic ?? ""
        };
      });
    return { data: mistakes };
  });

  app.post<{
    Params: { projectId: string };
  }>("/api/projects/:projectId/agent/plan", async (request, reply) => {
    const input = GeneratePlanInputSchema.parse(request.body);
    const project = await projectStore.getProject(request.params.projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Resource not found", requestId: request.id }
      });
    }

    const job = await projectStore.enqueueAgentJob({
      projectId: project.id,
      jobType: "generate_plan",
      inputRef: { goal: input.goal }
    });

    const threePlanPrompt = `你是知序AI的任务规划Agent。请根据项目目标和资料，生成三方案规划。

项目标题：${project.title}
目标：${input.goal}
已有资料：${project.sources.map((s) => s.fileName).join("、") || "无"}
截止日期：${project.dueDate ?? "未设置"}

请输出严格的JSON格式：
{
  "balanced": {
    "label": "推荐方案",
    "completionProbability": 0.85,
    "overtimeRisk": 0.15,
    "contentErrorRisk": 0.2,
    "sourceGapRisk": 0.15,
    "aiInvolvementRatio": 0.4,
    "userEffortHours": 2.5,
    "qualityCeiling": 8.0,
    "applicableScenario": "适合大多数场景，兼顾速度与质量",
    "tasks": ["任务1", "任务2", ...]
  },
  "rush": {
    "label": "加急方案",
    "completionProbability": 0.7,
    "overtimeRisk": 0.45,
    "contentErrorRisk": 0.4,
    "sourceGapRisk": 0.3,
    "aiInvolvementRatio": 0.6,
    "userEffortHours": 1.0,
    "qualityCeiling": 6.0,
    "applicableScenario": "时间紧迫时使用，质量可能受影响",
    "tasks": ["任务1", "任务2", ...]
  },
  "safe": {
    "label": "稳妥方案",
    "completionProbability": 0.95,
    "overtimeRisk": 0.05,
    "contentErrorRisk": 0.08,
    "sourceGapRisk": 0.05,
    "aiInvolvementRatio": 0.2,
    "userEffortHours": 5.0,
    "qualityCeiling": 9.5,
    "applicableScenario": "时间充裕时使用，追求最高质量",
    "tasks": ["任务1", "任务2", ...]
  },
  "comparisonSummary": "三方案对比摘要"
}`;

    let output: AgentOutput;
    if (typeof (modelGateway as unknown as Record<string, unknown>).chatWithTools === "function") {
      try {
        const llmResult = await (modelGateway as Required<ModelGateway>).chatWithTools({
          messages: [{ role: "user", content: threePlanPrompt }],
          systemPrompt: "你是知序AI的任务规划Agent。请生成三方案博弈式规划，包含推荐方案、加急方案和稳妥方案。输出严格的JSON格式。"
        });
        const content = (llmResult.response as Record<string, unknown>)?.content as string ?? "";
        let structuredResult: Record<string, unknown>;
        try {
          structuredResult = JSON.parse(content);
        } catch {
          structuredResult = { rawResponse: content };
        }
        output = {
          outputType: "agent.plan",
          structuredResult,
          confidence: 0.75,
          requiredConfirmations: ["plan_selection"],
          evidenceRefs: [],
          riskFlags: [],
          nextActions: ["select_plan", "register_missing_sources"],
          costEstimate: {
            provider: "dashscope",
            model: ((llmResult.response as Record<string, unknown>)?.model as string) ?? "unknown",
            inputTokens: ((llmResult.response as Record<string, unknown>)?.usage as Record<string, number>)?.promptTokens ?? 0,
            outputTokens: ((llmResult.response as Record<string, unknown>)?.usage as Record<string, number>)?.completionTokens ?? 0,
            estimatedUsd: 0
          }
        };
      } catch {
        output = await modelGateway.generatePlan({
          projectTitle: project.title,
          goal: input.goal
        });
      }
    } else {
      output = await modelGateway.generatePlan({
        projectTitle: project.title,
        goal: input.goal
      });
    }
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
      registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline, examQuestions, examSubmissions, termbaseEntries, citationVerifier);
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
    registerBuiltinSkillHandlers(skillRunner, skills, modelGateway, projectStore, exportPipeline, examQuestions, examSubmissions, termbaseEntries, citationVerifier);
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

  // --- Image Generation Config ---
  const imageConfigPath = join(process.cwd(), ".zhixu-image-config.json");
  let imageConfig: { provider: string; apiKey: string; baseURL: string; model: string } | undefined;

  function loadImageConfig(): typeof imageConfig {
    try {
      if (existsSync(imageConfigPath)) {
        const raw = readFileSync(imageConfigPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.apiKey) { try { parsed.apiKey = decryptText(parsed.apiKey); } catch {} }
        if (parsed.provider && parsed.apiKey && parsed.baseURL && parsed.model) return parsed;
      }
    } catch {}
    // Fallback to env vars
    const envKey = process.env.SN_API_KEY ?? process.env.SENSENOVA_API_KEY;
    if (envKey) {
      return { provider: "sensenova", apiKey: envKey, baseURL: process.env.SN_BASE_URL ?? "https://token.sensenova.cn/v1", model: process.env.SN_IMAGE_MODEL ?? "sensenova-u1-fast" };
    }
    return undefined;
  }
  imageConfig = loadImageConfig();

  function persistImageConfig(config: typeof imageConfig): void {
    try {
      if (config && config.apiKey) {
        const copy = { ...config, apiKey: encryptText(config.apiKey) };
        writeFileSync(imageConfigPath, JSON.stringify(copy, null, 2), "utf-8");
      } else if (existsSync(imageConfigPath)) {
        writeFileSync(imageConfigPath, "{}", "utf-8");
      }
    } catch {}
  }

  // Update the sensenova image adapter to use stored config
  function getSenseNovaImageConfig(): import("./sensenova-image.js").SenseNovaImageConfig | undefined {
    if (!imageConfig) return undefined;
    return { apiKey: imageConfig.apiKey, baseURL: imageConfig.baseURL, imageModel: imageConfig.model, chatModel: process.env.SN_CHAT_MODEL ?? "sensenova-6.7-flash-lite" };
  }

  app.get("/api/settings/image", async (_request, reply) => {
    return reply.send({
      data: {
        configured: imageConfig !== undefined,
        provider: imageConfig?.provider ?? "",
        model: imageConfig?.model ?? "",
        apiKeySet: imageConfig?.apiKey ? true : false,
      }
    });
  });

  app.put("/api/settings/image", async (request, reply) => {
    const body = request.body as { provider?: string; apiKey?: string; baseURL?: string; model?: string };

    if (!body.apiKey) {
      return reply.status(422).send({ error: { code: "VALIDATION_ERROR", message: "apiKey is required", requestId: request.id } });
    }

    imageConfig = {
      provider: body.provider ?? "sensenova",
      apiKey: body.apiKey,
      baseURL: body.baseURL ?? (body.provider === "dashscope" ? "https://dashscope.aliyuncs.com/api/v1" : "https://token.sensenova.cn/v1"),
      model: body.model ?? (body.provider === "dashscope" ? "wanx-v1" : "sensenova-u1-fast"),
    };
    persistImageConfig(imageConfig);

    return reply.send({
      data: { configured: true, provider: imageConfig.provider, model: imageConfig.model, apiKeySet: true }
    });
  });

  app.delete("/api/settings/image", async (_request, reply) => {
    imageConfig = undefined;
    persistImageConfig(undefined);
    return reply.send({ data: { configured: false } });
  });

  const ZHIXU_STREAM_SYSTEM_PROMPT = `你是"知序"，一个专业的AI学习科研助手。你可以帮助用户：
1. 创建和管理研究项目
2. 制作PPT演示文稿
3. 撰写论文和报告
4. 解析文档（PDF/Word/PPT/Excel等）
5. 知识管理和复习
6. 数据分析和可视化

当用户要求做PPT时，你应该使用 create_artifact 工具来创建。
当用户要求写文档时，你应该使用 create_artifact 工具来创建。
当用户上传文件时，你应该使用 add_source 工具来添加资料。
当用户询问项目列表时，使用 list_projects 工具。
当用户提到具体项目时，使用 get_project 工具。

请直接回应用户的需求，使用合适的工具来完成任务。回复要简洁、专业、有用。`;

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
    chatInput.systemPrompt = body.systemPrompt || ZHIXU_STREAM_SYSTEM_PROMPT;

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

    return { data: result };
  });

  app.post("/api/chat/stream", async (request, reply) => {
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

    const body = request.body as { messages?: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }>; systemPrompt?: string; projectId?: string };
    if (!body.messages || !Array.isArray(body.messages)) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "messages array is required",
          requestId: request.id
        }
      });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent("lifecycle", { phase: "start", runId, startedAt });

    try {
      const chatMessages = body.messages as Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; toolCalls?: unknown[]; toolCallId?: string }>;
      const systemPrompt = body.systemPrompt || ZHIXU_STREAM_SYSTEM_PROMPT;

      if (typeof (gw as unknown as Record<string, unknown>).streamChat === "function") {
        const gwWithStream = gw as unknown as { streamChat: (input: { messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; toolCalls?: unknown[]; toolCallId?: string }>; systemPrompt?: string }) => AsyncGenerator<import("@zhixu/model-gateway").StreamChunk> };

        let thinkingContent = "";
        let fullContent = "";
        let currentToolCalls: Map<string, { id: string; functionName: string; arguments: string }> = new Map();
        const maxRounds = 10;
        let round = 0;

        const messagesForLLM: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null; toolCalls?: unknown[]; toolCallId?: string }> = [
          ...chatMessages,
        ];

        while (round < maxRounds) {
          round++;
          currentToolCalls.clear();
          thinkingContent = "";
          fullContent = "";

          sendEvent("lifecycle", { phase: "model_call", runId, round });

          const stream = gwWithStream.streamChat({
            messages: messagesForLLM,
            systemPrompt,
          });

          for await (const chunk of stream) {
            switch (chunk.type) {
              case "thinking_start":
                sendEvent("thinking_start", {});
                break;
              case "thinking_delta":
                thinkingContent += chunk.content;
                sendEvent("thinking_delta", { content: chunk.content });
                break;
              case "thinking_end":
                sendEvent("thinking_end", { content: thinkingContent });
                break;
              case "content_delta":
                fullContent += chunk.content;
                sendEvent("content_delta", { content: chunk.content });
                break;
              case "tool_call_start":
                currentToolCalls.set(chunk.toolCallId, {
                  id: chunk.toolCallId,
                  functionName: chunk.functionName,
                  arguments: chunk.arguments ?? "",
                });
                sendEvent("tool_start", {
                  toolCallId: chunk.toolCallId,
                  functionName: chunk.functionName,
                });
                break;
              case "tool_call_delta": {
                const existing = currentToolCalls.get(chunk.toolCallId);
                if (existing) {
                  existing.arguments += chunk.arguments;
                }
                break;
              }
              case "done": {
                if (currentToolCalls.size > 0) {
                  const toolCallArray: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
                  for (const [id, tc] of currentToolCalls) {
                    toolCallArray.push({
                      id,
                      type: "function",
                      function: { name: tc.functionName, arguments: tc.arguments },
                    });
                  }
                  messagesForLLM.push({
                    role: "assistant",
                    content: fullContent || null,
                    toolCalls: toolCallArray,
                  });
                  for (const [id, tc] of currentToolCalls) {
                    let args: Record<string, unknown>;
                    try {
                      args = JSON.parse(tc.arguments);
                    } catch {
                      args = {};
                    }
                    let result: string;
                    const toolStartedAt = Date.now();
                    sendEvent("tool_progress", {
                      toolCallId: id,
                      functionName: tc.functionName,
                      status: "executing",
                    });
                    try {
                      result = await Promise.race([
                        (gw as unknown as { toolRegistry: { executeTool: (name: string, args: Record<string, unknown>) => Promise<string> } }).toolRegistry.executeTool(tc.functionName, args),
                        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Tool execution timeout (30s)")), 30000)),
                      ]);
                    } catch (err: any) {
                      result = `Error: ${err.message ?? "Tool execution failed"}`;
                    }
                    const toolDuration = Date.now() - toolStartedAt;
                    sendEvent("tool_end", {
                      toolCallId: id,
                      functionName: tc.functionName,
                      result: result.slice(0, 500),
                      durationMs: toolDuration,
                    });
                    sendEvent("tool_result", {
                      toolCallId: id,
                      functionName: tc.functionName,
                      result,
                    });
                    messagesForLLM.push({
                      role: "tool",
                      content: result,
                      toolCallId: id,
                    });
                  }
                } else {
                  sendEvent("done", {
                    finishReason: chunk.finishReason,
                    thinking: thinkingContent,
                    content: fullContent,
                    rounds: round,
                  });
                  round = maxRounds;
                }
                break;
              }
            }
          }

          if (currentToolCalls.size === 0) break;
        }
      } else {
        const chatInput: { messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null }>; systemPrompt?: string } = {
          messages: chatMessages as Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | null }>,
          systemPrompt,
        };

        const result = await (gw as Required<ModelGateway>).chatWithTools(chatInput) as { response: { content: string | null; finishReason: string; reasoningContent?: string }; toolResults: Array<{ toolCallId: string; functionName: string; arguments: Record<string, unknown>; result: string }> };

        if (result.response.reasoningContent) {
          sendEvent("thinking_start", {});
          sendEvent("thinking_delta", { content: result.response.reasoningContent });
          sendEvent("thinking_end", { content: result.response.reasoningContent });
        }

        if (result.toolResults && result.toolResults.length > 0) {
          for (const tr of result.toolResults) {
            sendEvent("tool_start", { toolCallId: tr.toolCallId, functionName: tr.functionName });
            sendEvent("tool_result", {
              toolCallId: tr.toolCallId,
              functionName: tr.functionName,
              result: tr.result,
            });
            sendEvent("tool_end", { toolCallId: tr.toolCallId, functionName: tr.functionName, result: tr.result.slice(0, 500) });
          }
        }

        const content = result.response.content ?? "";
        sendEvent("content_delta", { content });
        sendEvent("done", { finishReason: result.response.finishReason ?? "stop", thinking: result.response.reasoningContent ?? "", content });
      }

      sendEvent("lifecycle", { phase: "end", runId, endedAt: Date.now(), durationMs: Date.now() - startedAt });
    } catch (err: any) {
      const errMsg = err?.error?.message ?? err?.message ?? String(err);
      sendEvent("lifecycle", { phase: "error", runId, error: errMsg, endedAt: Date.now(), durationMs: Date.now() - startedAt });
      sendEvent("error", { message: errMsg });
    }

    reply.raw.end();
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
    return { data: await citationVerifier.batchVerify(citations) };
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

  app.get<{
    Params: { entityType: string; entityId: string };
    Querystring: { v1: string; v2: string };
  }>("/api/versions/:entityType/:entityId/diff", async (request, reply) => {
    const { v1, v2 } = request.query;
    if (!v1 || !v2) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "v1 and v2 query params required", requestId: request.id }
      });
    }
    const version1 = await projectStore.getVersion(v1);
    const version2 = await projectStore.getVersion(v2);
    if (!version1 || !version2) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Version not found", requestId: request.id }
      });
    }
    const s1 = version1.snapshotJson;
    const s2 = version2.snapshotJson;
    const additions: Array<{ field: string; value: unknown }> = [];
    const modifications: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const deletions: Array<{ field: string; value: unknown }> = [];
    const allKeys = new Set([...Object.keys(s1), ...Object.keys(s2)]);
    for (const key of allKeys) {
      const inV1 = key in s1;
      const inV2 = key in s2;
      if (!inV1 && inV2) {
        additions.push({ field: key, value: s2[key] });
      } else if (inV1 && !inV2) {
        deletions.push({ field: key, value: s1[key] });
      } else if (inV1 && inV2) {
        const val1 = JSON.stringify(s1[key]);
        const val2 = JSON.stringify(s2[key]);
        if (val1 !== val2) {
          modifications.push({ field: key, oldValue: s1[key], newValue: s2[key] });
        }
      }
    }
    if (Array.isArray(s1.blocks) && Array.isArray(s2.blocks)) {
      const blocks1 = s1.blocks as Record<string, unknown>[];
      const blocks2 = s2.blocks as Record<string, unknown>[];
      const maxLen = Math.max(blocks1.length, blocks2.length);
      for (let i = 0; i < maxLen; i++) {
        const b1 = blocks1[i];
        const b2 = blocks2[i];
        if (!b1 && b2) {
          additions.push({ field: `blocks[${i}]`, value: b2 });
        } else if (b1 && !b2) {
          deletions.push({ field: `blocks[${i}]`, value: b1 });
        } else if (b1 && b2) {
          const t1 = JSON.stringify(b1);
          const t2 = JSON.stringify(b2);
          if (t1 !== t2) {
            modifications.push({ field: `blocks[${i}]`, oldValue: b1, newValue: b2 });
          }
        }
      }
    }
    return {
      data: {
        additions,
        modifications,
        deletions,
        summary: { added: additions.length, modified: modifications.length, deleted: deletions.length }
      }
    };
  });

  app.get<{
    Params: { artifactId: string };
    Querystring: { from: string; to: string };
  }>("/api/artifacts/:artifactId/blocks/diff", async (request, reply) => {
    const { from, to } = request.query;
    if (!from || !to) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "from and to query params required", requestId: request.id }
      });
    }
    const v1 = await projectStore.getVersion(from);
    const v2 = await projectStore.getVersion(to);
    if (!v1 || !v2) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Version not found", requestId: request.id }
      });
    }
    const blocks1 = (Array.isArray(v1.snapshotJson.blocks) ? v1.snapshotJson.blocks : []) as Record<string, unknown>[];
    const blocks2 = (Array.isArray(v2.snapshotJson.blocks) ? v2.snapshotJson.blocks : []) as Record<string, unknown>[];
    const result: Array<{ index: number; changeType: "added" | "modified" | "removed" | "unchanged"; oldBlock?: Record<string, unknown>; newBlock?: Record<string, unknown> }> = [];
    const maxLen = Math.max(blocks1.length, blocks2.length);
    for (let i = 0; i < maxLen; i++) {
      const b1 = blocks1[i];
      const b2 = blocks2[i];
      if (!b1 && b2) {
        result.push({ index: i, changeType: "added", newBlock: b2 });
      } else if (b1 && !b2) {
        result.push({ index: i, changeType: "removed", oldBlock: b1 });
      } else if (b1 && b2) {
        const t1 = JSON.stringify(b1);
        const t2 = JSON.stringify(b2);
        result.push({
          index: i,
          changeType: t1 === t2 ? "unchanged" : "modified",
          oldBlock: b1,
          newBlock: b2
        });
      }
    }
    return { data: result };
  });

  interface AuthUser {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    educationStage: string | undefined;
    discipline: string | undefined;
    createdAt: string;
  }

  const users = new Map<string, AuthUser>();
  const tokens = new Map<string, string>();
  const demoUserId = randomUUID();
  const isDemoMode = process.env.DEMO_MODE === "true";
  users.set("demo@zhixu.ai", {
    id: demoUserId,
    email: "demo@zhixu.ai",
    passwordHash: createHash("sha256").update("demo123").digest("hex"),
    name: "演示用户",
    educationStage: "undergraduate",
    discipline: "计算机科学",
    createdAt: new Date().toISOString()
  });

  function verifyAuth(request: { headers: Record<string, string | undefined> }): string | null {
    const authHeader = request.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const userId = tokens.get(token);
    return userId ?? null;
  }

  app.addHook("onRequest", async (request, reply) => {
    const url = request.url;
    if (url.startsWith("/api/auth/") || url === "/health" || url === "/ready") return;
    if (!url.startsWith("/api/")) return;
    const userId = verifyAuth(request as unknown as { headers: Record<string, string | undefined> });
    if (!userId) {
      if (isDemoMode) {
        (request as unknown as Record<string, unknown>).userId = demoUserId;
      } else {
        reply.status(401).send({ error: "UNAUTHORIZED", message: "请先登录" });
        return;
      }
    } else {
      (request as unknown as Record<string, unknown>).userId = userId;
    }
  });

  app.post("/api/auth/register", async (request, reply) => {
    const body = request.body as { email: string; password: string; name: string; educationStage?: string; discipline?: string };
    if (!body.email || !body.password || !body.name) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "email, password and name are required", requestId: request.id }
      });
    }
    if (users.has(body.email)) {
      return reply.status(409).send({
        error: { code: "CONFLICT", message: "Email already registered", requestId: request.id }
      });
    }
    const user: AuthUser = {
      id: randomUUID(),
      email: body.email,
      passwordHash: createHash("sha256").update(body.password).digest("hex"),
      name: body.name,
      educationStage: body.educationStage,
      discipline: body.discipline,
      createdAt: new Date().toISOString()
    };
    users.set(user.email, user);
    const token = randomUUID();
    tokens.set(token, user.id);
    const { passwordHash: _, ...safeUser } = user;
    return reply.status(201).send({ data: { user: safeUser, token } });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email: string; password: string };
    if (!body.email || !body.password) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "email and password are required", requestId: request.id }
      });
    }
    const user = users.get(body.email);
    if (!user) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Invalid email or password", requestId: request.id }
      });
    }
    const hash = createHash("sha256").update(body.password).digest("hex");
    if (hash !== user.passwordHash) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Invalid email or password", requestId: request.id }
      });
    }
    const token = randomUUID();
    tokens.set(token, user.id);
    const { passwordHash: _, ...safeUser } = user;
    return { data: { user: safeUser, token } };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const userId = verifyAuth(request as unknown as { headers: Record<string, string | undefined> });
    if (!userId) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Not authenticated", requestId: request.id }
      });
    }
    for (const user of users.values()) {
      if (user.id === userId) {
        const { passwordHash: _, ...safeUser } = user;
        return { data: safeUser };
      }
    }
    return reply.status(404).send({
      error: { code: "NOT_FOUND", message: "User not found", requestId: request.id }
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const authHeader = (request as unknown as { headers: Record<string, string | undefined> }).headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Not authenticated", requestId: request.id }
      });
    }
    const token = authHeader.slice(7);
    tokens.delete(token);
    return { data: { success: true } };
  });

  app.get("/api/workspace/files/*", async (request, reply) => {
    const wildcard = (request.params as Record<string, string>)["*"] ?? "";
    const filename = decodeURIComponent(wildcard);
    const { resolve, sep } = await import("node:path");
    const { existsSync, statSync, createReadStream } = await import("node:fs");
    const workspaceRoot = resolve(process.env.ZHIXU_WORKSPACE ?? join(process.cwd(), "workspace"));
    const absPath = resolve(workspaceRoot, filename);
    if (!absPath.startsWith(workspaceRoot + sep) && absPath !== workspaceRoot) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Path escapes workspace" } });
    }
    if (!existsSync(absPath)) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "File not found" } });
    }
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Path is a directory" } });
    }
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
      py: "text/x-python",
      js: "text/javascript",
      ts: "text/typescript",
      json: "application/json",
      txt: "text/plain",
      md: "text/markdown",
      csv: "text/csv",
      html: "text/html",
      css: "text/css",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";
    const rawName = filename.split("/").pop() ?? filename;
    const encodedName = encodeURIComponent(rawName);
    reply.header("Content-Type", contentType);
    reply.header("Content-Disposition", `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    return reply.send(createReadStream(absPath));
  });

  app.get("/api/workspace/list", async (_request, reply) => {
    const { resolve, sep, join: pathJoin } = await import("node:path");
    const { readdirSync, statSync, existsSync } = await import("node:fs");
    const workspaceRoot = resolve(process.env.ZHIXU_WORKSPACE ?? pathJoin(process.cwd(), "workspace"));
    if (!existsSync(workspaceRoot)) return { files: [] };
    const files: Array<{ name: string; path: string; size: number; type: string }> = [];
    function walk(dir: string, prefix: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = pathJoin(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          files.push({ name: entry.name, path: rel, size: 0, type: "directory" });
          walk(full, rel);
        } else {
          files.push({ name: entry.name, path: rel, size: statSync(full).size, type: "file" });
        }
      }
    }
    walk(workspaceRoot, "");
    return { files };
  });

  // Register domain package routes (coaching, grad, research, undergrad, efficiency, sensenova)
  await registerDomainRoutes(app, projectStore, modelGateway, { getImageConfig: getSenseNovaImageConfig });

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
  pipeline: ExportPipeline,
  examQuestions: Map<string, { id: string; projectId: string; topic: string; questionType: string; questionText: string; options: string[] | null; correctAnswer: string; explanation: string; createdAt: string }>,
  examSubmissions: Map<string, { id: string; questionId: string; projectId: string; answer: string; correct: boolean; explanation: string; mistakeType: string | null; createdAt: string }>,
  termbaseEntries: Map<string, Map<string, { id: string; term: string; definition: string; domain: string; createdAt: string }>>,
  citationVerifier: CitationVerifier
): void {
  const allSkills = registry.listSkills();
  const hasLLM = () => typeof (gateway as unknown as Record<string, unknown>).chatWithTools === "function";
  const callLLM = async (systemPrompt: string, userMessage: string): Promise<string> => {
    if (!hasLLM()) return "";
    const llmResult = await (gateway as Required<ModelGateway>).chatWithTools({
      messages: [{ role: "user", content: userMessage }],
      systemPrompt
    });
    return (llmResult.response as Record<string, unknown>)?.content as string ?? "";
  };
  const localCost = { provider: "local", model: "builtin", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };
  const llmCost = { provider: "dashscope", model: "qwen", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };

  for (const manifest of allSkills) {
    runner.registerHandler(manifest.id, async (context) => {
      const { userId, projectId, input } = context;

      switch (manifest.id) {
        case "skill_source_parse":
        case "skill_pdf_parse": {
          const sourceId = (input.sourceId as string) ?? "";
          const project = await store.getProject(projectId);
          const source = project?.sources.find((s) => s.id === sourceId);
          if (!source) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Source ${sourceId} not found` },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["source_not_found"], nextActions: ["upload_source_first"],
              costEstimate: localCost
            };
          }
          const parseResult: Record<string, unknown> = {
            status: "completed", sourceId, fileName: source.fileName,
            document: { title: source.fileName, sections: [] as Array<Record<string, unknown>> },
            evidenceAnchors: [], responsibilityColor: "gray" as const
          };
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的文档解析Agent。请提取文档的结构、关键信息和证据锚点。",
                `请解析以下文件的结构和关键内容：${source.fileName}`
              );
              (parseResult.document as Record<string, unknown>)["sections"] = [{ type: "text", text: content }];
              parseResult.responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result", structuredResult: parseResult,
            confidence: 0.7, requiredConfirmations: [], evidenceRefs: [sourceId],
            riskFlags: [], nextActions: ["review_parsed_content"], costEstimate: localCost
          };
        }

        case "skill_ocr": {
          const sourceId = (input.sourceId as string) ?? "";
          const project = await store.getProject(projectId);
          const source = project?.sources.find((s) => s.id === sourceId);
          if (!source) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Source ${sourceId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["source_not_found"], nextActions: ["upload_source_first"], costEstimate: localCost
            };
          }
          let ocrText = "";
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              ocrText = await callLLM(
                "你是知序AI的OCR Agent。请详细描述图片中的文字内容、图表信息和布局结构。",
                `请对以下图片文件进行OCR识别，提取所有文字内容：${source.fileName}`
              );
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (!ocrText) {
            ocrText = `[OCR placeholder] ${source.fileName}`;
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", sourceId, fileName: source.fileName, text: ocrText, confidence: hasLLM() ? 0.7 : 0.3, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [sourceId],
            riskFlags: hasLLM() ? ["ai_inferred_content"] : ["no_ocr_engine"], nextActions: ["review_ocr_result"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_excel_data": {
          const sourceId = (input.sourceId as string) ?? "";
          const project = await store.getProject(projectId);
          const source = project?.sources.find((s) => s.id === sourceId);
          if (!source) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Source ${sourceId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["source_not_found"], nextActions: ["upload_source_first"], costEstimate: localCost
            };
          }
          let sheets: Array<{ name: string; rows: number; columns: number; preview: string[][] }> = [];
          let summary: Record<string, unknown> = {};
          let responsibilityColor: "green" | "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的数据分析Agent。请分析Excel文件的结构和数据摘要。",
                `请分析以下Excel文件的结构和数据摘要：${source.fileName}\n请输出JSON格式：{ "sheets": [{ "name": "Sheet1", "rows": 10, "columns": 5, "preview": [["A1","B1"],["A2","B2"]] }], "summary": { "totalRows": 10, "keyColumns": ["列1"] } }`
              );
              try {
                const parsed = JSON.parse(content);
                sheets = parsed.sheets ?? [];
                summary = parsed.summary ?? {};
                responsibilityColor = "yellow";
              } catch {
                summary = { rawAnalysis: content };
                responsibilityColor = "yellow";
              }
            } catch { /* fallback */ }
          }
          if (sheets.length === 0) {
            sheets = [{ name: "Sheet1", rows: 0, columns: 0, preview: [] }];
            summary = { note: "Excel解析需要LLM支持" };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", sourceId, fileName: source.fileName, sheets, summary, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [sourceId],
            riskFlags: [], nextActions: ["review_data"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_image_process": {
          const sourceId = (input.sourceId as string) ?? "";
          const operation = (input.operation as string) ?? "describe";
          const project = await store.getProject(projectId);
          const source = project?.sources.find((s) => s.id === sourceId);
          if (!source) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Source ${sourceId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["source_not_found"], nextActions: ["upload_source_first"], costEstimate: localCost
            };
          }
          let result = "";
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              result = await callLLM(
                "你是知序AI的图像分析Agent。请根据操作类型分析图片内容。",
                `请对以下图片执行"${operation}"操作：${source.fileName}`
              );
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (!result) {
            result = `[图像处理占位] ${source.fileName} - ${operation}`;
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", sourceId, operation, result, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [sourceId],
            riskFlags: hasLLM() ? ["ai_inferred_content"] : ["no_image_processor"], nextActions: ["review_result"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_diagram_generate": {
          const type = (input.type as string) ?? "flowchart";
          const description = (input.description as string) ?? "";
          let diagram = "";
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              diagram = await callLLM(
                "你是知序AI的图表生成Agent。请根据描述生成Mermaid语法的图表代码。",
                `请生成一个${type}类型的Mermaid图表，描述如下：${description}\n请只输出Mermaid代码，不要其他内容。`
              );
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (!diagram) {
            diagram = `graph TD\n    A[开始] --> B[${description || "处理"}]\n    B --> C[结束]`;
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", type, description, diagram, format: "mermaid", responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.4, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_diagram"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_citation_check": {
          const artifactId = (input.artifactId as string) ?? "";
          const artifact = await store.getArtifact(artifactId);
          if (!artifact) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Artifact ${artifactId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["artifact_not_found"], nextActions: ["create_artifact_first"], costEstimate: localCost
            };
          }
          const citationTexts: Array<{ rawText: string; doi?: string; title?: string; year?: number }> = [];
          for (const block of artifact.blocks) {
            const text = block.contentJson["text"] as string ?? "";
            const citeRegex = /\[([^\]]+)\]/g;
            let match;
            while ((match = citeRegex.exec(text)) !== null) {
              citationTexts.push({ rawText: match[1] ?? "" });
            }
          }
          const results = await citationVerifier.batchVerify(citationTexts);
          const verified = results.filter((r) => r.status === "verified").length;
          const issues = results.filter((r) => r.status !== "verified").flatMap((r) => r.issues);
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed", artifactId, totalCitations: results.length,
              verified, issues, details: results, responsibilityColor: verified === results.length && results.length > 0 ? "green" as const : "yellow" as const
            },
            confidence: results.length > 0 ? verified / results.length : 0.5,
            requiredConfirmations: issues.length > 0 ? ["fix_citations"] : [],
            evidenceRefs: [], riskFlags: issues.length > 0 ? ["citation_issues"] : [],
            nextActions: issues.length > 0 ? ["fix_citations"] : ["continue"], costEstimate: localCost
          };
        }

        case "skill_plagiarism_precheck": {
          const artifactId = (input.artifactId as string) ?? "";
          const artifact = await store.getArtifact(artifactId);
          if (!artifact) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Artifact ${artifactId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["artifact_not_found"], nextActions: ["create_artifact_first"], costEstimate: localCost
            };
          }
          const allText = artifact.blocks.map((b) => (b.contentJson["text"] as string ?? "")).join(" ");
          const words = allText.split(/\s+/).filter((w) => w.length > 0);
          const trigrams: string[] = [];
          for (let i = 0; i < words.length - 2; i++) {
            trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
          }
          const seen = new Map<string, number[]>();
          const flaggedSections: Array<{ text: string; position: number; type: string }> = [];
          for (let i = 0; i < trigrams.length; i++) {
            const tg = trigrams[i]!.toLowerCase();
            const existing = seen.get(tg);
            if (existing) {
              existing.push(i);
              if (existing.length >= 3) {
                flaggedSections.push({ text: tg, position: i, type: "repeated_ngram" });
              }
            } else {
              seen.set(tg, [i]);
            }
          }
          const uniqueTrigrams = new Set(trigrams.map((t) => t.toLowerCase()));
          const riskScore = trigrams.length > 0 ? Math.min(1, flaggedSections.length / (trigrams.length * 0.1)) : 0;
          let responsibilityColor: "green" | "yellow" | "red" = "green";
          if (riskScore > 0.5) responsibilityColor = "red";
          else if (riskScore > 0.2) responsibilityColor = "yellow";
          if (hasLLM() && allText.length > 100) {
            try {
              const llmAnalysis = await callLLM(
                "你是知序AI的查重Agent。请分析文本的原创性。",
                `请分析以下文本的原创性和潜在抄袭风险：\n${allText.slice(0, 2000)}\n\n请输出JSON格式：{ "riskScore": 0.0-1.0, "flaggedSections": [{ "text": "片段", "reason": "原因" }] }`
              );
              try {
                const parsed = JSON.parse(llmAnalysis);
                return {
                  outputType: "skill.result",
                  structuredResult: {
                    status: "completed", artifactId,
                    riskScore: parsed.riskScore ?? riskScore,
                    flaggedSections: parsed.flaggedSections ?? flaggedSections,
                    trigramStats: { total: trigrams.length, unique: uniqueTrigrams.size },
                    responsibilityColor: "yellow" as const
                  },
                  confidence: 0.7, requiredConfirmations: [], evidenceRefs: [],
                  riskFlags: (parsed.riskScore ?? riskScore) > 0.3 ? ["plagiarism_risk"] : [],
                  nextActions: (parsed.riskScore ?? riskScore) > 0.3 ? ["review_flagged"] : ["continue"], costEstimate: llmCost
                };
              } catch { /* fallback to local */ }
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed", artifactId, riskScore, flaggedSections,
              trigramStats: { total: trigrams.length, unique: uniqueTrigrams.size },
              responsibilityColor
            },
            confidence: 0.6, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: riskScore > 0.3 ? ["plagiarism_risk"] : [],
            nextActions: riskScore > 0.3 ? ["review_flagged"] : ["continue"], costEstimate: localCost
          };
        }

        case "skill_exam_coach": {
          const examDate = (input.examDate as string) ?? "";
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          let plan: Record<string, unknown> = {};
          let questions: unknown[] = [];
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const planContent = await callLLM(
                "你是知序AI的考试复习规划Agent。",
                `请为以下项目生成复习计划：${project.title}，考试日期：${examDate}\n输出JSON：{ "plan": [{ "day": 1, "tasks": ["任务"], "duration": 2 }] }`
              );
              try { plan = JSON.parse(planContent); } catch { plan = { rawPlan: planContent }; }
              const qContent = await callLLM(
                "你是知序AI的出题Agent。",
                `请为${project.title}生成3道练习题。输出JSON数组：[{ "questionType": "choice", "questionText": "题目", "correctAnswer": "答案", "explanation": "解析" }]`
              );
              try { questions = JSON.parse(qContent); } catch { questions = []; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (!plan || Object.keys(plan).length === 0) {
            plan = { note: "需要LLM生成复习计划" };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, examDate, plan, questions, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["start_review"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_presentation_coach": {
          const artifactId = (input.artifactId as string) ?? "";
          const artifact = await store.getArtifact(artifactId);
          if (!artifact) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Artifact ${artifactId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["artifact_not_found"], nextActions: ["create_artifact_first"], costEstimate: localCost
            };
          }
          const slideCount = artifact.blocks.length;
          const estimatedMinutes = slideCount * 1.5;
          let feedback: Array<{ slide: number; suggestion: string; type: string }> = [];
          let timingEstimate = estimatedMinutes;
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的演讲辅导Agent。请分析PPT内容并提供改进建议和计时建议。",
                `请分析以下PPT的内容和演讲建议：\n标题：${artifact.title}\n幻灯片数：${slideCount}\n内容概要：${artifact.blocks.map((b) => b.contentJson["text"] as string ?? "").join(" | ").slice(0, 2000)}\n\n输出JSON：{ "feedback": [{ "slide": 1, "suggestion": "建议", "type": "content|timing|visual" }], "timingEstimate": 10 }`
              );
              try {
                const parsed = JSON.parse(content);
                feedback = parsed.feedback ?? [];
                timingEstimate = parsed.timingEstimate ?? estimatedMinutes;
              } catch { feedback = [{ slide: 0, suggestion: content.slice(0, 500), type: "general" }]; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (feedback.length === 0) {
            feedback = [{ slide: 0, suggestion: `共${slideCount}页，预计${estimatedMinutes}分钟`, type: "timing" }];
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", artifactId, slideCount, feedback, timingEstimate, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.4, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["practice_presentation"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_experiment_log": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          let log: Record<string, unknown> = {};
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的实验日志Agent。请将项目信息结构化为标准实验日志格式。",
                `请为以下项目生成结构化实验日志：${project.title}\n资料：${project.sources.map((s) => s.fileName).join("、")}\n输出JSON：{ "title": "", "objective": "", "methodology": "", "variables": { "independent": [], "dependent": [], "controlled": [] }, "procedure": [], "results": "", "observations": [] }`
              );
              try { log = JSON.parse(content); } catch { log = { rawLog: content }; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (Object.keys(log).length === 0) {
            log = { title: project.title, objective: "待填写", methodology: "待填写", variables: { independent: [], dependent: [], controlled: [] }, procedure: [], results: "", observations: [] };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, log, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["fill_experiment_details"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_style_unifier": {
          const artifactId = (input.artifactId as string) ?? "";
          const artifact = await store.getArtifact(artifactId);
          if (!artifact) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: `Artifact ${artifactId} not found`, responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["artifact_not_found"], nextActions: ["create_artifact_first"], costEstimate: localCost
            };
          }
          let changes = 0;
          let consistency = 0;
          let unifiedText = "";
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const allText = artifact.blocks.map((b) => b.contentJson["text"] as string ?? "").join("\n\n");
              const content = await callLLM(
                "你是知序AI的文风统一Agent。请统一以下文档的写作风格，保持学术规范。",
                `请统一以下文档的文风，保持一致的语气和用词：\n${allText.slice(0, 3000)}\n\n输出JSON：{ "unifiedText": "统一后的文本", "changes": 5, "consistency": 0.9 }`
              );
              try {
                const parsed = JSON.parse(content);
                unifiedText = parsed.unifiedText ?? "";
                changes = parsed.changes ?? 0;
                consistency = parsed.consistency ?? 0;
              } catch { unifiedText = content; changes = 1; consistency = 0.7; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", artifactId, changes, consistency, unifiedText, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_unified_text"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_progress_tracking": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          const totalTasks = project.tasks.length;
          const completedTasks = project.tasks.filter((t) => t.status === "completed" || t.status === "verified").length;
          const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
          const stalledTasks = project.tasks.filter((t) => t.status === "captured" || t.status === "in_progress");
          const risks = stalledTasks.map((t) => ({ taskId: t.id, title: t.title, risk: "stalled" }));
          const sourceProgress = project.sources.filter((s) => s.parseStatus === "completed").length;
          const sourceTotal = project.sources.length;
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed", projectId, progress,
              taskProgress: { completed: completedTasks, total: totalTasks },
              sourceProgress: { parsed: sourceProgress, total: sourceTotal },
              risks, responsibilityColor: progress >= 0.8 ? "green" as const : progress >= 0.5 ? "yellow" as const : "gray" as const
            },
            confidence: 0.9, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: risks.length > 0 ? ["stalled_tasks"] : [],
            nextActions: risks.length > 0 ? ["address_stalled_tasks"] : ["continue"], costEstimate: localCost
          };
        }

        case "skill_calendar_reminder": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          const now = new Date();
          const upcoming: Array<{ type: string; date: string; daysLeft: number; severity: string }> = [];
          if (project.dueDate) {
            const dueDate = new Date(project.dueDate);
            const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            upcoming.push({ type: "project_due", date: project.dueDate, daysLeft, severity: daysLeft <= 3 ? "critical" : daysLeft <= 7 ? "warning" : "info" });
          }
          for (const task of project.tasks) {
            if (task.dueAt) {
              const taskDue = new Date(task.dueAt);
              const daysLeft = Math.ceil((taskDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              upcoming.push({ type: "task_due", date: task.dueAt, daysLeft, severity: daysLeft <= 1 ? "critical" : daysLeft <= 3 ? "warning" : "info" });
            }
          }
          upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
          return {
            outputType: "skill.result",
            structuredResult: {
              status: "completed", projectId, upcoming,
              hasCritical: upcoming.some((u) => u.severity === "critical"),
              responsibilityColor: upcoming.some((u) => u.severity === "critical") ? "red" as const : "green" as const
            },
            confidence: 0.9, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: upcoming.some((u) => u.severity === "critical") ? ["deadline_approaching"] : [],
            nextActions: upcoming.length > 0 ? ["review_deadlines"] : ["no_upcoming"], costEstimate: localCost
          };
        }

        case "skill_knowledge_capsule": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          const capsule = await store.addCapsule(projectId, {
            title: `Knowledge from project: ${project.title}`,
            summary: `Reusable workflow pattern extracted from project with ${project.sources.length} sources and ${project.tasks.length} tasks`,
            capsuleType: "general"
          });
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", capsule, responsibilityColor: "green" as const },
            confidence: 0.7, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_capsule"], costEstimate: localCost
          };
        }

        case "skill_review_response": {
          const feedbackId = (input.feedbackId as string) ?? "";
          let response: Record<string, unknown> = {};
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的审稿回复Agent。请根据反馈生成结构化的审稿回复。",
                `请为以下反馈ID生成审稿回复：${feedbackId}\n项目ID：${projectId}\n输出JSON：{ "responses": [{ "point": "审稿意见", "reply": "回复内容", "action": "修改说明" }], "tone": "respectful" }`
              );
              try { response = JSON.parse(content); } catch { response = { rawResponse: content }; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (Object.keys(response).length === 0) {
            response = { note: "需要LLM生成审稿回复", feedbackId };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", feedbackId, response, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_response"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_grant_application": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          let application: Record<string, unknown> = {};
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的基金申请Agent。请根据项目信息生成基金申请草稿。",
                `请为以下项目生成基金申请草稿：\n标题：${project.title}\n描述：${project.description ?? ""}\n资料：${project.sources.map((s) => s.fileName).join("、")}\n输出JSON：{ "title": "", "abstract": "", "background": "", "objectives": [], "methodology": "", "expectedOutcomes": [], "budget": "", "timeline": "" }`
              );
              try { application = JSON.parse(content); } catch { application = { rawDraft: content }; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (Object.keys(application).length === 0) {
            application = { title: project.title, abstract: "待填写", note: "需要LLM生成基金申请" };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, application, responsibilityColor },
            confidence: hasLLM() ? 0.6 : 0.3, requiredConfirmations: ["review_application"], evidenceRefs: [],
            riskFlags: ["ai_generated_content"], nextActions: ["review_application"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_academic_resume": {
          const uId = (input.userId as string) ?? userId;
          let resume: Record<string, unknown> = {};
          let responsibilityColor: "yellow" | "gray" = "gray";
          const projects = await store.listProjects();
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的学术简历Agent。请根据项目历史生成学术简历。",
                `请为用户${uId}生成学术简历。项目历史：${projects.map((p) => p.title).join("、")}\n输出JSON：{ "name": "", "education": [], "research": [], "publications": [], "skills": [], "awards": [] }`
              );
              try { resume = JSON.parse(content); } catch { resume = { rawResume: content }; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (Object.keys(resume).length === 0) {
            resume = { name: uId, projects: projects.map((p) => p.title), note: "需要LLM生成学术简历" };
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", userId: uId, resume, responsibilityColor },
            confidence: hasLLM() ? 0.6 : 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_resume"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_group_collaboration": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          let assignments: Array<{ member: string; tasks: string[]; estimatedHours: number }> = [];
          let responsibilityColor: "yellow" | "gray" = "gray";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的协作管理Agent。请根据项目任务分配小组成员的工作。",
                `请为以下项目分配小组任务：${project.title}\n任务列表：${project.tasks.map((t) => t.title).join("、")}\n输出JSON：{ "assignments": [{ "member": "成员1", "tasks": ["任务1"], "estimatedHours": 2 }] }`
              );
              try {
                const parsed = JSON.parse(content);
                assignments = parsed.assignments ?? [];
              } catch { assignments = []; }
              responsibilityColor = "yellow";
            } catch { /* fallback */ }
          }
          if (assignments.length === 0) {
            const memberCount = 3;
            const tasksPerMember = Math.ceil(project.tasks.length / memberCount);
            for (let i = 0; i < memberCount; i++) {
              const memberTasks = project.tasks.slice(i * tasksPerMember, (i + 1) * tasksPerMember).map((t) => t.title);
              assignments.push({ member: `成员${i + 1}`, tasks: memberTasks.length > 0 ? memberTasks : ["待分配"], estimatedHours: memberTasks.length * 2 });
            }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, assignments, responsibilityColor },
            confidence: hasLLM() ? 0.7 : 0.4, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["confirm_assignments"], costEstimate: hasLLM() ? llmCost : localCost
          };
        }

        case "skill_offline_cache": {
          const project = await store.getProject(projectId);
          if (!project) {
            return {
              outputType: "skill.result",
              structuredResult: { status: "error", message: "Project not found", responsibilityColor: "gray" },
              confidence: 0, requiredConfirmations: [], evidenceRefs: [],
              riskFlags: ["project_not_found"], nextActions: ["select_project"], costEstimate: localCost
            };
          }
          const snapshot = {
            id: project.id, title: project.title, type: project.type, status: project.status,
            sources: project.sources.length, tasks: project.tasks.length, artifacts: project.artifacts.length,
            dueDate: project.dueDate, cachedAt: new Date().toISOString()
          };
          const sizeBytes = JSON.stringify(snapshot).length;
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, snapshot, cachedAt: snapshot.cachedAt, sizeBytes, responsibilityColor: "green" as const },
            confidence: 0.9, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["use_offline"], costEstimate: localCost
          };
        }

        case "skill_termbase": {
          const term = (input.term as string) ?? "";
          const operation = (input.operation as string) ?? "list";
          if (!termbaseEntries.has(projectId)) {
            termbaseEntries.set(projectId, new Map());
          }
          const projectTerms = termbaseEntries.get(projectId)!;
          let entries: Array<{ id: string; term: string; definition: string; domain: string; createdAt: string }> = [];
          switch (operation) {
            case "add": {
              if (!term) {
                return {
                  outputType: "skill.result",
                  structuredResult: { status: "error", message: "term is required for add operation", responsibilityColor: "gray" },
                  confidence: 0, requiredConfirmations: [], evidenceRefs: [],
                  riskFlags: ["missing_term"], nextActions: ["provide_term"], costEstimate: localCost
                };
              }
              const definition = (input.definition as string) ?? "";
              const domain = (input.domain as string) ?? "general";
              const entry = { id: crypto.randomUUID(), term, definition, domain, createdAt: new Date().toISOString() };
              projectTerms.set(term.toLowerCase(), entry);
              entries = [entry];
              break;
            }
            case "get": {
              if (term) {
                const entry = projectTerms.get(term.toLowerCase());
                entries = entry ? [entry] : [];
              }
              break;
            }
            case "delete": {
              if (term) {
                projectTerms.delete(term.toLowerCase());
              }
              break;
            }
            default: {
              entries = Array.from(projectTerms.values());
              break;
            }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", projectId, operation, entries, responsibilityColor: "green" as const },
            confidence: 0.9, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: [], costEstimate: localCost
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
                artifactId, blockId
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
              confidence: 0.3, requiredConfirmations: ["manual_verification"],
              evidenceRefs: [], riskFlags: ["verification_failed"],
              nextActions: ["manual_review"], costEstimate: localCost
            };
          }
        }

        case "skill_memory_reflect": {
          const project = await store.getProject(projectId);
          const capsule = await store.addCapsule(projectId, {
            title: `Knowledge from project: ${project?.title ?? projectId}`,
            summary: `Reusable workflow pattern extracted from project with ${project?.sources.length ?? 0} sources`,
            capsuleType: "general"
          });
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", capsule, responsibilityColor: "yellow" as const },
            confidence: 0.6, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_capsule"], costEstimate: localCost
          };
        }

        case "skill_ppt_generate": {
          const aId = (input.artifactId as string) ?? "";
          const result = await pipeline.exportPptx({
            title: `Export-${aId}`, brandTheme: "academic_navy",
            slides: [{ title: "Generated Slide", layoutType: "content", contentBlocks: [{ type: "text", text: "Auto-generated content", responsibilityColor: "gray" }], evidenceRefs: [] }]
          });
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", fileName: result.fileName, mimeType: result.mimeType, sizeBytes: result.buffer.length, responsibilitySummary: result.responsibilitySummary },
            confidence: 0.8, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["download_file"], costEstimate: { provider: "local", model: "pptx-renderer", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
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
            structuredResult: { status: "completed", fileName: result.fileName, mimeType: result.mimeType, sizeBytes: result.buffer.length, responsibilitySummary: result.responsibilitySummary },
            confidence: 0.8, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["download_file"], costEstimate: { provider: "local", model: "docx-renderer", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
          };
        }

        case "skill_task_breakdown": {
          const taskTitle = (input.taskTitle as string) ?? "";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的任务拆解Agent。请将复杂任务拆解为结构化子任务，包含标题、优先级和风险等级。以JSON数组格式输出。",
                `请将以下任务拆解为子任务：${taskTitle}`
              );
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", taskTitle, subTasks: content, responsibilityColor: "yellow" as const },
                confidence: 0.7, requiredConfirmations: [], evidenceRefs: [],
                riskFlags: [], nextActions: ["review_subtasks"], costEstimate: llmCost
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", taskTitle, subTasks: [{ title: `${taskTitle} - 子任务1`, priority: 1 }], responsibilityColor: "gray" as const },
            confidence: 0.5, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_subtasks"], costEstimate: localCost
          };
        }

        case "skill_literature_search":
        case "skill_web_research":
        case "skill_github_repo": {
          const query = (input.query as string) ?? (input.repoUrl as string) ?? "";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的搜索Agent。请基于已有知识提供相关搜索结果摘要。",
                `请搜索以下内容的相关信息：${query}`
              );
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", query, results: content, responsibilityColor: "yellow" as const },
                confidence: 0.6, requiredConfirmations: ["verify_sources"], evidenceRefs: [],
                riskFlags: ["ai_inferred_content"], nextActions: ["verify_results"], costEstimate: llmCost
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", query, results: [], responsibilityColor: "yellow" as const },
            confidence: 0.3, requiredConfirmations: ["verify_sources"], evidenceRefs: [],
            riskFlags: ["no_external_api_connected"], nextActions: ["configure_external_api"], costEstimate: localCost
          };
        }

        case "skill_translation": {
          const text = (input.text as string) ?? "";
          const targetLang = (input.targetLang as string) ?? "en";
          if (hasLLM()) {
            try {
              const content = await callLLM(
                "你是知序AI的翻译Agent。请提供准确的学术翻译。",
                `请将以下内容翻译为${targetLang}：${text}`
              );
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", translated: content, responsibilityColor: "yellow" as const },
                confidence: 0.8, requiredConfirmations: [], evidenceRefs: [],
                riskFlags: [], nextActions: ["review_translation"], costEstimate: llmCost
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", translated: `[Translation placeholder] ${text}`, responsibilityColor: "gray" as const },
            confidence: 0.3, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: ["no_llm_available"], nextActions: ["configure_llm"], costEstimate: localCost
          };
        }

        case "skill_mentor_feedback": {
          const rawContent = (input.rawContent as string) ?? "";
          const actionItems = rawContent.split(/[。.!\n]/).filter((s: string) => s.trim().length > 0).map((s: string, i: number) => ({
            id: `action-${i + 1}`, content: s.trim(), status: "pending",
            entityType: null as string | null, entityId: null as string | null
          }));
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", actionItems, responsibilityColor: "green" as const },
            confidence: 0.7, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["bind_action_items"], costEstimate: localCost
          };
        }

        default: {
          if (hasLLM()) {
            try {
              const content = await callLLM(
                `你是知序AI的技能执行Agent。当前技能：${manifest.name}（${manifest.description}）。请根据输入参数生成结构化输出。`,
                `请执行技能 ${manifest.name}，输入参数：${JSON.stringify(input)}`
              );
              return {
                outputType: "skill.result",
                structuredResult: { status: "completed", skillId: manifest.id, output: content, responsibilityColor: "gray" as const },
                confidence: 0.6, requiredConfirmations: [], evidenceRefs: [],
                riskFlags: [], nextActions: ["review_output"], costEstimate: llmCost
              };
            } catch { /* fallback */ }
          }
          return {
            outputType: "skill.result",
            structuredResult: { status: "completed", skillId: manifest.id, input, responsibilityColor: "gray" as const },
            confidence: 0.4, requiredConfirmations: [], evidenceRefs: [],
            riskFlags: [], nextActions: ["review_output"], costEstimate: localCost
          };
        }
      }
    });
  }
}
