import type {
  AgentJobSummary,
  AgentJobType,
  AgentOutput,
  ArtifactBlockSummary,
  ArtifactSummary,
  AuditLogSummary,
  ConfirmHumanGateInput,
  CreateArtifactInput,
  CreateHumanGateInput,
  CreateProjectInput,
  CreateSourceInput,
  CreateTaskInput,
  HumanGateSummary,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  ProjectType,
  ResponsibilityColor,
  RiskLevel,
  SourceSummary,
  TaskSummary,
  UpdateArtifactBlockInput,
  VerificationStatus
} from "@zhixu/core";
import type { MemoryCandidate } from "@zhixu/agent-core";
import type { PrismaClient } from "@prisma/client";

export interface ProjectStore {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectDetail | null>;
  createProject(input: CreateProjectInput): Promise<ProjectSummary>;
  addSource(projectId: string, input: CreateSourceInput): Promise<SourceSummary>;
  addTask(projectId: string, input: CreateTaskInput): Promise<TaskSummary>;
  createArtifact(input: CreateArtifactInput): Promise<ArtifactSummary>;
  updateArtifactBlock(
    artifactId: string,
    blockId: string,
    input: UpdateArtifactBlockInput
  ): Promise<ArtifactBlockSummary | null>;
  createHumanGate(
    projectId: string,
    input: CreateHumanGateInput
  ): Promise<HumanGateSummary>;
  confirmHumanGate(
    gateId: string,
    input: ConfirmHumanGateInput
  ): Promise<HumanGateSummary | null>;
  listAgentJobs(): Promise<AgentJobSummary[]>;
  enqueueAgentJob(input: {
    projectId: string;
    jobType: AgentJobType;
    inputRef: Record<string, unknown>;
  }): Promise<AgentJobSummary>;
  completeAgentJob(jobId: string, output: AgentOutput): Promise<AgentJobSummary | null>;
  listMemoryCandidates(projectId: string): Promise<MemoryCandidate[]>;
  addMemoryCandidate(input: Omit<MemoryCandidate, "id" | "createdAt">): Promise<MemoryCandidate>;
  getArtifact(artifactId: string): Promise<ArtifactSummary | null>;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}

