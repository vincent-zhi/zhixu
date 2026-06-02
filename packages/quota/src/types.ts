import { z } from "zod";

export const QuotaTypeSchema = z.enum([
  "file_parse",
  "long_context_call",
  "export",
  "skill_invocation",
  "model_call",
  "storage"
]);

export const QuotaLimitSchema = z.object({
  quotaType: QuotaTypeSchema,
  usedAmount: z.number().default(0),
  limitAmount: z.number().default(0),
  resetAt: z.string().nullable(),
  planType: z.enum(["free", "student_pro", "research_pro", "lab", "campus"]).default("free")
});

export const QuotaCheckResultSchema = z.object({
  allowed: z.boolean(),
  quotaType: QuotaTypeSchema,
  remaining: z.number(),
  usedAmount: z.number(),
  limitAmount: z.number(),
  degradationOptions: z.array(z.object({
    label: z.string(),
    description: z.string(),
    savingsPercent: z.number()
  }))
});

export type QuotaType = z.infer<typeof QuotaTypeSchema>;
export type QuotaLimit = z.infer<typeof QuotaLimitSchema>;
export type QuotaCheckResult = z.infer<typeof QuotaCheckResultSchema>;
export type QuotaUsage = QuotaLimit;
