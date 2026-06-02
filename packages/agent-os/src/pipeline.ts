import { UnderstandingAgent } from "./understanding.js";
import { PlannerAgent } from "./planner.js";
import { DispatcherAgent } from "./dispatcher.js";
import { WorkerAgent, type WorkerExecutor } from "./worker.js";
import { VerifierAgent } from "./verifier.js";
import { ReflectionEngine } from "./reflection.js";
import { CanvasAgent } from "./canvas-agent.js";
import { AgentRegistry, HarnessEventEmitter, InMemoryCheckpointStore, WorkflowExecutor } from "@zhixu/agent-harness";
import type { WorkflowState } from "@zhixu/agent-harness";
import { registerAgentOsHandlers } from "./workflows/agent-handlers.js";
import { coursePresentationWorkflow, labMeetingWorkflow } from "./workflows/index.js";
import type { UnderstandingResult, PlanOption, DispatchResult, WorkerResult, VerificationResult, ReflectionResult, PipelineResult, ThinkingEntry, AgentProcessUpdate, PresentationBrief, PaperCard, PaperComparisonMatrix, PresentationPath, AdvisorQuestion, SlidePlan, SpeakerNotes, TopicCandidateExtended, DecisionCardSet, CanvasPatch, AgentPhase } from "./types.js";

const MAX_VERIFY_RETRIES = 2;

type ProgressEvent = {
  phase: AgentPhase;
  message: string;
  percentage: number;
};

export type WorkflowResult =
  | { type: "course_presentation"; brief: PresentationBrief; topicCandidates: TopicCandidateExtended[]; slidePlans: SlidePlan[]; speakerNotes: SpeakerNotes[] }
  | { type: "lab_meeting"; brief: PresentationBrief; paperCards: PaperCard[]; comparisonMatrix: PaperComparisonMatrix; presentationPaths: PresentationPath[]; advisorQuestions: AdvisorQuestion[]; slidePlans: SlidePlan[]; speakerNotes: SpeakerNotes[] }
  | { type: "general"; pipelineResult: PipelineResult };

export class AgentPipeline {
  private readonly understandingAgent = new UnderstandingAgent();
  private readonly plannerAgent = new PlannerAgent();
  private readonly dispatcherAgent = new DispatcherAgent();
  private readonly workerAgent = new WorkerAgent();
  private readonly verifierAgent = new VerifierAgent();
  private readonly reflectionEngine = new ReflectionEngine();
  private readonly canvasAgent = new CanvasAgent();

  private pausePoint: AgentPhase | null = null;
  private pendingDecision: string | null = null;
  private currentPhase: AgentPhase = "task_capture";

  private thinkingCallbacks: Array<(entry: ThinkingEntry) => void> = [];
  private progressCallbacks: Array<(event: ProgressEvent) => void> = [];
  private agentStatusCallbacks: Array<(update: AgentProcessUpdate) => void> = [];
  private canvasPatchCallbacks: Array<(patch: CanvasPatch) => void> = [];
  private decisionCallbacks: Array<(cards: DecisionCardSet) => void> = [];

  setExecutor(executor: WorkerExecutor): void {
    this.workerAgent.setExecutor(executor);
  }

  pauseAtPhase(phase: AgentPhase): void {
    this.pausePoint = phase;
    this.pendingDecision = null;
  }

  resume(decision?: string): void {
    this.pendingDecision = decision ?? null;
    this.pausePoint = null;
  }

  getPhase(): AgentPhase {
    return this.currentPhase;
  }

  onThinking(callback: (entry: ThinkingEntry) => void): void {
    this.thinkingCallbacks.push(callback);
  }

  onProgress(callback: (event: ProgressEvent) => void): void {
    this.progressCallbacks.push(callback);
  }

  onAgentStatus(callback: (update: AgentProcessUpdate) => void): void {
    this.agentStatusCallbacks.push(callback);
  }

  onCanvasPatch(callback: (patch: CanvasPatch) => void): void {
    this.canvasPatchCallbacks.push(callback);
  }

  onDecision(callback: (cards: DecisionCardSet) => void): void {
    this.decisionCallbacks.push(callback);
  }

