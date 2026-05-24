import { z } from "zod";
import { ResponsibilityColorSchema } from "@zhixu/core";

export const SlideInputSchema = z.object({
  title: z.string().min(1),
  objective: z.string().optional(),
  layoutType: z.enum(["title", "content", "two_column", "image_focus", "blank"]).default("content"),
  contentBlocks: z.array(z.object({
    type: z.enum(["text", "bullet_list", "image_placeholder", "table_placeholder"]),
    text: z.string(),
    responsibilityColor: ResponsibilityColorSchema.default("gray")
  })),
  speakerNotes: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([])
});

export const PptExportInputSchema = z.object({
  title: z.string().min(1),
  slides: z.array(SlideInputSchema).min(1),
  brandTheme: z.enum(["academic_navy", "paper_white"]).default("academic_navy")
});

export type SlideInput = z.infer<typeof SlideInputSchema>;
export type PptExportInput = z.infer<typeof PptExportInputSchema>;

export const DocSectionSchema = z.object({
  type: z.enum(["heading", "paragraph", "bullet_list", "table", "figure", "citation", "formula"]),
  level: z.number().int().min(1).max(6).optional(),
  text: z.string(),
  responsibilityColor: ResponsibilityColorSchema.default("gray"),
  evidenceRefs: z.array(z.string()).default([])
});

export const DocExportInputSchema = z.object({
  title: z.string().min(1),
  sections: z.array(DocSectionSchema).min(1)
});

export type DocSection = z.infer<typeof DocSectionSchema>;
export type DocExportInput = z.infer<typeof DocExportInputSchema>;

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  responsibilitySummary: {
    green: number;
    yellow: number;
    gray: number;
  };
}
