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
  updateSourceProcessingStatus(
    sourceId: string,
    input: { parseStatus?: string; ocrStatus?: string; indexStatus?: string }
  ): Promise<SourceSummary | null>;
  addTask(projectId: string, input: CreateTaskInput): Promise<TaskSummary>;
  createArtifact(input: CreateArtifactInput): Promise<ArtifactSummary>;
  createArtifactBlock(
    artifactId: string,
    input: { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string; createdBy: string }
  ): Promise<ArtifactBlockSummary | null>;
  updateArtifactBlock(
    artifactId: string,
    blockId: string,
    input: UpdateArtifactBlockInput
  ): Promise<ArtifactBlockSummary | null>;
  deleteArtifactBlock(
    artifactId: string,
    blockId: string
  ): Promise<ArtifactBlockSummary | null>;
  reorderArtifactBlocks(
    artifactId: string,
    blockIds: string[]
  ): Promise<ArtifactBlockSummary[] | null>;
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
  addEvidence(projectId: string, input: { sourceId?: string; artifactId?: string; blockId?: string; evidenceType: string; quoteText?: string; pageNumber?: number; confidence?: number }): Promise<EvidenceSummary>;
  listEvidence(projectId: string): Promise<EvidenceSummary[]>;
  addCapsule(projectId: string, input: { title: string; capsuleType?: string; summary: string; reusableStructureJson?: Record<string, unknown>; reusableTasksJson?: Record<string, unknown>[]; keyEvidenceIds?: string[]; privacyScope?: string }): Promise<KnowledgeCapsuleSummary>;
  listCapsules(projectId: string): Promise<KnowledgeCapsuleSummary[]>;
  createVersion(input: { entityType: string; entityId: string; projectId: string; snapshotJson: Record<string, unknown>; createdBy: string; createdReason?: string }): Promise<VersionSummary>;
  listVersions(entityType: string, entityId: string): Promise<VersionSummary[]>;
  getVersion(versionId: string): Promise<VersionSummary | null>;
  rollbackToVersion(versionId: string): Promise<VersionSummary | null>;
  addMentorFeedback(projectId: string, input: { sourceType: string; sourceId?: string; rawContent: string; feedbackType?: string }): Promise<MentorFeedbackSummary>;
  listMentorFeedback(projectId: string): Promise<MentorFeedbackSummary[]>;
  bindFeedbackItem(feedbackId: string, input: { actionItemId: string; entityType: string; entityId: string }): Promise<MentorFeedbackSummary | null>;
  resolveFeedbackItem(feedbackId: string, input: { resolvedBy: string }): Promise<MentorFeedbackSummary | null>;
  updateProjectStatus(projectId: string, status: ProjectStatus): Promise<ProjectSummary | null>;
}

export interface EvidenceSummary {
  id: string;
  projectId: string;
  sourceId: string | null;
  artifactId: string | null;
  blockId: string | null;
  evidenceType: string;
  pageNumber: number | null;
  textSpan: string | null;
  quoteText: string | null;
  confidence: number;
  responsibilityColor: string;
  verificationStatus: string;
  createdAt: string;
}

export interface KnowledgeCapsuleSummary {
  id: string;
  projectId: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  capsuleType: string;
  summary: string;
  privacyScope: string;
  reuseCount: number;
  createdAt: string;
}

export interface VersionSummary {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  snapshotJson: Record<string, unknown>;
  diffJson: Record<string, unknown> | null;
  createdBy: string;
  createdReason: string;
  createdAt: string;
}

export interface MentorFeedbackActionItem {
  id: string;
  content: string;
  boundEntityType: string | null;
  boundEntityId: string | null;
  status: string;
}

export interface MentorFeedbackSummary {
  id: string;
  projectId: string;
  sourceType: string;
  sourceId: string | null;
  rawContent: string;
  feedbackType: string;
  actionItems: MentorFeedbackActionItem[];
  bindingStatus: string;
  boundArtifactId: string | null;
  boundBlockId: string | null;
  boundTaskId: string | null;
  resolutionStatus: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  mentorPreference: Record<string, unknown>;
  createdAt: string;
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

  async updateSourceProcessingStatus(
    sourceId: string,
    input: { parseStatus?: string; ocrStatus?: string; indexStatus?: string }
  ): Promise<SourceSummary | null> {
    const existing = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!existing) return null;
    const source = await this.prisma.source.update({
      where: { id: sourceId },
      data: {
        parseStatus: input.parseStatus ?? existing.parseStatus,
        ocrStatus: input.ocrStatus ?? existing.ocrStatus,
        indexStatus: input.indexStatus ?? existing.indexStatus
      }
    });
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

