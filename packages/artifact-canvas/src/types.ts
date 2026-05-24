import { z } from "zod";
import { ResponsibilityColorSchema, RiskLevelSchema } from "@zhixu/core";

export const CanvasBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["heading", "paragraph", "bullet_list", "table", "figure", "citation", "formula", "checklist", "slide", "code", "quote", "image_placeholder"]),
  content: z.string(),
  level: z.number().int().min(1).max(6).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  orderIndex: z.number().int().min(0),
  parentId: z.string().nullable().optional(),
  children: z.array(z.lazy(() => CanvasBlockSchema)).default([]),
  responsibilityColor: ResponsibilityColorSchema.default("gray"),
  verificationStatus: z.enum(["unverified", "pending", "verified", "rejected"]).default("unverified"),
  evidenceRefs: z.array(z.string()).default([]),
  comments: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    text: z.string(),
    createdAt: z.string()
  })).default([]),
  versionId: z.string().optional(),
  isStreaming: z.boolean().default(false)
});

export const CanvasDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  artifactId: z.string(),
  title: z.string(),
  blocks: z.array(CanvasBlockSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const CanvasOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("insert_block"), blockId: z.string(), afterBlockId: z.string().nullable(), block: CanvasBlockSchema }),
  z.object({ type: z.literal("update_block"), blockId: z.string(), updates: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("delete_block"), blockId: z.string() }),
  z.object({ type: z.literal("move_block"), blockId: z.string(), afterBlockId: z.string().nullable() }),
  z.object({ type: z.literal("bind_evidence"), blockId: z.string(), evidenceId: z.string() }),
  z.object({ type: z.literal("set_responsibility"), blockId: z.string(), color: ResponsibilityColorSchema }),
  z.object({ type: z.literal("add_comment"), blockId: z.string(), comment: z.object({ id: z.string(), userId: z.string(), text: z.string(), createdAt: z.string() }) }),
  z.object({ type: z.literal("start_streaming"), blockId: z.string() }),
  z.object({ type: z.literal("append_streaming"), blockId: z.string(), content: z.string() }),
  z.object({ type: z.literal("end_streaming"), blockId: z.string() })
]);

export type CanvasBlock = z.infer<typeof CanvasBlockSchema>;
export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>;
export type CanvasOperation = z.infer<typeof CanvasOperationSchema>;
