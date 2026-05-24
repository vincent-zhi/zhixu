import { z } from "zod";
import { ResponsibilityColorSchema } from "@zhixu/core";

export const PaperMatrixSchema = z.object({
  sourceId: z.string(),
  problem: z.string(),
  method: z.string(),
  data: z.string(),
  metrics: z.string(),
  mainResults: z.string(),
  limitations: z.string(),
  futureWork: z.string(),
  relevanceToProject: z.string().optional(),
  responsibilityColor: ResponsibilityColorSchema
});

export const ComparisonMatrixSchema = z.object({
  projectId: z.string(),
  papers: z.array(PaperMatrixSchema),
  methodCategories: z.array(z.string()),
  timeline: z.array(z.object({ year: z.number(), event: z.string() })),
  controversies: z.array(z.object({ topic: z.string(), positions: z.array(z.object({ sourceId: z.string(), position: z.string() })) })),
  researchGaps: z.array(z.string()),
  suggestedOutline: z.array(z.object({ section: z.string(), keyPoints: z.array(z.string()) }))
});

export type PaperMatrix = z.infer<typeof PaperMatrixSchema>;
export type ComparisonMatrix = z.infer<typeof ComparisonMatrixSchema>;
