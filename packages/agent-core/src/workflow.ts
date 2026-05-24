import { AgentJobSummarySchema } from "@zhixu/core";
import { z } from "zod";

export const ProjectEventTypeSchema = z.enum([
  "source_intake_requested",
  "user_goal_submitted",
  "artifact_block_updated",
  "human_gate_confirmed",
  "project_completed"
]);

export const ProjectEventSchema = z.object({
  eventType: ProjectEventTypeSchema,
  actorId: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const WorkflowStepSchema = z.object({
  name: z.string(),
  status: z.enum(["completed", "skipped", "failed"]),
  detail: z.string().optional()
});

export const StewardWorkflowRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  eventType: ProjectEventTypeSchema,
  status: z.enum(["completed", "waiting_human", "failed"]),
  routedTo: z.string(),
  steps: z.array(WorkflowStepSchema),
  agentJobs: z.array(AgentJobSummarySchema),
  requiredConfirmations: z.array(z.string()),
  riskFlags: z.array(z.string()),
  traceId: z.string(),
  createdAt: z.string()
});

export const MemoryCandidateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  memoryType: z.enum(["knowledge_capsule", "user_preference", "mentor_preference"]),
  title: z.string(),
  summary: z.string(),
  reusableStructure: z.record(z.string(), z.unknown()),
  evidenceRefs: z.array(z.string()),
  status: z.enum(["pending_confirmation", "saved", "rejected"]),
  createdAt: z.string()
});

export const SkillDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  description: z.string(),
  permissionScope: z.array(z.string()),
  riskLevel: z.enum(["L0", "L1", "L2", "L3"]),
  runtimeType: z.enum(["native", "workflow", "sandbox", "external_api", "local_only"])
});

export type ProjectEventType = z.infer<typeof ProjectEventTypeSchema>;
export type ProjectEvent = z.infer<typeof ProjectEventSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type StewardWorkflowRun = z.infer<typeof StewardWorkflowRunSchema>;
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export function isSensitiveSourceLevel(level: string): boolean {
  return [
    "unpublished_paper",
    "experiment_data",
    "mentor_feedback",
    "course_internal",
    "personal_identity",
    "confidential"
  ].includes(level);
}
