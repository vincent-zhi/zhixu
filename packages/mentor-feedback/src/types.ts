import { z } from "zod";
import { RiskLevelSchema } from "@zhixu/core";

export const FeedbackItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceType: z.enum(["text", "word_annotation", "pdf_annotation", "ppt_annotation", "meeting_notes", "handwritten"]),
  rawContent: z.string(),
  mentorId: z.string().optional(),
  createdAt: z.string()
});

export const RectificationItemSchema = z.object({
  id: z.string(),
  feedbackItemId: z.string(),
  projectId: z.string(),
  description: z.string(),
  boundEntityType: z.enum(["artifact_block", "slide", "task", "experiment_step", "citation"]),
  boundEntityId: z.string().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "deferred"]),
  priority: z.number().int().min(1).max(5).default(3),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  versionAfterFix: z.string().nullable()
});

export const MentorPreferenceSchema = z.object({
  mentorId: z.string(),
  preferences: z.array(z.object({
    category: z.string(),
    preference: z.string(),
    frequency: z.number().int().min(1),
    lastSeenAt: z.string()
  }))
});

export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;
export type RectificationItem = z.infer<typeof RectificationItemSchema>;
export type MentorPreference = z.infer<typeof MentorPreferenceSchema>;