  async createArtifactBlock(
    artifactId: string,
    input: { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string; createdBy: string }
  ): Promise<ArtifactBlockSummary | null> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      select: { projectId: true }
    });
    if (!artifact) return null;

    const now = new Date();
    const block = await this.prisma.artifactBlock.create({
      data: {
        artifactId,
        blockType: input.blockType,
        contentJson: input.contentJson as any,
        orderIndex: input.orderIndex,
        responsibilityColor: (input.responsibilityColor as any) ?? "gray",
        verificationStatus: "unverified",
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now
      }
    });

    await this.prisma.auditLog.create({
      data: {
        projectId: artifact.projectId,
        actorId: input.createdBy,
        action: "artifact_block.created",
        targetType: "ArtifactBlock",
        targetId: block.id,
        createdAt: now
      }
    });

    return toArtifactBlockSummary(block);
  }

  async deleteArtifactBlock(
    artifactId: string,
    blockId: string
  ): Promise<ArtifactBlockSummary | null> {
    const block = await this.prisma.artifactBlock.findUnique({
      where: { id: blockId }
    });
    if (!block || block.artifactId !== artifactId) return null;

    const summary = toArtifactBlockSummary(block);
    await this.prisma.artifactBlock.delete({
      where: { id: blockId }
    });

    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      select: { projectId: true }
    });
    if (artifact) {
      await this.prisma.auditLog.create({
        data: {
          projectId: artifact.projectId,
          actorId: "system",
          action: "artifact_block.deleted",
          targetType: "ArtifactBlock",
          targetId: blockId,
          createdAt: new Date()
        }
      });
    }

    return summary;
  }

  async reorderArtifactBlocks(
    artifactId: string,
    blockIds: string[]
  ): Promise<ArtifactBlockSummary[] | null> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId }
    });
    if (!artifact) return null;

    const now = new Date();
    for (let i = 0; i < blockIds.length; i++) {
      const blockId = blockIds[i]!;
      await this.prisma.artifactBlock.update({
        where: { id: blockId },
        data: { orderIndex: i, updatedAt: now }
      });
    }

    const blocks = await this.prisma.artifactBlock.findMany({
      where: { artifactId },
      orderBy: { orderIndex: "asc" }
    });

    return blocks.map(toArtifactBlockSummary);
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

  async addEvidence(
    projectId: string,
    input: { sourceId?: string; artifactId?: string; blockId?: string; evidenceType: string; quoteText?: string; pageNumber?: number; confidence?: number }
  ): Promise<EvidenceSummary> {
    await this.requireProject(projectId);
    const evidence = await this.prisma.evidence.create({
      data: {
        projectId,
        sourceId: input.sourceId ?? null,
        artifactId: input.artifactId ?? null,
        blockId: input.blockId ?? null,
        evidenceType: input.evidenceType,
        quoteText: input.quoteText ?? null,
        pageNumber: input.pageNumber ?? null,
        confidence: input.confidence ?? 0,
        responsibilityColor: "gray",
        verificationStatus: "pending"
      }
    });
    return toEvidenceSummary(evidence);
  }

  async listEvidence(projectId: string): Promise<EvidenceSummary[]> {
    await this.requireProject(projectId);
    const evidence = await this.prisma.evidence.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" }
    });
    return evidence.map(toEvidenceSummary);
  }

  async addCapsule(
    projectId: string,
    input: { title: string; capsuleType?: string; summary: string; reusableStructureJson?: Record<string, unknown>; reusableTasksJson?: Record<string, unknown>[]; keyEvidenceIds?: string[]; privacyScope?: string }
  ): Promise<KnowledgeCapsuleSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, ownerId: true }
    });
    if (!project) throw new NotFoundError("Project", projectId);

    const capsule = await this.prisma.knowledgeCapsule.create({
      data: {
        projectId,
        workspaceId: project.workspaceId,
        ownerId: project.ownerId,
        title: input.title,
        capsuleType: input.capsuleType ?? "workflow_pattern",
        summary: input.summary,
        reusableStructureJson: (input.reusableStructureJson ?? {}) as any,
        reusableTasksJson: (input.reusableTasksJson ?? []) as any,
        keyEvidenceIds: (input.keyEvidenceIds ?? []) as any,
        privacyScope: input.privacyScope ?? "project"
      }
    });
    return toKnowledgeCapsuleSummary(capsule);
  }

  async listCapsules(projectId: string): Promise<KnowledgeCapsuleSummary[]> {
    await this.requireProject(projectId);
    const capsules = await this.prisma.knowledgeCapsule.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
    return capsules.map(toKnowledgeCapsuleSummary);
  }

  async createVersion(input: { entityType: string; entityId: string; projectId: string; snapshotJson: Record<string, unknown>; createdBy: string; createdReason?: string }): Promise<VersionSummary> {
    await this.requireProject(input.projectId);
    const previous = await this.prisma.version.findFirst({
      where: { entityType: input.entityType, entityId: input.entityId },
      orderBy: { createdAt: "desc" }
    });
    const diffJson = previous
      ? computeDiff(previous.snapshotJson as Record<string, unknown>, input.snapshotJson)
      : null;
    const version = await this.prisma.version.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        snapshotJson: input.snapshotJson as any,
        diffJson: diffJson as any,
        createdBy: input.createdBy,
        createdReason: input.createdReason ?? ""
      }
    });
    return toVersionSummary(version);
  }

  async listVersions(entityType: string, entityId: string): Promise<VersionSummary[]> {
    const versions = await this.prisma.version.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" }
    });
    return versions.map(toVersionSummary);
  }

  async getVersion(versionId: string): Promise<VersionSummary | null> {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId }
    });
    return version ? toVersionSummary(version) : null;
  }

  async rollbackToVersion(versionId: string): Promise<VersionSummary | null> {
    const targetVersion = await this.getVersion(versionId);
    if (!targetVersion) return null;
    return this.createVersion({
      entityType: targetVersion.entityType,
      entityId: targetVersion.entityId,
      projectId: targetVersion.projectId,
      snapshotJson: targetVersion.snapshotJson,
      createdBy: targetVersion.createdBy,
      createdReason: `rollback_to_${versionId}`
    });
  }

  async addMentorFeedback(
    projectId: string,
    input: { sourceType: string; sourceId?: string; rawContent: string; feedbackType?: string }
  ): Promise<MentorFeedbackSummary> {
    await this.requireProject(projectId);
    const feedback = await this.prisma.mentorFeedback.create({
      data: {
        projectId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        rawContent: input.rawContent,
        feedbackType: input.feedbackType ?? "general",
        actionItems: parseRawContentToActionItems(input.rawContent) as any,
        mentorPreference: {}
      }
    });
    return toMentorFeedbackSummary(feedback);
  }

  async listMentorFeedback(projectId: string): Promise<MentorFeedbackSummary[]> {
    await this.requireProject(projectId);
    const feedback = await this.prisma.mentorFeedback.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
    return feedback.map(toMentorFeedbackSummary);
  }

  async bindFeedbackItem(
    feedbackId: string,
    input: { actionItemId: string; entityType: string; entityId: string }
  ): Promise<MentorFeedbackSummary | null> {
    const feedback = await this.prisma.mentorFeedback.findUnique({
      where: { id: feedbackId }
    });
    if (!feedback) return null;

    const actionItems = normalizeActionItems(feedback.actionItems);
    const actionItem = actionItems.find((item) => item.id === input.actionItemId);
    if (!actionItem) return null;

    actionItem.boundEntityType = input.entityType;
    actionItem.boundEntityId = input.entityId;
    actionItem.status = "bound";
    const anyBound = actionItems.some((item) => item.status === "bound");
    const allBound = actionItems.every((item) => item.status === "bound" || item.status === "resolved");
    const bindingStatus = allBound ? "fully_bound" : anyBound ? "partially_bound" : "unbound";

    const updated = await this.prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: {
        actionItems: actionItems as any,
        bindingStatus,
        boundArtifactId: input.entityType === "artifact" ? input.entityId : feedback.boundArtifactId,
        boundBlockId: input.entityType === "block" ? input.entityId : feedback.boundBlockId,
        boundTaskId: input.entityType === "task" ? input.entityId : feedback.boundTaskId
      }
    });
    return toMentorFeedbackSummary(updated);
  }

  async resolveFeedbackItem(feedbackId: string, input: { resolvedBy: string }): Promise<MentorFeedbackSummary | null> {
    const feedback = await this.prisma.mentorFeedback.findUnique({
      where: { id: feedbackId }
    });
    if (!feedback) return null;

    const actionItems = normalizeActionItems(feedback.actionItems).map((item) => ({
      ...item,
      status: "resolved"
    }));
    const updated = await this.prisma.mentorFeedback.update({
      where: { id: feedbackId },
      data: {
        actionItems: actionItems as any,
        resolutionStatus: "resolved",
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date()
      }
    });
    return toMentorFeedbackSummary(updated);
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<ProjectSummary | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) return null;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status,
        auditLogs: {
          create: {
            actorId: "system",
            action: `project.status_changed_to_${status}`,
            targetType: "Project",
            targetId: projectId,
            createdAt: new Date()
          }
        }
      }
    });
    return toProjectSummary(updated);
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

