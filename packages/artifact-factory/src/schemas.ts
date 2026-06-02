import { z } from "zod";
import { ResponsibilityColorSchema } from "@zhixu/core";

export const StyleTripleSchema = z.object({
  designStyle: z.enum(["classic", "modern", "minimalist", "vibrant", "ink_chinese", "infographic", "dashboard", "ultra_minimal"]),
  colorTone: z.enum(["warm", "cool", "neutral", "vivid", "muted", "monochrome"]),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(2).max(6),
  typography: z.object({
    heading: z.string(),
    body: z.string(),
    monospace: z.string().optional()
  })
});

export const SlideInputSchema = z.object({
  title: z.string().min(1),
  objective: z.string().optional(),
  layoutType: z.enum(["title", "content", "two_column", "image_focus", "comparison", "data_highlight", "section", "closing", "blank"]).default("content"),
  contentBlocks: z.array(z.object({
    type: z.enum(["text", "bullet_list", "image_placeholder", "table_placeholder"]),
    text: z.string(),
    imageUrl: z.string().optional(),
    responsibilityColor: ResponsibilityColorSchema.default("gray")
  })),
  speakerNotes: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([])
});

export const PptExportInputSchema = z.object({
  title: z.string().min(1),
  slides: z.array(SlideInputSchema).min(1),
  brandTheme: z.enum(["academic_navy", "paper_white"]).default("academic_navy"),
  styleTriple: StyleTripleSchema.optional()
});

export type SlideInput = z.infer<typeof SlideInputSchema>;
export type PptExportInput = z.infer<typeof PptExportInputSchema>;
export type StyleTriple = z.infer<typeof StyleTripleSchema>;

export const ImageTriggerReasonSchema = z.enum([
  "cover_needs_visual_anchor",
  "concept_benefits_from_visual",
  "data_needs_chart",
  "comparison_needs_diagram",
  "process_needs_flowchart",
  "method_needs_architecture",
  "result_needs_visualization",
  "section_needs_transition_visual",
  "closing_needs_thematic_close",
  "text_heavy_needs_relief",
  "source_figure_available",
  "user_explicitly_requested"
]);

export const PromptStrategySchema = z.object({
  basePrompt: z.string(),
  styleInjection: z.string(),
  contentAnchors: z.array(z.string()),
  negativePrompt: z.string(),
  aspectRatio: z.string(),
  quality: z.enum(["draft", "standard", "high"])
});

export const ImageSlotIntentSchema = z.object({
  slotType: z.enum(["hero", "supporting", "icon", "background", "chart"]),
  triggerReason: ImageTriggerReasonSchema,
  promptStrategy: PromptStrategySchema,
  required: z.boolean(),
  fallbackIfFailed: z.enum(["skip", "placeholder_text", "redesign_layout"])
});

export const ImageIntentSchema = z.object({
  slideId: z.string(),
  needsImage: z.boolean(),
  confidence: z.number().min(0).max(1),
  slots: z.array(ImageSlotIntentSchema),
  reasoning: z.string()
});

export const StylePresetSchema = z.object({
  id: z.string(),
  nameZh: z.string(),
  scenario: z.enum(["course_presentation", "lab_meeting"]),
  designStyleId: z.number().int().min(0),
  colorToneId: z.number().int().min(0),
  primaryColorId: z.number().int().min(0)
});

export type ImageTriggerReason = z.infer<typeof ImageTriggerReasonSchema>;
export type PromptStrategy = z.infer<typeof PromptStrategySchema>;
export type ImageSlotIntent = z.infer<typeof ImageSlotIntentSchema>;
export type ImageIntent = z.infer<typeof ImageIntentSchema>;
export type StylePreset = z.infer<typeof StylePresetSchema>;

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