export class PrismaProjectStore implements ProjectStore {
  private readonly prisma: PrismaClient;
  private readonly agentJobs = new Map<string, AgentJobSummary>();
  private readonly memoryCandidates = new Map<string, MemoryCandidate[]>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        riskLevel: true,
        currentState: true,
        dueDate: true
      }
    });
    return projects.map(toProjectSummary);
  }

  async getProject(id: string): Promise<ProjectDetail | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        sources: { orderBy: { createdAt: "asc" } },
        tasks: { orderBy: { createdAt: "asc" } },
        artifacts: {
          orderBy: { createdAt: "asc" },
          include: { blocks: { orderBy: { orderIndex: "asc" } } }
        },
        humanGates: { orderBy: { createdAt: "asc" } },
        auditLogs: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!project) return null;
    return toProjectDetail(project, this.agentJobs);
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    const now = new Date();
    const currentState = { nextAction: "Enter task understanding and complete source scope" };
    const project = await this.prisma.project.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        title: input.title,
        type: input.type,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        status: "captured",
        riskLevel: input.riskLevel,
        privacyMode: input.privacyMode,
        currentState: currentState as any,
        auditLogs: {
          create: {
            actorId: input.ownerId,
            action: "project.created",
            targetType: "Project",
            createdAt: now
          }
        }
      }
    });
    return toProjectSummary(project);
  }

  async addSource(projectId: string, input: CreateSourceInput): Promise<SourceSummary> {
    await this.requireProject(projectId);
    const now = new Date();
    const source = await this.prisma.source.create({
      data: {
        projectId,
        uploadedBy: input.uploadedBy,
        fileName: input.fileName,
        fileType: input.fileType,
        storageUri: input.storageUri,
        sensitivityLevel: input.sensitivityLevel,
        createdAt: now
      }
    });
    await this.prisma.auditLog.create({
      data: {
        projectId,
        actorId: input.uploadedBy,
        action: "source.registered",
        targetType: "Source",
        targetId: source.id,
        createdAt: now
      }
    });
    this.enqueueAgentJobInternal(projectId, "parse_source", { sourceId: source.id });
    return toSourceSummary(source);
  }

  async addTask(projectId: string, input: CreateTaskInput): Promise<TaskSummary> {
    await this.requireProject(projectId);
    const now = new Date();
    const task = await this.prisma.task.create({
      data: {
        projectId,
        parentTaskId: input.parentTaskId ?? null,
        title: input.title,
        description: input.description ?? null,
        assigneeType: input.assigneeType,
        responsibilityLabel: input.responsibilityLabel,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        riskLevel: input.riskLevel,
        createdAt: now
      }
    });
    await this.prisma.auditLog.create({
      data: {
        projectId,
        actorId: "system",
        action: "task.created",
        targetType: "Task",
        targetId: task.id,
        createdAt: now
      }
    });
    return toTaskSummary(task);
  }

  async createArtifact(input: CreateArtifactInput): Promise<ArtifactSummary> {
    await this.requireProject(input.projectId);
    const now = new Date();
    const blocksData = input.firstBlock
      ? [
          {
            blockType: input.firstBlock.blockType,
            contentJson: input.firstBlock.contentJson as any,
            orderIndex: 0,
            responsibilityColor: "gray" as const,
            verificationStatus: "unverified" as const,
            createdBy: input.firstBlock.createdBy,
            updatedBy: input.firstBlock.createdBy,
            createdAt: now,
            updatedAt: now
          }
        ]
      : [];
    const artifact = await this.prisma.artifact.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        blocks: { create: blocksData as any }
      },
      include: { blocks: { orderBy: { orderIndex: "asc" } } }
    });
    await this.prisma.auditLog.create({
      data: {
        projectId: input.projectId,
        actorId: input.firstBlock?.createdBy ?? "system",
        action: "artifact.created",
        targetType: "Artifact",
        targetId: artifact.id,
        createdAt: now
      }
    });
    return toArtifactSummary(artifact);
  }

  async updateArtifactBlock(
    artifactId: string,
    blockId: string,
    input: UpdateArtifactBlockInput
  ): Promise<ArtifactBlockSummary | null> {
    const block = await this.prisma.artifactBlock.findUnique({
      where: { id: blockId }
    });
    if (!block || block.artifactId !== artifactId) return null;

    const now = new Date();
    const updated = await this.prisma.artifactBlock.update({
      where: { id: blockId },
      data: {
        contentJson: input.contentJson as any,
        responsibilityColor: input.responsibilityColor,
        verificationStatus: input.verificationStatus,
        updatedBy: input.updatedBy,
        updatedAt: now
      }
    });

    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      select: { projectId: true }
    });
    if (artifact) {
      await this.prisma.auditLog.create({
        data: {
          projectId: artifact.projectId,
          actorId: input.updatedBy,
          action: "artifact_block.updated",
          targetType: "ArtifactBlock",
          targetId: blockId,
          createdAt: now
        }
      });
    }

    return toArtifactBlockSummary(updated);
  }

  async createHumanGate(
    projectId: string,
    input: CreateHumanGateInput
  ): Promise<HumanGateSummary> {
    await this.requireProject(projectId);
    const now = new Date();
    const gate = await this.prisma.humanGate.create({
      data: {
        projectId,
        gateType: input.gateType,
        reason: input.reason,
        riskLevel: input.riskLevel,
        createdAt: now
      }
    });
    await this.prisma.auditLog.create({
      data: {
        projectId,
        humanGateId: gate.id,
        actorId: "system",
        action: "human_gate.created",
        targetType: "HumanGate",
        targetId: gate.id,
        createdAt: now
      }
    });
    return toHumanGateSummary(gate);
  }

  async confirmHumanGate(
    gateId: string,
    input: ConfirmHumanGateInput
  ): Promise<HumanGateSummary | null> {
    const gate = await this.prisma.humanGate.findUnique({
      where: { id: gateId }
    });
    if (!gate) return null;

    const now = new Date();
    const updated = await this.prisma.humanGate.update({
      where: { id: gateId },
      data: {
        status: "confirmed",
        confirmedBy: input.confirmedBy,
        confirmedAt: now
      }
    });

    await this.prisma.auditLog.create({
      data: {
        projectId: gate.projectId,
        humanGateId: gateId,
        actorId: input.confirmedBy,
        action: "human_gate.confirmed",
        targetType: "HumanGate",
        targetId: gateId,
        createdAt: now
      }
    });

    return toHumanGateSummary(updated);
  }

  async listAgentJobs(): Promise<AgentJobSummary[]> {
    return Array.from(this.agentJobs.values());
  }

  async enqueueAgentJob(input: {
    projectId: string;
    jobType: AgentJobType;
    inputRef: Record<string, unknown>;
  }): Promise<AgentJobSummary> {
    return this.enqueueAgentJobInternal(input.projectId, input.jobType, input.inputRef);
  }

  async completeAgentJob(
    jobId: string,
    output: AgentOutput
  ): Promise<AgentJobSummary | null> {
    const job = this.agentJobs.get(jobId);
    if (!job) return null;

    const now = new Date().toISOString();
    const updated: AgentJobSummary = {
      ...job,
      status: "completed",
      output,
      updatedAt: now
    };
    this.agentJobs.set(jobId, updated);
    return updated;
  }

  async listMemoryCandidates(projectId: string): Promise<MemoryCandidate[]> {
    return this.memoryCandidates.get(projectId) ?? [];
  }

  async addMemoryCandidate(
    input: Omit<MemoryCandidate, "id" | "createdAt">
  ): Promise<MemoryCandidate> {
    const candidate: MemoryCandidate = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const existing = this.memoryCandidates.get(input.projectId) ?? [];
    existing.push(candidate);
    this.memoryCandidates.set(input.projectId, existing);
    return candidate;
  }

  async getArtifact(artifactId: string): Promise<ArtifactSummary | null> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      include: { blocks: { orderBy: { orderIndex: "asc" } } }
    });
    if (!artifact) return null;
    return toArtifactSummary(artifact);
  }

  private async requireProject(projectId: string): Promise<void> {
    const count = await this.prisma.project.count({ where: { id: projectId } });
    if (count === 0) {
      throw new NotFoundError("Project", projectId);
    }
  }

  private enqueueAgentJobInternal(
    projectId: string,
    jobType: AgentJobType,
    inputRef: Record<string, unknown>
  ): AgentJobSummary {
    const now = new Date().toISOString();
    const job: AgentJobSummary = {
      id: crypto.randomUUID(),
      projectId,
      jobType,
      status: "queued",
      inputRef,
      output: null,
      errorCode: null,
      traceId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.agentJobs.set(job.id, job);
    return job;
  }
}

type ProjectRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  riskLevel: string;
  currentState: unknown;
  dueDate: Date | null;
};

type ProjectDetailRow = {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  type: string;
  description: string | null;
  dueDate: Date | null;
  priority: number;
  status: string;
  riskLevel: string;
  privacyMode: string;
  currentState: unknown;
  sources: SourceRow[];
  tasks: TaskRow[];
  artifacts: ArtifactWithBlocksRow[];
  humanGates: HumanGateRow[];
  auditLogs: AuditLogRow[];
};

type SourceRow = {
  id: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  storageUri: string;
  parseStatus: string;
  ocrStatus: string;
  indexStatus: string;
  sensitivityLevel: string;
  createdAt: Date;
};

type TaskRow = {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  assigneeType: string;
  responsibilityLabel: string;
  status: string;
  priority: number;
  dueAt: Date | null;
  riskLevel: string;
  createdAt: Date;
};

type ArtifactWithBlocksRow = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  status: string;
  exportStatus: string;
  evidenceCoverage: number;
  createdAt: Date;
  blocks: ArtifactBlockRow[];
};

type ArtifactBlockRow = {
  id: string;
  artifactId: string;
  parentBlockId: string | null;
  blockType: string;
  contentJson: unknown;
  orderIndex: number;
  responsibilityColor: string;
  verificationStatus: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type HumanGateRow = {
  id: string;
  projectId: string;
  gateType: string;
  reason: string;
  riskLevel: string;
  status: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

type AuditLogRow = {
  id: string;
  projectId: string | null;
  humanGateId: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: Date;
};

function getNextAction(currentState: unknown): string {
  if (
    typeof currentState === "object" &&
    currentState !== null &&
    "nextAction" in currentState &&
    typeof (currentState as Record<string, unknown>)["nextAction"] === "string"
  ) {
    return (currentState as Record<string, unknown>)["nextAction"] as string;
  }
  return "";
}

function toProjectSummary(project: ProjectRow): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    type: project.type as ProjectType,
    status: project.status as ProjectStatus,
    riskLevel: project.riskLevel as RiskLevel,
    nextAction: getNextAction(project.currentState),
    dueDate: project.dueDate?.toISOString() ?? null
  };
}

