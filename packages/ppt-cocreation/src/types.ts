import { z } from "zod";
import { ResponsibilityColorSchema, RiskLevelSchema } from "@zhixu/core";

export const TopicCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  angle: z.string(),
  targetAudience: z.string(),
  estimatedSlides: z.number().int().min(5).max(30),
  sourceCoverage: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema
});

export const SlideOutlineSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int().min(0),
  title: z.string(),
  objective: z.string().optional(),
  layoutType: z.enum(["title", "content", "two_column", "image_focus", "blank"]),
  keyPoints: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  responsibilityColor: ResponsibilityColorSchema,
  speakerNotes: z.string().optional(),
  status: z.enum(["proposed", "confirmed", "generating", "completed", "needs_revision"])
});

export const PPTCoCreationStateSchema = z.object({
  projectId: z.string(),
  currentStep: z.enum(["topic_selection", "outline_generation", "slide_confirmation", "style_selection", "content_generation", "local_edit", "consistency_check", "export_ready"]),
  topicCandidates: z.array(TopicCandidateSchema),
  selectedTopicId: z.string().nullable(),
  slideOutlines: z.array(SlideOutlineSchema),
  selectedStyle: z.enum(["academic_navy", "paper_white", "minimalist", "vibrant"]).nullable(),
  consistencyCheckResult: z.object({
    passed: z.boolean(),
    issues: z.array(z.object({ slideId: z.string(), issue: z.string(), severity: z.enum(["warning", "error"]) }))
  }).nullable()
});

export type TopicCandidate = z.infer<typeof TopicCandidateSchema>;
export type SlideOutline = z.infer<typeof SlideOutlineSchema>;
export type PPTCoCreationState = z.infer<typeof PPTCoCreationStateSchema>;
