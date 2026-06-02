import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "captured",
  "understanding",
  "planned",
  "preparing",
  "waiting_user",
  "executing",
  "verifying",
  "ready_to_deliver",
  "tracking",
  "completed",
  "archived",
  "risk",
  "failed"
]);

export const RiskLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);
export const ResponsibilityColorSchema = z.enum(["green", "yellow", "gray"]);
export const VerificationStatusSchema = z.enum([
  "unverified",
  "pending",
  "verified",
  "rejected"
]);

export const ProjectTypeSchema = z.enum([
  "coursework",
  "presentation",
  "paper_reading",
  "literature_review",
  "exam_review",
  "experiment",
  "research",
  "other"
]);

export const CreateProjectInputSchema = z.object({
  workspaceId: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  type: ProjectTypeSchema.default("other"),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.number().int().min(0).max(5).default(3),
  privacyMode: z.enum(["cloud", "local_first", "private_org"]).default("local_first"),
  riskLevel: RiskLevelSchema.default("L1")
});

export const CreateSourceInputSchema = z.object({
  uploadedBy: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().min(1).max(120),
  storageUri: z.string().trim().min(1),
  sensitivityLevel: z.string().trim().min(1).default("normal")
});

export const CreateTaskInputSchema = z.object({
  parentTaskId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  assigneeType: z.enum(["ai", "human", "human_ai", "system"]).default("human_ai"),
  responsibilityLabel: z.string().trim().min(1).default("human_gate"),
  priority: z.number().int().min(0).max(5).default(3),
  dueAt: z.coerce.date().optional(),
  riskLevel: RiskLevelSchema.default("L1")
});

export const CreateHumanGateInputSchema = z.object({
  gateType: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1000),
  riskLevel: RiskLevelSchema.default("L2")
});

export const ConfirmHumanGateInputSchema = z.object({
  confirmedBy: z.string().trim().min(1)
});

export const CreateArtifactInputSchema = z.object({
  projectId: z.string().min(1),
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  firstBlock: z
    .object({
      blockType: z.string().trim().min(1).max(80),
      contentJson: z.record(z.string(), z.unknown()).default({}),
      createdBy: z.string().trim().min(1)
    })
    .optional()
});

export const UpdateArtifactBlockInputSchema = z.object({
  contentJson: z.record(z.string(), z.unknown()),
  responsibilityColor: ResponsibilityColorSchema,
  verificationStatus: VerificationStatusSchema,
  updatedBy: z.string().trim().min(1)
});

export const AgentJobTypeSchema = z.enum([
  "parse_source",
  "build_index",
  "generate_summary",
  "detect_task",
  "generate_plan",
  "verify_output",
  "export_artifact",
  "create_capsule"
]);

export const AgentJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "waiting_human"
]);

export const ModelCostEstimateSchema = z.object({
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedUsd: z.number().nonnegative()
});

export const AgentOutputSchema = z.object({
  outputType: z.string(),
  structuredResult: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  requiredConfirmations: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  riskFlags: z.array(z.string()),
  nextActions: z.array(z.string()),
  costEstimate: ModelCostEstimateSchema
});

export const AgentJobSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  jobType: AgentJobTypeSchema,
  status: AgentJobStatusSchema,
  inputRef: z.record(z.string(), z.unknown()),
  output: AgentOutputSchema.nullable(),
  errorCode: z.string().nullable(),
  traceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const GeneratePlanInputSchema = z.object({
  goal: z.string().trim().min(1).max(1000)
});

export const VerifyOutputInputSchema = z.object({
  outputType: z.string().trim().min(1),
  text: z.string().trim().min(1),
  evidenceRefs: z.array(z.string()).default([])
});

export const ProjectSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  riskLevel: RiskLevelSchema,
  nextAction: z.string(),
  dueDate: z.string().nullable()
});

export const SourceSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  uploadedBy: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  storageUri: z.string(),
  parseStatus: z.string(),
  ocrStatus: z.string(),
  indexStatus: z.string(),
  sensitivityLevel: z.string(),
  createdAt: z.string()
});

