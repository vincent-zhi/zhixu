import { z } from "zod";
import { ResponsibilityColorSchema } from "@zhixu/core";

export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["chapter", "concept", "formula", "example", "assignment", "mistake", "question_type"]),
  label: z.string(),
  description: z.string().optional(),
  responsibilityColor: ResponsibilityColorSchema,
  mastery: z.number().min(0).max(1).default(0)
});

export const KnowledgeEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["prerequisite", "similar", "often_confused", "appears_in", "tested_by"])
});

export const CourseKnowledgeGraphSchema = z.object({
  projectId: z.string(),
  nodes: z.array(KnowledgeNodeSchema),
  edges: z.array(KnowledgeEdgeSchema)
});

export const StudyPlanSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  examDate: z.string(),
  totalDays: z.number(),
  dailyTasks: z.array(z.object({
    day: z.number(),
    date: z.string(),
    topics: z.array(z.string()),
    tasks: z.array(z.object({
      type: z.enum(["review", "practice", "self_test", "review_mistakes"]),
      nodeId: z.string(),
      description: z.string(),
      estimatedMinutes: z.number()
    }))
  }))
});

export const QuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["multiple_choice", "fill_blank", "short_answer", "calculation", "true_false"]),
  nodeId: z.string(),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string().optional(),
  difficulty: z.number().min(1).max(5).default(3),
  responsibilityColor: ResponsibilityColorSchema
});

export const MistakeRecordSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  nodeId: z.string(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  attribution: z.enum(["concept_unclear", "formula_misuse", "calculation_error", "misread", "step_missing", "knowledge_confusion"]),
  reviewedAt: z.string(),
  mastered: z.boolean().default(false)
});

export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;
export type KnowledgeEdge = z.infer<typeof KnowledgeEdgeSchema>;
export type CourseKnowledgeGraph = z.infer<typeof CourseKnowledgeGraphSchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type MistakeRecord = z.infer<typeof MistakeRecordSchema>;