  async runCoursePresentation(input: {
    rawInput: string;
    sources: Array<{ id: string; fileName: string; summary?: string }>;
    dueDate?: string;
    presentationDuration?: number;
  }): Promise<WorkflowResult> {
    this.currentPhase = "task_capture";
    this.emitProgress("task_capture", "捕获任务信息", 5);
    this.emitAgentStatus("task_understanding", "working", "理解用户任务");

    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `用户输入: ${input.rawInput}` });
    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `资料数量: ${input.sources.length}` });

    this.emitProgress("understanding", "分析用户输入与资料", 10);

    if (this.pausePoint === "understanding") {
      const understanding = this.understandingAgent.analyze(input);
      const brief = this.createBriefFromUnderstanding(
        understanding,
        input,
        "course_ppt",
        "老师/同学",
        10
      );
      this.canvasAgent.updateBrief(brief);
      this.flushCanvasPatches();
      this.pendingDecision = "paused";
      this.emitAgentStatus("task_understanding", "waiting", "等待用户确认理解结果");
      return { type: "course_presentation", brief, topicCandidates: [], slidePlans: [], speakerNotes: [] };
    }

    const executor = this.createHarnessExecutor();
    const first = await executor.run(coursePresentationWorkflow, input as Record<string, unknown>);
    const brief = first.state.values["brief"] as PresentationBrief;
    const topicCandidates = (first.state.values["topicCandidates"] as TopicCandidateExtended[]) ?? [];

    this.canvasAgent.updateBrief(brief);
    this.flushCanvasPatches();

    this.emitThinking({ timestamp: new Date().toISOString(), type: "decision", content: `识别为课程PPT场景，时长${brief.presentationDuration}分钟` });

    this.emitProgress("decision", "生成选题方案", 25);
    this.emitAgentStatus("task_understanding", "completed", "任务理解完成");
    this.emitAgentStatus("presentation", "working", "生成选题候选");

    const decisionCards: DecisionCardSet = {
      type: "decision_cards",
      title: "选择汇报方向",
      recommendedOptionId: topicCandidates.find((t) => t.riskLevel === "L0" || t.riskLevel === "L1")?.id ?? topicCandidates[0]?.id ?? "",
      options: topicCandidates.map((tc) => ({
        id: tc.id,
        title: tc.title,
        description: tc.angle,
        tradeoff: `资料覆盖率 ${Math.round(tc.sourceCoverage * 100)}%，${tc.canFillDuration ? "可讲满时长" : "可能不够时长"}`,
        estimatedUserTime: `${tc.estimatedSlides} 页`,
        riskLevel: tc.riskLevel,
        qualityCeiling: tc.riskLevel === "L0" ? 9 : tc.riskLevel === "L1" ? 7 : 5,
        isRecommended: tc.riskLevel === "L0" || tc.riskLevel === "L1"
      }))
    };

    for (const cb of this.decisionCallbacks) {
      cb(decisionCards);
    }

    this.emitThinking({ timestamp: new Date().toISOString(), type: "plan", content: `生成了 ${topicCandidates.length} 个选题方案，推荐: ${decisionCards.recommendedOptionId}` });

    if (this.pausePoint === "decision") {
      this.pendingDecision = "paused";
      this.emitAgentStatus("presentation", "waiting", "等待用户选择汇报方向");
      return { type: "course_presentation", brief, topicCandidates, slidePlans: [], speakerNotes: [] };
    }

    const selectedTopicId = this.pendingDecision ?? decisionCards.recommendedOptionId;
    const resumedState = this.completeHumanGate(first.state, "select_topic", {
      selectedTopicId
    });

    this.emitProgress("outline_generation", "生成 PPT 大纲", 50);
    this.emitAgentStatus("presentation", "working", `基于选题「${selectedTopicId}」生成大纲`);

    const completed = await executor.run(coursePresentationWorkflow, {}, { resumeFrom: resumedState });
    const slidePlans = (completed.state.values["slidePlans"] as SlidePlan[]) ?? [];
    const speakerNotes = (completed.state.values["speakerNotes"] as SpeakerNotes[]) ?? [];

    this.canvasAgent.updateSlidePlans(slidePlans);
    this.flushCanvasPatches();

    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `生成了 ${slidePlans.length} 页大纲` });

    this.emitProgress("speaker_notes", "生成讲稿", 70);
    this.emitAgentStatus("presentation", "working", "生成口语化讲稿");

    this.emitProgress("verification", "检查证据覆盖", 85);
    this.emitAgentStatus("presentation", "working", "检查证据覆盖率");

    this.emitThinking({ timestamp: new Date().toISOString(), type: "decision", content: "证据覆盖率检查完成" });

    this.emitProgress("export_ready", "准备导出", 95);
    this.emitAgentStatus("presentation", "completed", "PPT 生成完成");

    this.emitProgress("completed", "课程 PPT 工作流完成", 100);

    return { type: "course_presentation", brief, topicCandidates, slidePlans, speakerNotes };
  }

  async runLabMeeting(input: {
    rawInput: string;
    sources: Array<{ id: string; fileName: string; summary?: string }>;
    dueDate?: string;
    presentationDuration?: number;
  }): Promise<WorkflowResult> {
    this.currentPhase = "task_capture";
    this.emitProgress("task_capture", "捕获任务信息", 5);
    this.emitAgentStatus("task_understanding", "working", "理解组会汇报任务");

    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `用户输入: ${input.rawInput}` });
    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `论文数量: ${input.sources.length}` });

    this.currentPhase = "understanding";
    this.emitProgress("understanding", "分析用户输入", 10);

    this.currentPhase = "source_parsing";
    this.emitProgress("source_parsing", "解析论文", 20);
    this.emitAgentStatus("source_parsing", "working", `解析 ${input.sources.length} 篇论文`);

    this.currentPhase = "paper_reading";
    this.emitProgress("paper_reading", "论文精读", 30);
    this.emitAgentStatus("source_parsing", "completed", "论文解析完成");
    this.emitAgentStatus("paper_reading", "working", "生成 Paper Cards");

    const executor = this.createHarnessExecutor();
    const first = await executor.run(labMeetingWorkflow, input as Record<string, unknown>);
    const brief = first.state.values["brief"] as PresentationBrief;
    const paperCards = (first.state.values["paperCards"] as PaperCard[]) ?? [];
    const comparisonMatrix = first.state.values["comparisonMatrix"] as PaperComparisonMatrix;
    const presentationPaths = (first.state.values["presentationPaths"] as PresentationPath[]) ?? [];

    this.canvasAgent.updateBrief(brief);
    this.canvasAgent.updatePaperCards(paperCards);
    this.flushCanvasPatches();

    this.emitAgentStatus("paper_reading", "completed", "Paper Cards 生成完成");

    this.currentPhase = "matrix_generation";
    this.emitProgress("matrix_generation", "生成对比矩阵", 50);
    this.emitAgentStatus("paper_reading", "working", "生成多篇论文对比矩阵");

    this.canvasAgent.updateComparisonMatrix(comparisonMatrix);
    this.flushCanvasPatches();

    this.emitThinking({ timestamp: new Date().toISOString(), type: "observation", content: `对比矩阵生成完成，发现 ${comparisonMatrix.researchGaps.length} 个研究空白` });

    this.emitAgentStatus("paper_reading", "completed", "对比矩阵生成完成");

    this.currentPhase = "decision";
    this.emitProgress("decision", "生成汇报路径", 55);
    this.emitAgentStatus("planning", "working", "生成汇报路径选择");

    const decisionCards: DecisionCardSet = {
      type: "decision_cards",
      title: "选择汇报路径",
      recommendedOptionId: presentationPaths.find((p) => p.isRecommended)?.id ?? presentationPaths[0]?.id ?? "",
      options: presentationPaths.map((path) => ({
        id: path.id,
        title: path.title,
        description: path.description,
        tradeoff: path.suitableScenario,
        estimatedUserTime: `约 ${path.estimatedDuration} 分钟`,
        riskLevel: path.riskLevel,
        qualityCeiling: path.riskLevel === "L0" ? 9 : path.riskLevel === "L1" ? 7 : 5,
        isRecommended: path.isRecommended
      }))
    };

    for (const cb of this.decisionCallbacks) {
      cb(decisionCards);
    }

    if (this.pausePoint === "decision") {
      this.pendingDecision = "paused";
      this.emitAgentStatus("planning", "waiting", "等待用户选择汇报路径");
      return { type: "lab_meeting", brief, paperCards, comparisonMatrix, presentationPaths, advisorQuestions: [], slidePlans: [], speakerNotes: [] };
    }

    const selectedPathId = this.pendingDecision ?? decisionCards.recommendedOptionId;
    const resumedState = this.completeHumanGate(first.state, "select_path", {
      selectedPathId
    });

    this.emitAgentStatus("planning", "completed", "汇报路径已选择");

    this.currentPhase = "outline_generation";
    this.emitProgress("outline_generation", "生成 PPT 大纲", 65);
    this.emitAgentStatus("presentation", "working", "生成组会 PPT 大纲");

    const completed = await executor.run(labMeetingWorkflow, {}, { resumeFrom: resumedState });
    const slidePlans = (completed.state.values["slidePlans"] as SlidePlan[]) ?? [];
    const speakerNotes = (completed.state.values["speakerNotes"] as SpeakerNotes[]) ?? [];
    const advisorQuestions = (completed.state.values["advisorQuestions"] as AdvisorQuestion[]) ?? [];

    this.canvasAgent.updateSlidePlans(slidePlans);
    this.flushCanvasPatches();

    this.currentPhase = "speaker_notes";
    this.emitProgress("speaker_notes", "生成讲稿", 75);
    this.emitAgentStatus("presentation", "working", "生成口语化讲稿");

    this.currentPhase = "content_generation";
    this.emitProgress("content_generation", "生成导师问题", 85);
    this.emitAgentStatus("paper_reading", "working", "生成导师可能提问");

    this.canvasAgent.updateAdvisorQuestions(advisorQuestions);
    this.flushCanvasPatches();

    this.emitThinking({ timestamp: new Date().toISOString(), type: "plan", content: `生成了 ${advisorQuestions.length} 个导师可能提问` });

    this.currentPhase = "verification";
    this.emitProgress("verification", "检查证据覆盖", 90);
    this.emitAgentStatus("presentation", "working", "检查证据覆盖率");

    this.currentPhase = "export_ready";
    this.emitProgress("export_ready", "准备导出", 95);
    this.emitAgentStatus("presentation", "completed", "组会 PPT 生成完成");

    this.currentPhase = "completed";
    this.emitProgress("completed", "组会论文汇报工作流完成", 100);

    return { type: "lab_meeting", brief, paperCards, comparisonMatrix, presentationPaths, advisorQuestions, slidePlans, speakerNotes };
  }

  async run(input: {
    rawInput: string;
    sources: Array<{ id: string; fileName: string; summary?: string }>;
    dueDate?: string;
  }): Promise<PipelineResult> {
    this.emitProgress("understanding", "分析用户输入与资料", 10);

    const understanding = this.understandingAgent.analyze(input);

    if (this.pausePoint === "understanding") {
      this.pendingDecision = "paused";
      this.emitAgentStatus("understanding", "waiting", "等待用户确认理解结果");
      return {
        understanding,
        plans: { recommended: {} as PlanOption, expedited: {} as PlanOption, conservative: {} as PlanOption, comparisonSummary: "" },
        selectedPlan: {} as PlanOption,
        dispatches: [],
        workerResults: [],
        verificationResults: [],
        reflection: null
      };
    }

    this.emitProgress("planning", "生成三套方案", 30);

    const plans = this.plannerAgent.generateThreePlans(understanding);

    if (this.pausePoint === "decision") {
      this.pendingDecision = "paused";
      this.emitAgentStatus("planning", "waiting", "等待用户选择方案");
      return {
        understanding,
        plans,
        selectedPlan: {} as PlanOption,
        dispatches: [],
        workerResults: [],
        verificationResults: [],
        reflection: null
      };
    }

    const selectedPlan = plans.recommended;

    this.emitProgress("dispatching", "分配任务执行器", 40);

    const dispatches = this.dispatcherAgent.dispatch(selectedPlan);

    const workerResults: WorkerResult[] = [];
    const verificationResults: VerificationResult[] = [];

    for (const dispatch of dispatches) {
      const task = selectedPlan.taskTree.find((t) => t.id === dispatch.taskId);
      if (!task) continue;

      const context: Record<string, unknown> = {
        taskTitle: task.title,
        taskRiskLevel: task.riskLevel,
        sourceCount: input.sources.length
      };

      this.emitAgentStatus("worker", "working", `执行任务: ${task.title}`);

      const workerResult = await this.workerAgent.execute(dispatch, context);
      workerResults.push(workerResult);

      const verification = this.verifyWithRetry(workerResult, task);
      verificationResults.push(verification);
    }

    this.emitProgress("reflection", "反思与总结", 90);

    const reflection = this.runReflection(selectedPlan, workerResults, verificationResults);

    this.emitProgress("completed", "流水线执行完成", 100);

    return {
      understanding,
      plans,
      selectedPlan,
      dispatches,
      workerResults,
      verificationResults,
      reflection
    };
  }

  private createHarnessExecutor(): WorkflowExecutor {
    const registry = new AgentRegistry();
    registerAgentOsHandlers(registry);
    return new WorkflowExecutor(
      registry,
      new InMemoryCheckpointStore(),
      new HarnessEventEmitter()
    );
  }

  private completeHumanGate(
    state: WorkflowState,
    nodeId: string,
    values: Record<string, unknown>
  ): WorkflowState {
    return {
      ...state,
      values: { ...state.values, ...values },
      completedNodeIds: state.completedNodeIds.includes(nodeId)
        ? state.completedNodeIds
        : [...state.completedNodeIds, nodeId],
      status: "running"
    };
  }

  private createBriefFromUnderstanding(
    understanding: UnderstandingResult,
    input: {
      sources: Array<{ id: string; fileName: string; summary?: string }>;
      dueDate?: string;
      presentationDuration?: number;
    },
    deliverableType: PresentationBrief["deliverableType"],
    targetAudience: string,
    defaultDuration: number
  ): PresentationBrief {
    return {
      id: `brief-${Date.now()}`,
      projectId: "",
      deliverableType,
      presentationDuration: input.presentationDuration ?? defaultDuration,
      deadline: input.dueDate ?? null,
      targetAudience,
      sourceIds: input.sources.map((source) => source.id),
      missingInfo: understanding.missingInfo,
      detectedCourseName: null,
      requiresSpeakerNotes: true,
      requiresEnglish: false,
      pageRequirement: null
    };
  }

  private emitThinking(entry: ThinkingEntry): void {
    for (const cb of this.thinkingCallbacks) {
      cb(entry);
    }
  }

  private emitProgress(phase: AgentPhase, message: string, percentage: number): void {
    this.currentPhase = phase;
    const event: ProgressEvent = { phase, message, percentage };
    for (const cb of this.progressCallbacks) {
      cb(event);
    }
  }

  private emitAgentStatus(agentId: string, status: AgentProcessUpdate["status"], currentTask: string): void {
    const update: AgentProcessUpdate = {
      agentId,
      agentName: agentId,
      status,
      currentTask,
      progress: []
    };
    for (const cb of this.agentStatusCallbacks) {
      cb(update);
    }
  }

  private flushCanvasPatches(): void {
    const patches = this.canvasAgent.getPatches();
    for (const patch of patches) {
      for (const cb of this.canvasPatchCallbacks) {
        cb(patch);
      }
    }
    this.canvasAgent.clearPatches();
  }

  private verifyWithRetry(
    workerResult: WorkerResult,
    task: import("./types.js").PlanTask
  ): VerificationResult {
    let verification = this.verifierAgent.verify(workerResult, task);

    let retries = 0;
    while (!verification.passed && retries < MAX_VERIFY_RETRIES) {
      retries++;
      verification = this.verifierAgent.verify(workerResult, task);
    }

    return verification;
  }

  private runReflection(
    selectedPlan: PlanOption,
    workerResults: WorkerResult[],
    verificationResults: VerificationResult[]
  ): ReflectionResult {
    const tasks = selectedPlan.taskTree.map((t, i) => {
      const verification = verificationResults[i];
      return {
        status: verification?.passed ? "completed" : "failed",
        riskLevel: t.riskLevel
      };
    });

    const artifacts = workerResults.map((wr) => ({
      evidenceCoverage: wr.evidenceRefs.length > 0 ? 0.8 : 0.2
    }));

    return this.reflectionEngine.reflect({ tasks, artifacts });
  }
}

export type { PipelineResult, ProgressEvent };
