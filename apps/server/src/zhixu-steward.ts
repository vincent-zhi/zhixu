import {
  isSensitiveSourceLevel,
  type ProjectEvent,
  type StewardWorkflowRun,
  type WorkflowStep
} from "@zhixu/agent-core";
import {
  CreateSourceInputSchema,
  GeneratePlanInputSchema,
  VerifyOutputInputSchema,
  type AgentJobSummary
} from "@zhixu/core";
import { DocumentPipeline, MockDocumentPipeline } from "./document-pipeline.js";
import type { ModelGateway } from "./model-gateway.js";
import type { ProjectStore } from "./project-store.js";

export class ZhiXuSteward {
  private readonly documentPipeline = new DocumentPipeline();

  constructor(
    private projectStore: ProjectStore,
    private modelGateway: ModelGateway
  ) {}

  setModelGateway(gateway: ModelGateway): void {
    this.modelGateway = gateway;
  }

  async handleProjectEvent(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun | null> {
    const project = await this.projectStore.getProject(projectId);
    if (!project) return null;

    if (event.eventType === "source_intake_requested") {
      return this.handleSourceIntake(projectId, event);
    }

    if (event.eventType === "user_goal_submitted") {
      return this.handleUserGoal(projectId, event);
    }

    if (event.eventType === "human_gate_confirmed") {
      return this.handleHumanGateConfirmed(projectId, event);
    }

    if (event.eventType === "artifact_block_updated") {
      return this.handleArtifactBlockUpdated(projectId, event);
    }

    if (event.eventType === "project_completed") {
      return this.handleProjectCompleted(projectId, event);
    }

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: "completed",
      routedTo: "StewardRouter",
      steps: [
        { name: "gateway.accept_event", status: "completed" },
        { name: "gateway.noop", status: "skipped", detail: "No workflow registered yet" }
      ],
      agentJobs: [],
      requiredConfirmations: [],
      riskFlags: []
    });
  }

  private async handleSourceIntake(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun> {
    const input = CreateSourceInputSchema.parse({
      uploadedBy: event.actorId,
      ...event.payload
    });
    const source = await this.projectStore.addSource(projectId, input);
    const sensitive = isSensitiveSourceLevel(input.sensitivityLevel);
    const steps: WorkflowStep[] = [
      { name: "gateway.accept_event", status: "completed" },
      { name: "source.register", status: "completed" }
    ];
    const requiredConfirmations: string[] = [];
    const riskFlags: string[] = [];

    if (sensitive) {
      await this.projectStore.createHumanGate(projectId, {
        gateType: "sensitive_cloud_processing",
        reason: "Sensitive source requires explicit confirmation before cloud processing.",
        riskLevel: "L2"
      });
      requiredConfirmations.push("sensitive_cloud_processing");
      riskFlags.push("sensitive_source");
      steps.push({
        name: "human_gate.require_sensitive_processing",
        status: "completed"
      });
    }

    const jobs = (await this.projectStore.listAgentJobs()).filter(
      (job) =>
        job.projectId === projectId &&
        job.jobType === "parse_source" &&
        job.inputRef["sourceId"] === source.id
    );

    let returnedJobs = jobs;
    if (sensitive) {
      steps.push({ name: "agent.enqueue_parse_source", status: "completed" });
    } else {
      const output = await this.documentPipeline.parseSource(source);
      returnedJobs = await completeJobs(this.projectStore, jobs, output);
      steps.push(
        { name: "source.parse_with_provider", status: "completed" },
        { name: "evidence.index", status: "completed" }
      );
    }

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: sensitive ? "waiting_human" : "completed",
      routedTo: "SourceAgent",
      steps,
      agentJobs: returnedJobs,
      requiredConfirmations,
      riskFlags
    });
  }

  private async handleUserGoal(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun> {
    const input = GeneratePlanInputSchema.parse(event.payload);
    const project = await this.projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found after preflight: ${projectId}`);
    }

    const job = await this.projectStore.enqueueAgentJob({
      projectId,
      jobType: "generate_plan",
      inputRef: { goal: input.goal }
    });
    const output = await this.modelGateway.generatePlan({
      projectTitle: project.title,
      goal: input.goal
    });
    const completedJob = await this.projectStore.completeAgentJob(job.id, output);
    await this.projectStore.addTask(projectId, {
      title: "Confirm generated plan",
      description: "User must choose recommended, urgent, or conservative plan.",
      assigneeType: "human",
      responsibilityLabel: "plan_selection",
      priority: 3,
      riskLevel: "L1"
    });

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: "completed",
      routedTo: "PlannerAgent",
      steps: [
        { name: "gateway.accept_event", status: "completed" },
        { name: "planner.generate_three_options", status: "completed" },
        { name: "task.create_plan_confirmation", status: "completed" }
      ],
      agentJobs: completedJob ? [completedJob] : [],
      requiredConfirmations: ["plan_selection"],
      riskFlags: output.riskFlags
    });
  }

  private async handleHumanGateConfirmed(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun> {
    const gateId = String(event.payload["gateId"] ?? "");
    await this.projectStore.confirmHumanGate(gateId, { confirmedBy: event.actorId });
    const project = await this.projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found after preflight: ${projectId}`);
    }

    const sourceById = new Map(project.sources.map((source) => [source.id, source]));
    const queuedParseJobs = (await this.projectStore.listAgentJobs()).filter(
      (job) => job.projectId === projectId && job.jobType === "parse_source" && job.status === "queued"
    );
    const completedJobs: AgentJobSummary[] = [];
    for (const job of queuedParseJobs) {
      const sourceId = String(job.inputRef["sourceId"] ?? "");
      const source = sourceById.get(sourceId);
      if (!source) continue;
      const output = await this.documentPipeline.parseSource(source);
      const completed = await this.projectStore.completeAgentJob(job.id, output);
      if (completed) completedJobs.push(completed);
    }

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: "completed",
      routedTo: "WatcherAgent",
      steps: [
        { name: "gateway.accept_event", status: "completed" },
        { name: "human_gate.confirm", status: "completed" },
        { name: "watcher.resume_waiting_jobs", status: "completed" }
      ],
      agentJobs: completedJobs,
      requiredConfirmations: [],
      riskFlags: []
    });
  }

  private async handleArtifactBlockUpdated(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun> {
    const input = VerifyOutputInputSchema.parse({
      outputType: "artifact.block",
      text: event.payload["text"],
      evidenceRefs: event.payload["evidenceRefs"]
    });
    const job = await this.projectStore.enqueueAgentJob({
      projectId,
      jobType: "verify_output",
      inputRef: {
        artifactId: event.payload["artifactId"],
        blockId: event.payload["blockId"],
        evidenceRefs: input.evidenceRefs
      }
    });
    const output = await this.modelGateway.verifyOutput(input);
    const completed = await this.projectStore.completeAgentJob(job.id, output);
    if (output.riskFlags.includes("missing_evidence")) {
      await this.projectStore.createHumanGate(projectId, {
        gateType: "evidence_review",
        reason: "Artifact block has unsupported claims and needs evidence review.",
        riskLevel: "L2"
      });
    }

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: output.requiredConfirmations.length > 0 ? "waiting_human" : "completed",
      routedTo: "VerifierAgent",
      steps: [
        { name: "gateway.accept_event", status: "completed" },
        { name: "verifier.check_evidence", status: "completed" },
        { name: "human_gate.require_evidence_review", status: output.requiredConfirmations.length > 0 ? "completed" : "skipped" }
      ],
      agentJobs: completed ? [completed] : [],
      requiredConfirmations: output.requiredConfirmations,
      riskFlags: output.riskFlags
    });
  }

  private async handleProjectCompleted(
    projectId: string,
    event: ProjectEvent
  ): Promise<StewardWorkflowRun> {
    const summary = String(event.payload["summary"] ?? "Project completed.");
    await this.projectStore.addMemoryCandidate({
      projectId,
      memoryType: "knowledge_capsule",
      title: "Reusable project workflow",
      summary,
      reusableStructure: {
        sourceCount: (await this.projectStore.getProject(projectId))?.sources.length ?? 0,
        taskPattern: "project_intake_to_verified_artifact"
      },
      evidenceRefs: [],
      status: "pending_confirmation"
    });
    await this.projectStore.createHumanGate(projectId, {
      gateType: "save_knowledge_capsule",
      reason: "Knowledge capsule candidates must be user-confirmed before becoming memory.",
      riskLevel: "L2"
    });

    return createWorkflowRun({
      projectId,
      eventType: event.eventType,
      status: "waiting_human",
      routedTo: "ReflectionEngine",
      steps: [
        { name: "gateway.accept_event", status: "completed" },
        { name: "reflection.extract_memory_candidate", status: "completed" },
        { name: "human_gate.require_memory_save", status: "completed" }
      ],
      agentJobs: [],
      requiredConfirmations: ["save_knowledge_capsule"],
      riskFlags: []
    });
  }
}

async function completeJobs(
  projectStore: ProjectStore,
  jobs: AgentJobSummary[],
  output: Awaited<ReturnType<DocumentPipeline["parseSource"]>>
): Promise<AgentJobSummary[]> {
  const completedJobs: AgentJobSummary[] = [];
  for (const job of jobs) {
    const completed = await projectStore.completeAgentJob(job.id, output);
    if (completed) completedJobs.push(completed);
  }

  return completedJobs;
}

function createWorkflowRun(input: {
  projectId: string;
  eventType: ProjectEvent["eventType"];
  status: StewardWorkflowRun["status"];
  routedTo: string;
  steps: WorkflowStep[];
  agentJobs: StewardWorkflowRun["agentJobs"];
  requiredConfirmations: string[];
  riskFlags: string[];
}): StewardWorkflowRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    eventType: input.eventType,
    status: input.status,
    routedTo: input.routedTo,
    steps: input.steps,
    agentJobs: input.agentJobs,
    requiredConfirmations: input.requiredConfirmations,
    riskFlags: input.riskFlags,
    traceId: crypto.randomUUID(),
    createdAt: now
  };
}
