import type { SlidePlan } from "@zhixu/core";
import type {
  ImageIntent,
  ImageSlotIntent,
  ImageTriggerReason,
  PromptStrategy,
  StyleTriple,
} from "./schemas.js";

const LAYOUT_SLOT_RULES: Record<
  SlidePlan["layoutType"],
  Array<{
    slotType: ImageSlotIntent["slotType"];
    triggerReason: ImageTriggerReason;
    required: boolean;
    fallbackIfFailed: ImageSlotIntent["fallbackIfFailed"];
  }>
> = {
  title: [
    { slotType: "hero", triggerReason: "cover_needs_visual_anchor", required: true, fallbackIfFailed: "placeholder_text" },
  ],
  content: [
    { slotType: "supporting", triggerReason: "concept_benefits_from_visual", required: false, fallbackIfFailed: "skip" },
  ],
  two_column: [
    { slotType: "supporting", triggerReason: "concept_benefits_from_visual", required: false, fallbackIfFailed: "skip" },
  ],
  image_focus: [
    { slotType: "hero", triggerReason: "concept_benefits_from_visual", required: true, fallbackIfFailed: "redesign_layout" },
  ],
  comparison: [
    { slotType: "chart", triggerReason: "comparison_needs_diagram", required: false, fallbackIfFailed: "skip" },
  ],
  data_highlight: [
    { slotType: "chart", triggerReason: "data_needs_chart", required: true, fallbackIfFailed: "placeholder_text" },
  ],
  section: [
    { slotType: "background", triggerReason: "section_needs_transition_visual", required: false, fallbackIfFailed: "skip" },
  ],
  closing: [
    { slotType: "hero", triggerReason: "closing_needs_thematic_close", required: false, fallbackIfFailed: "skip" },
  ],
  blank: [],
};

const KEYWORD_TRIGGER_MAP: Array<{
  keywords: string[];
  reason: ImageTriggerReason;
  slotType: ImageSlotIntent["slotType"];
}> = [
  { keywords: ["流程", "步骤", "过程", "pipeline", "workflow"], reason: "process_needs_flowchart", slotType: "chart" },
  { keywords: ["架构", "框架", "系统", "architecture", "framework"], reason: "method_needs_architecture", slotType: "chart" },
  { keywords: ["结果", "实验", "数据", "result", "experiment"], reason: "result_needs_visualization", slotType: "chart" },
  { keywords: ["对比", "比较", "vs", "versus"], reason: "comparison_needs_diagram", slotType: "chart" },
  { keywords: ["图", "figure", "chart", "diagram"], reason: "source_figure_available", slotType: "supporting" },
];

function matchKeywordTriggers(slide: SlidePlan): Array<{
  slotType: ImageSlotIntent["slotType"];
  triggerReason: ImageTriggerReason;
}> {
  const allText = [slide.title, slide.objective, ...slide.keyPoints].join(" ").toLowerCase();
  const matched: Array<{ slotType: ImageSlotIntent["slotType"]; triggerReason: ImageTriggerReason }> = [];
  for (const rule of KEYWORD_TRIGGER_MAP) {
    if (rule.keywords.some((kw) => allText.includes(kw))) {
      matched.push({ slotType: rule.slotType, triggerReason: rule.reason });
    }
  }
  return matched;
}

function computeTextDensity(slide: SlidePlan): number {
  const totalChars = [slide.title, slide.objective, ...slide.keyPoints].join("").length;
  return Math.min(totalChars / 200, 1);
}

function buildPromptStrategy(
  slotType: ImageSlotIntent["slotType"],
  triggerReason: ImageTriggerReason,
  slide: SlidePlan,
  style: StyleTriple
): PromptStrategy {
  const contentAnchors = [slide.title, ...slide.keyPoints.slice(0, 3)];

  const basePromptMap: Record<ImageSlotIntent["slotType"], string> = {
    hero: `A striking visual illustration for a presentation slide titled "${slide.title}"`,
    supporting: `A supporting visual element for the concept "${slide.keyPoints[0] ?? slide.title}"`,
    icon: `A clean icon representing "${slide.title}"`,
    background: `A subtle background pattern for a section divider slide`,
    chart: `A clear data visualization diagram for "${slide.title}"`,
  };

  const styleInjection = `${style.designStyle} style, ${style.colorTone} color tone, primary color ${style.primaryColor}`;

  const negativePromptMap: Record<ImageSlotIntent["slotType"], string> = {
    hero: "blurry, low quality, text overlay, watermark, distorted",
    supporting: "blurry, cluttered, text heavy, watermark",
    icon: "complex, detailed, photographic, blurry, watermark",
    background: "distracting, bright, text, figures, watermark",
    chart: "hand-drawn, sketch, blurry, watermark, decorative",
  };

  const aspectRatioMap: Record<ImageSlotIntent["slotType"], string> = {
    hero: "16:9",
    supporting: "4:3",
    icon: "1:1",
    background: "16:9",
    chart: "4:3",
  };

  const qualityMap: Record<ImageSlotIntent["slotType"], PromptStrategy["quality"]> = {
    hero: "high",
    supporting: "standard",
    icon: "standard",
    background: "draft",
    chart: "standard",
  };

  return {
    basePrompt: basePromptMap[slotType],
    styleInjection,
    contentAnchors,
    negativePrompt: negativePromptMap[slotType],
    aspectRatio: aspectRatioMap[slotType],
    quality: qualityMap[slotType],
  };
}