export const TaskSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentTaskId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  assigneeType: z.string(),
  responsibilityLabel: z.string(),
  status: z.string(),
  priority: z.number(),
  dueAt: z.string().nullable(),
  riskLevel: RiskLevelSchema,
  createdAt: z.string()
});

export const ArtifactBlockSummarySchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  parentBlockId: z.string().nullable(),
  blockType: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  orderIndex: z.number(),
  responsibilityColor: ResponsibilityColorSchema,
  verificationStatus: VerificationStatusSchema,
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ArtifactSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  title: z.string(),
  status: z.string(),
  exportStatus: z.string(),
  evidenceCoverage: z.number(),
  blocks: z.array(ArtifactBlockSummarySchema),
  createdAt: z.string()
});

export const HumanGateSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  gateType: z.string(),
  reason: z.string(),
  riskLevel: RiskLevelSchema,
  status: z.string(),
  confirmedBy: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  createdAt: z.string()
});

export const AuditLogSummarySchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  humanGateId: z.string().nullable(),
  actorId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  createdAt: z.string()
});

export const ProjectDetailSchema = ProjectSummarySchema.extend({
  workspaceId: z.string(),
  ownerId: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  privacyMode: z.string(),
  sources: z.array(SourceSummarySchema),
  tasks: z.array(TaskSummarySchema),
  artifacts: z.array(ArtifactSummarySchema),
  humanGates: z.array(HumanGateSummarySchema),
  agentJobs: z.array(AgentJobSummarySchema),
  auditLogs: z.array(AuditLogSummarySchema)
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional()
  })
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ResponsibilityColor = z.infer<typeof ResponsibilityColorSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type CreateSourceInput = z.infer<typeof CreateSourceInputSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type CreateHumanGateInput = z.infer<typeof CreateHumanGateInputSchema>;
export type ConfirmHumanGateInput = z.infer<typeof ConfirmHumanGateInputSchema>;
export type CreateArtifactInput = z.infer<typeof CreateArtifactInputSchema>;
export type UpdateArtifactBlockInput = z.infer<typeof UpdateArtifactBlockInputSchema>;
export type AgentJobType = z.infer<typeof AgentJobTypeSchema>;
export type AgentJobStatus = z.infer<typeof AgentJobStatusSchema>;
export type ModelCostEstimate = z.infer<typeof ModelCostEstimateSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export type AgentJobSummary = z.infer<typeof AgentJobSummarySchema>;
export type GeneratePlanInput = z.infer<typeof GeneratePlanInputSchema>;
export type VerifyOutputInput = z.infer<typeof VerifyOutputInputSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type SourceSummary = z.infer<typeof SourceSummarySchema>;
export type TaskSummary = z.infer<typeof TaskSummarySchema>;
export type ArtifactBlockSummary = z.infer<typeof ArtifactBlockSummarySchema>;
export type ArtifactSummary = z.infer<typeof ArtifactSummarySchema>;
export type HumanGateSummary = z.infer<typeof HumanGateSummarySchema>;
export type AuditLogSummary = z.infer<typeof AuditLogSummarySchema>;

export const WorkflowIntentSchema = z.enum(["course_presentation", "lab_meeting", "general"]);

export const AgentPhaseSchema = z.enum([
  "task_capture",
  "understanding",
  "planning",
  "decision",
  "source_parsing",
  "paper_reading",
  "matrix_generation",
  "outline_generation",
  "content_generation",
  "speaker_notes",
  "verification",
  "human_gate",
  "export_ready",
  "dispatching",
  "reflection",
  "completed"
]);

export const AgentStatusSchema = z.enum(["idle", "working", "waiting", "completed", "failed"]);

export const PresentationBriefSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  deliverableType: z.enum(["course_ppt", "lab_meeting", "exam_review"]),
  presentationDuration: z.number(),
  deadline: z.string().nullable(),
  targetAudience: z.string(),
  sourceIds: z.array(z.string()),
  missingInfo: z.array(z.string()),
  detectedCourseName: z.string().nullable(),
  requiresSpeakerNotes: z.boolean().default(true),
  requiresEnglish: z.boolean().default(false),
  pageRequirement: z.number().nullable()
});