type EvidenceRow = {
  id: string;
  projectId: string;
  sourceId: string | null;
  artifactId: string | null;
  blockId: string | null;
  evidenceType: string;
  pageNumber: number | null;
  textSpan: string | null;
  quoteText: string | null;
  confidence: number;
  responsibilityColor: string;
  verificationStatus: string;
  createdAt: Date;
};

type KnowledgeCapsuleRow = {
  id: string;
  projectId: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  capsuleType: string;
  summary: string;
  privacyScope: string;
  reuseCount: number;
  createdAt: Date;
};

type VersionRow = {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  snapshotJson: unknown;
  diffJson: unknown;
  createdBy: string;
  createdReason: string;
  createdAt: Date;
};

type MentorFeedbackRow = {
  id: string;
  projectId: string;
  sourceType: string;
  sourceId: string | null;
  rawContent: string;
  feedbackType: string;
  actionItems: unknown;
  bindingStatus: string;
  boundArtifactId: string | null;
  boundBlockId: string | null;
  boundTaskId: string | null;
  resolutionStatus: string;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  mentorPreference: unknown;
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

function toEvidenceSummary(evidence: EvidenceRow): EvidenceSummary {
  return {
    id: evidence.id,
    projectId: evidence.projectId,
    sourceId: evidence.sourceId,
    artifactId: evidence.artifactId,
    blockId: evidence.blockId,
    evidenceType: evidence.evidenceType,
    pageNumber: evidence.pageNumber,
    textSpan: evidence.textSpan,
    quoteText: evidence.quoteText,
    confidence: evidence.confidence,
    responsibilityColor: evidence.responsibilityColor,
    verificationStatus: evidence.verificationStatus,
    createdAt: evidence.createdAt.toISOString()
  };
}

function toKnowledgeCapsuleSummary(capsule: KnowledgeCapsuleRow): KnowledgeCapsuleSummary {
  return {
    id: capsule.id,
    projectId: capsule.projectId,
    workspaceId: capsule.workspaceId,
    ownerId: capsule.ownerId,
    title: capsule.title,
    capsuleType: capsule.capsuleType,
    summary: capsule.summary,
    privacyScope: capsule.privacyScope,
    reuseCount: capsule.reuseCount,
    createdAt: capsule.createdAt.toISOString()
  };
}

function toVersionSummary(version: VersionRow): VersionSummary {
  return {
    id: version.id,
    entityType: version.entityType,
    entityId: version.entityId,
    projectId: version.projectId,
    snapshotJson: normalizeRecord(version.snapshotJson),
    diffJson: version.diffJson === null ? null : normalizeRecord(version.diffJson),
    createdBy: version.createdBy,
    createdReason: version.createdReason,
    createdAt: version.createdAt.toISOString()
  };
}

function toMentorFeedbackSummary(feedback: MentorFeedbackRow): MentorFeedbackSummary {
  return {
    id: feedback.id,
    projectId: feedback.projectId,
    sourceType: feedback.sourceType,
    sourceId: feedback.sourceId,
    rawContent: feedback.rawContent,
    feedbackType: feedback.feedbackType,
    actionItems: normalizeActionItems(feedback.actionItems),
    bindingStatus: feedback.bindingStatus,
    boundArtifactId: feedback.boundArtifactId,
    boundBlockId: feedback.boundBlockId,
    boundTaskId: feedback.boundTaskId,
    resolutionStatus: feedback.resolutionStatus,
    resolvedBy: feedback.resolvedBy,
    resolvedAt: feedback.resolvedAt?.toISOString() ?? null,
    mentorPreference: normalizeRecord(feedback.mentorPreference),
    createdAt: feedback.createdAt.toISOString()
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeActionItems(value: unknown): MentorFeedbackActionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      content: typeof item.content === "string" ? item.content : "",
      boundEntityType: typeof item.boundEntityType === "string" ? item.boundEntityType : null,
      boundEntityId: typeof item.boundEntityId === "string" ? item.boundEntityId : null,
      status: typeof item.status === "string" ? item.status : "pending"
    }));
}

function computeDiff(
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, unknown> {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ key: string; from: unknown; to: unknown }> = [];

  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const key of allKeys) {
    if (!(key in previous)) {
      added.push(key);
    } else if (!(key in current)) {
      removed.push(key);
    } else if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changed.push({ key, from: previous[key], to: current[key] });
    }
  }

  return { added, removed, changed };
}

function parseRawContentToActionItems(rawContent: string): MentorFeedbackActionItem[] {
  const sentences = rawContent
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return sentences.map((content) => ({
    id: crypto.randomUUID(),
    content,
    boundEntityType: null,
    boundEntityId: null,
    status: "pending"
  }));
}
