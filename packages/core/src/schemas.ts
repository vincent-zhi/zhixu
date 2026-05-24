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
  privacyMode: z.enum(["cloud", "local_first", "private_org"]).default("cloud"),
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
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