export const DecisionCardOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tradeoff: z.string(),
  estimatedUserTime: z.string(),
  riskLevel: RiskLevelSchema,
  qualityCeiling: z.number().min(1).max(10),
  isRecommended: z.boolean()
});

export const DecisionCardSetSchema = z.object({
  type: z.literal("decision_cards"),
  title: z.string(),
  recommendedOptionId: z.string(),
  options: z.array(DecisionCardOptionSchema)
});

export const TopicCandidateExtendedSchema = z.object({
  id: z.string(),
  title: z.string(),
  angle: z.string(),
  targetAudience: z.string(),
  estimatedSlides: z.number().int().min(5).max(30),
  sourceCoverage: z.number().min(0).max(1),
  difficultyLevel: z.enum(["easy", "medium", "hard"]),
  errorRisk: z.string(),
  canFillDuration: z.boolean(),
  recommendationReason: z.string(),
  riskLevel: RiskLevelSchema
});

export const SlidePlanSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int().min(0),
  title: z.string(),
  objective: z.string(),
  keyPoints: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  responsibilityColor: ResponsibilityColorSchema,
  speakerNotes: z.string(),
  estimatedDurationSeconds: z.number(),
  layoutType: z.enum(["title", "content", "two_column", "image_focus", "comparison", "data_highlight", "section", "closing", "blank"]),
  status: z.enum(["proposed", "confirmed", "generating", "completed", "needs_revision"])
});

export const SpeakerNotesSchema = z.object({
  slideId: z.string(),
  spokenText: z.string(),
  estimatedDurationSeconds: z.number(),
  pacingWarning: z.string().nullable(),
  keyTransition: z.string()
});

export const PaperCardSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  projectId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number(),
  venue: z.string(),
  doi: z.string().nullable(),
  researchQuestion: z.string(),
  backgroundMotivation: z.string(),
  methodFramework: z.string(),
  dataset: z.string(),
  metricsAndResults: z.string(),
  mainContributions: z.string(),
  limitations: z.string(),
  reproducibility: z.string(),
  keyFigures: z.array(z.string()),
  references: z.array(z.string()),
  evidencePageNumbers: z.record(z.string(), z.array(z.number())),
  responsibilityColor: ResponsibilityColorSchema
});

export const PaperComparisonMatrixSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  papers: z.array(PaperCardSchema),
  comparisonFields: z.array(z.object({
    field: z.string(),
    values: z.record(z.string(), z.string())
  })),
  methodCategories: z.array(z.string()),
  timeline: z.array(z.object({ year: z.number(), event: z.string() })),
  controversies: z.array(z.object({
    topic: z.string(),
    positions: z.array(z.object({ sourceId: z.string(), position: z.string() }))
  })),
  researchGaps: z.array(z.string()),
  suggestedOutline: z.array(z.object({ section: z.string(), keyPoints: z.array(z.string()) }))
});

export const PresentationPathSchema = z.object({
  id: z.string(),
  pathType: z.enum(["deep_dive", "comparison", "evolution"]),
  title: z.string(),
  description: z.string(),
  suitableScenario: z.string(),
  estimatedSlides: z.number(),
  estimatedDuration: z.number(),
  focusPapers: z.array(z.string()),
  outlineSections: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  isRecommended: z.boolean()
});

export const AdvisorQuestionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  question: z.string(),
  category: z.enum(["method", "data", "result", "reproducibility", "extension", "weakness"]),
  relatedSourceIds: z.array(z.string()),
  suggestedAnswer: z.string(),
  difficultyLevel: z.enum(["basic", "intermediate", "challenging"]),
  evidenceRefs: z.array(z.string())
});

