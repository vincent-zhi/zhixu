export type {
  ThinkingEntry,
  ProgressDetail,
  AgentProcessUpdate,
  AgentProcessCard,
  CollaborationSnapshot
} from "@zhixu/core";

export type {
  PresentationBrief,
  DecisionCardSet,
  DecisionCardOption,
  RiskLevel,
  ResponsibilityColor
} from "@zhixu/core";

export type {
  PaperCard,
  PaperComparisonMatrix,
  PresentationPath,
  AdvisorQuestion
} from "@zhixu/core";

export type {
  SlidePlan,
  SpeakerNotes,
  TopicCandidateExtended
} from "@zhixu/core";

export type {
  CanvasPatch,
  AgentPhase
} from "@zhixu/core";

export interface UnderstandingResult {
  goals: string[];
  deliverables: string[];
  dueDate: string | null;
  sourceScope: string[];
  riskFlags: string[];
  missingInfo: string[];
  sensitiveInfo: string[];
  confidence: number;
}

export interface PlanOption {
  id: string;
  label: string;
  planType: "recommended" | "expedited" | "conservative";
  taskTree: PlanTask[];
  dependencies: PlanDependency[];
  estimatedCompletionProbability: number;
  overtimeRisk: number;
  contentErrorRisk: number;
  sourceGapRisk: number;
  aiInvolvementRatio: number;
  userEffortHours: number;
  qualityCeiling: number;
  applicableScenario: string;
  humanGateNodes: string[];
  skillCandidates: SkillCandidate[];
}

export interface PlanTask {
  id: string;
  title: string;
  assigneeType: "ai" | "human" | "ai_human";
  responsibilityLabel: string;
  estimatedDuration: number;
  dependencies: string[];
  riskLevel: "L0" | "L1" | "L2" | "L3";
}

export interface PlanDependency {
  from: string;
  to: string;
  type: "finish_to_start" | "start_to_start";
}

export interface SkillCandidate {
  skillId: string;
  reason: string;
  riskLevel: string;
}

export interface ThreePlanResult {
  recommended: PlanOption;
  expedited: PlanOption;
  conservative: PlanOption;
  comparisonSummary: string;
}

export interface DispatchResult {
  taskId: string;
  assignedTo: "model" | "skill" | "local_service" | "cloud_service" | "user";
  skillId?: string;
  estimatedCost: number;
  requiresHumanGate: boolean;
}

export interface WorkerResult {
  taskId: string;
  outputType: string;
  structuredResult: Record<string, unknown>;
  confidence: number;
  requiredConfirmations: string[];
  evidenceRefs: string[];
  riskFlags: string[];
  nextActions: string[];
  costEstimate: number;
}

export interface VerificationResult {
  passed: boolean;
  factCheck: CheckResult;
  citationCheck: CheckResult;
  responsibilityCheck: CheckResult;
  formatCheck: CheckResult;
  logicCheck: CheckResult;
  complianceCheck: CheckResult;
  exportIntegrityCheck: CheckResult;
  overallScore: number;
}

export interface CheckResult {
  passed: boolean;
  issues: string[];
  score: number;
}

export interface ReflectionResult {
  defectAttribution: string[];
  knowledgeCapsuleCandidates: string[];
  nextTaskSuggestions: string[];
  improvementAreas: string[];
}

export interface MemoryQuery {
  projectId: string;
  queryType: "preference" | "pattern" | "terminology" | "capsule";
  query: string;
}

export interface MemoryResult {
  items: MemoryItem[];
  relevanceScore: number;
}

export interface MemoryItem {
  id: string;
  type: string;
  content: Record<string, unknown>;
  source: string;
  createdAt: string;
}

export interface PipelineResult {
  understanding: UnderstandingResult;
  plans: ThreePlanResult;
  selectedPlan: PlanOption;
  dispatches: DispatchResult[];
  workerResults: WorkerResult[];
  verificationResults: VerificationResult[];
  reflection: ReflectionResult | null;
}