export function detectImageIntent(slide: SlidePlan, style?: StyleTriple): ImageIntent {
  const layoutRules = LAYOUT_SLOT_RULES[slide.layoutType] ?? [];
  const keywordMatches = matchKeywordTriggers(slide);
  const textDensity = computeTextDensity(slide);

  const slots: ImageSlotIntent[] = [];

  for (const rule of layoutRules) {
    const promptStrategy = buildPromptStrategy(rule.slotType, rule.triggerReason, slide, style ?? {
      designStyle: "modern",
      colorTone: "neutral",
      primaryColor: "#0D1B2F",
      palette: ["#0D1B2F", "#B89B5E"],
      typography: { heading: "Arial", body: "Arial" },
    });
    slots.push({
      slotType: rule.slotType,
      triggerReason: rule.triggerReason,
      promptStrategy,
      required: rule.required,
      fallbackIfFailed: rule.fallbackIfFailed,
    });
  }

  for (const match of keywordMatches) {
    const alreadyHas = slots.some((s) => s.triggerReason === match.triggerReason);
    if (!alreadyHas) {
      const promptStrategy = buildPromptStrategy(match.slotType, match.triggerReason, slide, style ?? {
        designStyle: "modern",
        colorTone: "neutral",
        primaryColor: "#0D1B2F",
        palette: ["#0D1B2F", "#B89B5E"],
        typography: { heading: "Arial", body: "Arial" },
      });
      slots.push({
        slotType: match.slotType,
        triggerReason: match.triggerReason,
        promptStrategy,
        required: false,
        fallbackIfFailed: "skip",
      });
    }
  }

  if (textDensity > 0.7 && !slots.some((s) => s.triggerReason === "text_heavy_needs_relief")) {
    const promptStrategy = buildPromptStrategy("supporting", "text_heavy_needs_relief", slide, style ?? {
      designStyle: "modern",
      colorTone: "neutral",
      primaryColor: "#0D1B2F",
      palette: ["#0D1B2F", "#B89B5E"],
      typography: { heading: "Arial", body: "Arial" },
    });
    slots.push({
      slotType: "supporting",
      triggerReason: "text_heavy_needs_relief",
      promptStrategy,
      required: false,
      fallbackIfFailed: "skip",
    });
  }

  const needsImage = slots.length > 0;
  const confidence = slots.some((s) => s.required) ? 0.9 : slots.length > 0 ? 0.6 : 0;

  const reasoningParts: string[] = [];
  if (layoutRules.length > 0) {
    reasoningParts.push(`Layout "${slide.layoutType}" suggests ${layoutRules.map((r) => r.slotType).join(", ")} slots`);
  }
  if (keywordMatches.length > 0) {
    reasoningParts.push(`Keywords triggered: ${keywordMatches.map((m: { triggerReason: string }) => m.triggerReason).join(", ")}`);
  }
  if (textDensity > 0.7) {
    reasoningParts.push("High text density needs visual relief");
  }

  return {
    slideId: slide.id,
    needsImage,
    confidence,
    slots,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join("; ") : "No image intent detected",
  };
}

export function composePrompt(
  slot: ImageSlotIntent,
  slide: SlidePlan,
  style: StyleTriple
): string {
  const layers: string[] = [];

  layers.push(slot.promptStrategy.basePrompt);

  layers.push(slot.promptStrategy.styleInjection);

  if (slot.promptStrategy.contentAnchors.length > 0) {
    const anchors = slot.promptStrategy.contentAnchors
      .filter((a) => a.length > 0)
      .map((a) => sanitizePrompt(a))
      .join(", ");
    if (anchors) {
      layers.push(`Context: ${anchors}`);
    }
  }

  layers.push(`Avoid: ${slot.promptStrategy.negativePrompt}`);

  return layers.join(". ");
}

export function sanitizePrompt(prompt: string): string {
  let cleaned = prompt;
  cleaned = cleaned.replace(/#[0-9A-Fa-f]{3,8}\b/g, "");
  cleaned = cleaned.replace(/\b(?:rgb|hsl|rgba|hsla)\s*\([^)]*\)/gi, "");
  cleaned = cleaned.replace(/\b\d+(\.\d+)?(px|em|rem|%|vh|vw|pt|cm|mm|in)\b/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

export class ImageIntentDetector {
  detect(slide: SlidePlan, style?: StyleTriple): ImageIntent {
    return detectImageIntent(slide, style);
  }

  composePrompt(slot: ImageSlotIntent, slide: SlidePlan, style: StyleTriple): string {
    return composePrompt(slot, slide, style);
  }

  sanitize(prompt: string): string {
    return sanitizePrompt(prompt);
  }
}