export const EvidenceCoverageReportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  artifactId: z.string(),
  totalClaims: z.number(),
  greenClaims: z.number(),
  yellowClaims: z.number(),
  grayClaims: z.number(),
  greenRatio: z.number(),
  yellowRatio: z.number(),
  grayRatio: z.number(),
  unverifiedCitations: z.number(),
  highRiskItems: z.array(z.string())
});

export const ProgressDetailSchema = z.object({
  label: z.string(),
  status: z.enum(["completed", "in_progress", "queued", "failed", "skipped"]),
  detail: z.string(),
  percentage: z.number().min(0).max(100)
});

export const ThinkingEntrySchema = z.object({
  timestamp: z.string(),
  type: z.enum(["decision", "observation", "plan", "error"]),
  content: z.string(),
  relatedEvidence: z.array(z.string()).optional()
});

export const AgentProcessCardSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  agentIcon: z.string(),
  agentRole: z.string(),
  status: AgentStatusSchema,
  currentTask: z.string(),
  progress: z.array(ProgressDetailSchema),
  inputFrom: z.array(z.string()),
  outputTo: z.array(z.string()),
  thinkingLog: z.array(ThinkingEntrySchema),
  startedAt: z.string(),
  estimatedCompletion: z.string().nullable()
});

export const AgentProcessUpdateSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  status: AgentStatusSchema,
  currentTask: z.string(),
  progress: z.array(ProgressDetailSchema),
  outputPreview: z.record(z.string(), z.unknown()).optional()
});

export const CollaborationSnapshotSchema = z.object({
  agents: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    status: AgentStatusSchema
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    dataType: z.string()
  })),
  bottleneck: z.string().nullable(),
  elapsedTime: z.number(),
  estimatedRemaining: z.number().nullable()
});

export const CanvasPatchSchema = z.object({
  artifactId: z.string(),
  operation: z.enum(["upsert_block", "delete_block", "update_block", "bind_evidence", "set_responsibility"]),
  blockType: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  evidenceRefs: z.array(z.string()),
  responsibilityColor: ResponsibilityColorSchema,
  orderIndex: z.number().optional()
});

export const AgentSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workflowIntent: WorkflowIntentSchema,
  currentPhase: AgentPhaseSchema,
  brief: PresentationBriefSchema.nullable(),
  selectedDecision: z.string().nullable(),
  canvasState: z.record(z.string(), z.unknown()),
  progressEvents: z.array(z.object({
    phase: AgentPhaseSchema,
    message: z.string(),
    timestamp: z.string(),
    percentage: z.number()
  })),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type WorkflowIntent = z.infer<typeof WorkflowIntentSchema>;
export type AgentPhase = z.infer<typeof AgentPhaseSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type PresentationBrief = z.infer<typeof PresentationBriefSchema>;
export type DecisionCardOption = z.infer<typeof DecisionCardOptionSchema>;
export type DecisionCardSet = z.infer<typeof DecisionCardSetSchema>;
export type TopicCandidateExtended = z.infer<typeof TopicCandidateExtendedSchema>;
export type SlidePlan = z.infer<typeof SlidePlanSchema>;
export type SpeakerNotes = z.infer<typeof SpeakerNotesSchema>;
export type PaperCard = z.infer<typeof PaperCardSchema>;
export type PaperComparisonMatrix = z.infer<typeof PaperComparisonMatrixSchema>;
export type PresentationPath = z.infer<typeof PresentationPathSchema>;
export type AdvisorQuestion = z.infer<typeof AdvisorQuestionSchema>;
export type EvidenceCoverageReport = z.infer<typeof EvidenceCoverageReportSchema>;
export type ProgressDetail = z.infer<typeof ProgressDetailSchema>;
export type ThinkingEntry = z.infer<typeof ThinkingEntrySchema>;
export type AgentProcessCard = z.infer<typeof AgentProcessCardSchema>;
export type AgentProcessUpdate = z.infer<typeof AgentProcessUpdateSchema>;
export type CollaborationSnapshot = z.infer<typeof CollaborationSnapshotSchema>;
export type CanvasPatch = z.infer<typeof CanvasPatchSchema>;
export type AgentSession = z.infer<typeof AgentSessionSchema>;
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