function toProjectDetail(
  project: ProjectDetailRow,
  agentJobs: Map<string, AgentJobSummary>
): ProjectDetail {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    title: project.title,
    type: project.type as ProjectType,
    description: project.description,
    dueDate: project.dueDate?.toISOString() ?? null,
    priority: project.priority,
    status: project.status as ProjectStatus,
    riskLevel: project.riskLevel as RiskLevel,
    privacyMode: project.privacyMode,
    nextAction: getNextAction(project.currentState),
    sources: project.sources.map(toSourceSummary),
    tasks: project.tasks.map(toTaskSummary),
    artifacts: project.artifacts.map(toArtifactSummary),
    humanGates: project.humanGates.map(toHumanGateSummary),
    agentJobs: Array.from(agentJobs.values()).filter(
      (job) => job.projectId === project.id
    ),
    auditLogs: project.auditLogs.map(toAuditLogSummary)
  };
}

function toSourceSummary(source: SourceRow): SourceSummary {
  return {
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
    createdAt: source.createdAt.toISOString()
  };
}

function toTaskSummary(task: TaskRow): TaskSummary {
  return {
    id: task.id,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    description: task.description,
    assigneeType: task.assigneeType,
    responsibilityLabel: task.responsibilityLabel,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
    riskLevel: task.riskLevel as RiskLevel,
    createdAt: task.createdAt.toISOString()
  };
}

function toArtifactSummary(artifact: ArtifactWithBlocksRow): ArtifactSummary {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    type: artifact.type,
    title: artifact.title,
    status: artifact.status,
    exportStatus: artifact.exportStatus,
    evidenceCoverage: artifact.evidenceCoverage,
    blocks: artifact.blocks.map(toArtifactBlockSummary),
    createdAt: artifact.createdAt.toISOString()
  };
}

function toArtifactBlockSummary(block: ArtifactBlockRow): ArtifactBlockSummary {
  return {
    id: block.id,
    artifactId: block.artifactId,
    parentBlockId: block.parentBlockId,
    blockType: block.blockType,
    contentJson: (block.contentJson as Record<string, unknown>) ?? {},
    orderIndex: block.orderIndex,
    responsibilityColor: block.responsibilityColor as ResponsibilityColor,
    verificationStatus: block.verificationStatus as VerificationStatus,
    createdBy: block.createdBy,
    updatedBy: block.updatedBy,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString()
  };
}

function toHumanGateSummary(gate: HumanGateRow): HumanGateSummary {
  return {
    id: gate.id,
    projectId: gate.projectId,
    gateType: gate.gateType,
    reason: gate.reason,
    riskLevel: gate.riskLevel as RiskLevel,
    status: gate.status,
    confirmedBy: gate.confirmedBy,
    confirmedAt: gate.confirmedAt?.toISOString() ?? null,
    createdAt: gate.createdAt.toISOString()
  };
}

function toAuditLogSummary(log: AuditLogRow): AuditLogSummary {
  return {
    id: log.id,
    projectId: log.projectId,
    humanGateId: log.humanGateId,
    actorId: log.actorId,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    createdAt: log.createdAt.toISOString()
  };
}
