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
  SourceSummary,
  TaskSummary,
  UpdateArtifactBlockInput
} from "@zhixu/core";
import type { MemoryCandidate } from "@zhixu/agent-core";

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

type MutableProject = ProjectDetail;

export class InMemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, MutableProject>();
  private readonly memoryCandidates = new Map<string, MemoryCandidate[]>();
  private readonly evidence = new Map<string, EvidenceSummary[]>();
  private readonly capsules = new Map<string, KnowledgeCapsuleSummary[]>();
  private readonly versions = new Map<string, VersionSummary[]>();
  private readonly mentorFeedback = new Map<string, MentorFeedbackSummary[]>();

  constructor(private seedDemoData = false) {
    if (seedDemoData) {
      const project: MutableProject = {
        id: "project_course_presentation",
        workspaceId: "workspace_demo",
        ownerId: "user_demo",
        title: "Course Presentation",
        type: "presentation",
        description: "Prepare a 10-minute course presentation from uploaded materials.",
        dueDate: "2026-06-03T10:00:00.000Z",
        priority: 3,
        status: "planned",
        riskLevel: "L1",
        privacyMode: "cloud",
        nextAction: "Confirm slide-level outline and source scope",
        sources: [],
        tasks: [],
        artifacts: [],
        humanGates: [],
        agentJobs: [],
        auditLogs: [],
      };
      this.projects.set(project.id, project);
      this.memoryCandidates.set(project.id, []);
      this.evidence.set(project.id, []);
      this.capsules.set(project.id, []);
      this.mentorFeedback.set(project.id, []);
    }
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values()).map(toProjectSummary);
  }

  async getProject(id: string): Promise<ProjectDetail | null> {
    const project = this.projects.get(id);
    return project ? structuredClone(project) : null;
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    const now = new Date().toISOString();
    const project: MutableProject = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      title: input.title,
      type: input.type,
      description: input.description ?? null,
      dueDate: input.dueDate?.toISOString() ?? null,
      priority: input.priority,
      status: "captured",
      riskLevel: input.riskLevel,
      privacyMode: input.privacyMode,
      nextAction: "Enter task understanding and complete source scope",
      sources: [],
      tasks: [],
      artifacts: [],
      humanGates: [],
      agentJobs: [],
      auditLogs: []
    };

    project.auditLogs.push(
      createAuditLog({
        projectId: project.id,
        actorId: input.ownerId,
        action: "project.created",
        targetType: "Project",
        targetId: project.id,
        createdAt: now
      })
    );
    this.projects.set(project.id, project);
    this.memoryCandidates.set(project.id, []);
    this.evidence.set(project.id, []);
    this.capsules.set(project.id, []);
    this.mentorFeedback.set(project.id, []);
    return toProjectSummary(project);
  }

  async addSource(projectId: string, input: CreateSourceInput): Promise<SourceSummary> {
    const project = this.requireProject(projectId);
    const now = new Date().toISOString();
    const source: SourceSummary = {
      id: crypto.randomUUID(),
      projectId,
      uploadedBy: input.uploadedBy,
      fileName: input.fileName,
      fileType: input.fileType,
      storageUri: input.storageUri,
      parseStatus: "queued",
      ocrStatus: "pending",
      indexStatus: "pending",
      sensitivityLevel: input.sensitivityLevel,
      createdAt: now
    };

    project.sources.push(source);
    project.agentJobs.push(
      createAgentJob({
        projectId,
        jobType: "parse_source",
        inputRef: { sourceId: source.id }
      })
    );
    project.auditLogs.push(
      createAuditLog({
        projectId,
        actorId: input.uploadedBy,
        action: "source.registered",
        targetType: "Source",
        targetId: source.id,
        createdAt: now
      })
    );
    return structuredClone(source);
  }

  async updateSourceProcessingStatus(
    sourceId: string,
    input: { parseStatus?: string; ocrStatus?: string; indexStatus?: string }
  ): Promise<SourceSummary | null> {
    for (const project of this.projects.values()) {
      const source = project.sources.find((candidate) => candidate.id === sourceId);
      if (!source) continue;
      if (input.parseStatus !== undefined) source.parseStatus = input.parseStatus;
      if (input.ocrStatus !== undefined) source.ocrStatus = input.ocrStatus;
      if (input.indexStatus !== undefined) source.indexStatus = input.indexStatus;
      return structuredClone(source);
    }
    return null;
  }

  async addTask(projectId: string, input: CreateTaskInput): Promise<TaskSummary> {
    const project = this.requireProject(projectId);
    const now = new Date().toISOString();
    const task: TaskSummary = {
      id: crypto.randomUUID(),
      projectId,
      parentTaskId: input.parentTaskId ?? null,
      title: input.title,
      description: input.description ?? null,
      assigneeType: input.assigneeType,
      responsibilityLabel: input.responsibilityLabel,
      status: "captured",
      priority: input.priority,
      dueAt: input.dueAt?.toISOString() ?? null,
      riskLevel: input.riskLevel,
      createdAt: now
    };

    project.tasks.push(task);
    project.auditLogs.push(
      createAuditLog({
        projectId,
        actorId: "system",
        action: "task.created",
        targetType: "Task",
        targetId: task.id,
        createdAt: now
      })
    );
    return structuredClone(task);
  }

  async createArtifact(input: CreateArtifactInput): Promise<ArtifactSummary> {
    const project = this.requireProject(input.projectId);
    const now = new Date().toISOString();
    const artifactId = crypto.randomUUID();
    const blocks: ArtifactBlockSummary[] = input.firstBlock
      ? [
          {
            id: crypto.randomUUID(),
            artifactId,
            parentBlockId: null,
            blockType: input.firstBlock.blockType,
            contentJson: input.firstBlock.contentJson,
            orderIndex: 0,
            responsibilityColor: "gray",
            verificationStatus: "unverified",
            createdBy: input.firstBlock.createdBy,
            updatedBy: input.firstBlock.createdBy,
            createdAt: now,
            updatedAt: now
          }
        ]
      : [];
    const artifact: ArtifactSummary = {
      id: artifactId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      status: "draft",
      exportStatus: "not_started",
      evidenceCoverage: 0,
      blocks,
      createdAt: now
    };

    project.artifacts.push(artifact);
    project.auditLogs.push(
      createAuditLog({
        projectId: input.projectId,
        actorId: input.firstBlock?.createdBy ?? "system",
        action: "artifact.created",
        targetType: "Artifact",
        targetId: artifact.id,
        createdAt: now
      })
    );
    return structuredClone(artifact);
  }

  async updateArtifactBlock(
    artifactId: string,
    blockId: string,
    input: UpdateArtifactBlockInput
  ): Promise<ArtifactBlockSummary | null> {
    const project = this.findProjectByArtifact(artifactId);
    if (!project) return null;

    const artifact = project.artifacts.find((candidate) => candidate.id === artifactId);
    const block = artifact?.blocks.find((candidate) => candidate.id === blockId);
    if (!block) return null;

    block.contentJson = input.contentJson;
    block.responsibilityColor = input.responsibilityColor;
    block.verificationStatus = input.verificationStatus;
    block.updatedBy = input.updatedBy;
    block.updatedAt = new Date().toISOString();
    project.auditLogs.push(
      createAuditLog({
        projectId: project.id,
        actorId: input.updatedBy,
        action: "artifact_block.updated",
        targetType: "ArtifactBlock",
        targetId: block.id,
        createdAt: block.updatedAt
      })
    );
    return structuredClone(block);
  }

  async createArtifactBlock(
    artifactId: string,
    input: { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string; createdBy: string }
  ): Promise<ArtifactBlockSummary | null> {
    const project = this.findProjectByArtifact(artifactId);
    if (!project) return null;

    const artifact = project.artifacts.find((a) => a.id === artifactId);
    if (!artifact) return null;

    const now = new Date().toISOString();
    const block: ArtifactBlockSummary = {
      id: crypto.randomUUID(),
      artifactId,
      parentBlockId: null,
      blockType: input.blockType,
      contentJson: input.contentJson,
      orderIndex: input.orderIndex,
      responsibilityColor: (input.responsibilityColor as ArtifactBlockSummary["responsibilityColor"]) ?? "gray",
      verificationStatus: "unverified",
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now
    };

    artifact.blocks.push(block);
    project.auditLogs.push(
      createAuditLog({
        projectId: project.id,
        actorId: input.createdBy,
        action: "artifact_block.created",
        targetType: "ArtifactBlock",
        targetId: block.id,
        createdAt: now
      })
    );
    return structuredClone(block);
  }

  async deleteArtifactBlock(
    artifactId: string,
    blockId: string
  ): Promise<ArtifactBlockSummary | null> {
    const project = this.findProjectByArtifact(artifactId);
    if (!project) return null;

    const artifact = project.artifacts.find((a) => a.id === artifactId);
    if (!artifact) return null;

    const blockIndex = artifact.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return null;

    const [removed] = artifact.blocks.splice(blockIndex, 1);
    if (!removed) return null;
    project.auditLogs.push(
      createAuditLog({
        projectId: project.id,
        actorId: "system",
        action: "artifact_block.deleted",
        targetType: "ArtifactBlock",
        targetId: blockId,
        createdAt: new Date().toISOString()
      })
    );
    return structuredClone(removed);
  }

  async reorderArtifactBlocks(
    artifactId: string,
    blockIds: string[]
  ): Promise<ArtifactBlockSummary[] | null> {
    const project = this.findProjectByArtifact(artifactId);
    if (!project) return null;

    const artifact = project.artifacts.find((a) => a.id === artifactId);
    if (!artifact) return null;

    const reordered: ArtifactBlockSummary[] = [];
    for (let i = 0; i < blockIds.length; i++) {
      const block = artifact.blocks.find((b) => b.id === blockIds[i]);
      if (block) {
        block.orderIndex = i;
        block.updatedAt = new Date().toISOString();
        reordered.push(block);
      }
    }
    artifact.blocks = reordered;
    return structuredClone(reordered);
  }

  async createHumanGate(
    projectId: string,
    input: CreateHumanGateInput
  ): Promise<HumanGateSummary> {
    const project = this.requireProject(projectId);
    const now = new Date().toISOString();
    const gate: HumanGateSummary = {
      id: crypto.randomUUID(),
      projectId,
      gateType: input.gateType,
      reason: input.reason,
      riskLevel: input.riskLevel,
      status: "pending",
      confirmedBy: null,
      confirmedAt: null,
      createdAt: now
    };

    project.humanGates.push(gate);
    project.auditLogs.push(
      createAuditLog({
        projectId,
        humanGateId: gate.id,
        actorId: "system",
        action: "human_gate.created",
        targetType: "HumanGate",
        targetId: gate.id,
        createdAt: now
      })
    );
    return structuredClone(gate);
  }

  async listAgentJobs(): Promise<AgentJobSummary[]> {
    return Array.from(this.projects.values()).flatMap((project) =>
      structuredClone(project.agentJobs)
    );
  }

  async enqueueAgentJob(input: {
    projectId: string;
    jobType: AgentJobType;
    inputRef: Record<string, unknown>;
  }): Promise<AgentJobSummary> {
    const project = this.requireProject(input.projectId);
    const job = createAgentJob(input);
    project.agentJobs.push(job);
    return structuredClone(job);
  }

  async completeAgentJob(
    jobId: string,
    output: AgentOutput
  ): Promise<AgentJobSummary | null> {
    const job = Array.from(this.projects.values())
      .flatMap((project) => project.agentJobs)
      .find((candidate) => candidate.id === jobId);
    if (!job) return null;

    job.status = "completed";
    job.output = output;
    job.updatedAt = new Date().toISOString();
    return structuredClone(job);
  }

  async listMemoryCandidates(projectId: string): Promise<MemoryCandidate[]> {
    this.requireProject(projectId);
    return structuredClone(this.memoryCandidates.get(projectId) ?? []);
  }

  async addMemoryCandidate(
    input: Omit<MemoryCandidate, "id" | "createdAt">
  ): Promise<MemoryCandidate> {
    this.requireProject(input.projectId);
    const candidate: MemoryCandidate = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const existing = this.memoryCandidates.get(input.projectId) ?? [];
    existing.push(candidate);
    this.memoryCandidates.set(input.projectId, existing);
    return structuredClone(candidate);
  }

  async confirmHumanGate(
    gateId: string,
    input: ConfirmHumanGateInput
  ): Promise<HumanGateSummary | null> {
    const project = Array.from(this.projects.values()).find((candidate) =>
      candidate.humanGates.some((gate) => gate.id === gateId)
    );
    if (!project) return null;

    const gate = project.humanGates.find((candidate) => candidate.id === gateId);
    if (!gate) return null;

    const now = new Date().toISOString();
    gate.status = "confirmed";
    gate.confirmedBy = input.confirmedBy;
    gate.confirmedAt = now;
    project.auditLogs.push(
      createAuditLog({
        projectId: project.id,
        humanGateId: gate.id,
        actorId: input.confirmedBy,
        action: "human_gate.confirmed",
        targetType: "HumanGate",
        targetId: gate.id,
        createdAt: now
      })
    );
    return structuredClone(gate);
  }

  async getArtifact(artifactId: string): Promise<ArtifactSummary | null> {
    const project = this.findProjectByArtifact(artifactId);
    const artifact = project?.artifacts.find((a) => a.id === artifactId);
    return artifact ? structuredClone(artifact) : null;
  }

  async addEvidence(
    projectId: string,
    input: { sourceId?: string; artifactId?: string; blockId?: string; evidenceType: string; quoteText?: string; pageNumber?: number; confidence?: number }
  ): Promise<EvidenceSummary> {
    this.requireProject(projectId);
    const now = new Date().toISOString();
    const record: EvidenceSummary = {
      id: crypto.randomUUID(),
      projectId,
      sourceId: input.sourceId ?? null,
      artifactId: input.artifactId ?? null,
      blockId: input.blockId ?? null,
      evidenceType: input.evidenceType,
      pageNumber: input.pageNumber ?? null,
      textSpan: null,
      quoteText: input.quoteText ?? null,
      confidence: input.confidence ?? 0,
      responsibilityColor: "gray",
      verificationStatus: "pending",
      createdAt: now
    };
    const existing = this.evidence.get(projectId) ?? [];
    existing.push(record);
    this.evidence.set(projectId, existing);
    return structuredClone(record);
  }

  async listEvidence(projectId: string): Promise<EvidenceSummary[]> {
    this.requireProject(projectId);
    return structuredClone(this.evidence.get(projectId) ?? []);
  }

  async addCapsule(
    projectId: string,
    input: { title: string; capsuleType?: string; summary: string; reusableStructureJson?: Record<string, unknown>; reusableTasksJson?: Record<string, unknown>[]; keyEvidenceIds?: string[]; privacyScope?: string }
  ): Promise<KnowledgeCapsuleSummary> {
    const project = this.requireProject(projectId);
    const now = new Date().toISOString();
    const record: KnowledgeCapsuleSummary = {
      id: crypto.randomUUID(),
      projectId,
      workspaceId: project.workspaceId,
      ownerId: project.ownerId,
      title: input.title,
      capsuleType: input.capsuleType ?? "workflow_pattern",
      summary: input.summary,
      privacyScope: input.privacyScope ?? "project",
      reuseCount: 0,
      createdAt: now
    };
    const existing = this.capsules.get(projectId) ?? [];
    existing.push(record);
    this.capsules.set(projectId, existing);
    return structuredClone(record);
  }

  async listCapsules(projectId: string): Promise<KnowledgeCapsuleSummary[]> {
    this.requireProject(projectId);
    return structuredClone(this.capsules.get(projectId) ?? []);
  }

  async createVersion(input: { entityType: string; entityId: string; projectId: string; snapshotJson: Record<string, unknown>; createdBy: string; createdReason?: string }): Promise<VersionSummary> {
    this.requireProject(input.projectId);
    const key = `${input.entityType}:${input.entityId}`;
    const existing = this.versions.get(key) ?? [];
    const now = new Date().toISOString();

    let diffJson: Record<string, unknown> | null = null;
    if (existing.length > 0) {
      const previous = existing[existing.length - 1]!;
      diffJson = computeDiff(previous.snapshotJson, input.snapshotJson);
    }

    const version: VersionSummary = {
      id: crypto.randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId,
      snapshotJson: structuredClone(input.snapshotJson),
      diffJson,
      createdBy: input.createdBy,
      createdReason: input.createdReason ?? "",
      createdAt: now,
    };

    existing.push(version);
    this.versions.set(key, existing);
    return structuredClone(version);
  }

  async listVersions(entityType: string, entityId: string): Promise<VersionSummary[]> {
    const key = `${entityType}:${entityId}`;
    const existing = this.versions.get(key) ?? [];
    return structuredClone(existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getVersion(versionId: string): Promise<VersionSummary | null> {
    for (const versions of this.versions.values()) {
      const found = versions.find((v) => v.id === versionId);
      if (found) return structuredClone(found);
    }
    return null;
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
      createdReason: `rollback_to_${versionId}`,
    });
  }

  async addMentorFeedback(projectId: string, input: { sourceType: string; sourceId?: string; rawContent: string; feedbackType?: string }): Promise<MentorFeedbackSummary> {
    this.requireProject(projectId);
    const now = new Date().toISOString();
    const actionItems = parseRawContentToActionItems(input.rawContent);
    const record: MentorFeedbackSummary = {
      id: crypto.randomUUID(),
      projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      rawContent: input.rawContent,
      feedbackType: input.feedbackType ?? "general",
      actionItems,
      bindingStatus: "unbound",
      boundArtifactId: null,
      boundBlockId: null,
      boundTaskId: null,
      resolutionStatus: "pending",
      resolvedBy: null,
      resolvedAt: null,
      mentorPreference: {},
      createdAt: now,
    };
    const existing = this.mentorFeedback.get(projectId) ?? [];
    existing.push(record);
    this.mentorFeedback.set(projectId, existing);
    return structuredClone(record);
  }

  async listMentorFeedback(projectId: string): Promise<MentorFeedbackSummary[]> {
    this.requireProject(projectId);
    return structuredClone(this.mentorFeedback.get(projectId) ?? []);
  }

  async bindFeedbackItem(feedbackId: string, input: { actionItemId: string; entityType: string; entityId: string }): Promise<MentorFeedbackSummary | null> {
    for (const [projectId, items] of this.mentorFeedback) {
      const feedback = items.find((f) => f.id === feedbackId);
      if (!feedback) continue;

      const actionItem = feedback.actionItems.find((a) => a.id === input.actionItemId);
      if (!actionItem) return null;

      actionItem.boundEntityType = input.entityType;
      actionItem.boundEntityId = input.entityId;
      actionItem.status = "bound";

      if (input.entityType === "artifact") {
        feedback.boundArtifactId = input.entityId;
      } else if (input.entityType === "block") {
        feedback.boundBlockId = input.entityId;
      } else if (input.entityType === "task") {
        feedback.boundTaskId = input.entityId;
      }

      const anyBound = feedback.actionItems.some((a) => a.status === "bound");
      feedback.bindingStatus = anyBound ? "partially_bound" : "unbound";
      const allBound = feedback.actionItems.every((a) => a.status === "bound" || a.status === "resolved");
      if (allBound) feedback.bindingStatus = "fully_bound";

      this.mentorFeedback.set(projectId, [...items]);
      return structuredClone(feedback);
    }
    return null;
  }

  async resolveFeedbackItem(feedbackId: string, input: { resolvedBy: string }): Promise<MentorFeedbackSummary | null> {
    for (const [projectId, items] of this.mentorFeedback) {
      const feedback = items.find((f) => f.id === feedbackId);
      if (!feedback) continue;

      const now = new Date().toISOString();
      feedback.resolutionStatus = "resolved";
      feedback.resolvedBy = input.resolvedBy;
      feedback.resolvedAt = now;
      for (const actionItem of feedback.actionItems) {
        if (actionItem.status !== "bound") {
          actionItem.status = "resolved";
        } else {
          actionItem.status = "resolved";
        }
      }

      this.mentorFeedback.set(projectId, [...items]);
      return structuredClone(feedback);
    }
    return null;
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<ProjectSummary | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = status;
    project.auditLogs.push(
      createAuditLog({
        projectId,
        actorId: "system",
        action: `project.status_changed_to_${status}`,
        targetType: "Project",
        targetId: projectId,
        createdAt: new Date().toISOString()
      })
    );
    return toProjectSummary(project);
  }

  private requireProject(projectId: string): MutableProject {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new NotFoundError("Project", projectId);
    }

    return project;
  }

  private findProjectByArtifact(artifactId: string): MutableProject | null {
    return (
      Array.from(this.projects.values()).find((project) =>
        project.artifacts.some((artifact) => artifact.id === artifactId)
      ) ?? null
    );
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}

function toProjectSummary(project: ProjectDetail): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    status: project.status,
    riskLevel: project.riskLevel,
    nextAction: project.nextAction,
    dueDate: project.dueDate
  };
}

function createAuditLog(input: {
  projectId: string | null;
  humanGateId?: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
}): AuditLogSummary {
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    humanGateId: input.humanGateId ?? null,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    createdAt: input.createdAt
  };
}

function createAgentJob(input: {
  projectId: string;
  jobType: AgentJobType;
  inputRef: Record<string, unknown>;
}): AgentJobSummary {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    jobType: input.jobType,
    status: "queued",
    inputRef: input.inputRef,
    output: null,
    errorCode: null,
    traceId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
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
    .split(/[。！？.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.map((content) => ({
    id: crypto.randomUUID(),
    content,
    boundEntityType: null,
    boundEntityId: null,
    status: "pending",
  }));
}
