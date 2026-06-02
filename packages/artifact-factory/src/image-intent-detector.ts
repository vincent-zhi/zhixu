import type { SlidePlan } from "@zhixu/core";
import type { ImageIntent, ImageSlotIntent, ImageTriggerReason, PromptStrategy } from "./schemas.js";

const COVER_TYPES: SlidePlan["layoutType"][] = ["title"];
const DATA_TYPES: SlidePlan["layoutType"][] = ["data_highlight"];
const COMPARISON_TYPES: SlidePlan["layoutType"][] = ["comparison"];
const SECTION_TYPES: SlidePlan["layoutType"][] = ["section"];
const CLOSING_TYPES: SlidePlan["layoutType"][] = ["closing"];

const ABSTRACT_CONCEPT_PATTERNS = [
  /注意力机制|attention/i, /梯度消失|gradient/i, /特征提取|feature extract/i,
  /嵌入|embedding/i, /归一化|normaliz/i, /正则化|regulariz/i,
  /激活函数|activat/i, /损失函数|loss function/i, /优化器|optim/i,
  /反向传播|backprop/i, /卷积|convolut/i, /递归|recurrent/i,
  /生成对抗|gan/i, /变分|variational/i, /扩散|diffusion/i
];

const PROCESS_PATTERNS = [
  /首先.*然后.*最后|first.*then.*finally/is, /步骤|step/i,
  /流程|process|pipeline/i, /预处理.*训练.*评估/i,
  /数据.*特征.*模型/i
];

const COMPARISON_PATTERNS = [
  /相比|compared to|vs\.?/i, /对比|contrast/i,
  /改进|improv|优于|better than/i, /差异|differ/i
];

const DATA_PATTERNS = [
  /\d+\.?\d*%/, /准确率|accuracy/i, /F1|precision|recall/i,
  /BLEU|ROUGE/i, /MSE|RMSE|MAE/i, /AUC|ROC/i,
  /指标|metric/i, /性能|performance/i
];

const ARCHITECTURE_PATTERNS = [
  /架构|architecture/i, /框架|framework/i, /模型结构|model structure/i,
  /网络|network/i, /系统设计|system design/i
];

const EXPERIMENT_PATTERNS = [
  /实验|experiment/i, /消融|ablation/i, /结果|result/i,
  /评估|evaluat/i, /基准|benchmark/i
];

function matchPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function detectTriggerReasons(slide: SlidePlan): Array<{ reason: ImageTriggerReason; confidence: number }> {
  const reasons: Array<{ reason: ImageTriggerReason; confidence: number }> = [];
  const text = `${slide.title} ${slide.keyPoints.join(" ")} ${slide.speakerNotes}`;

  if (COVER_TYPES.includes(slide.layoutType)) {
    reasons.push({ reason: "cover_needs_visual_anchor", confidence: 0.95 });
    return reasons;
  }

  if (CLOSING_TYPES.includes(slide.layoutType)) {
    reasons.push({ reason: "closing_needs_thematic_close", confidence: 0.6 });
  }

  if (SECTION_TYPES.includes(slide.layoutType)) {
    reasons.push({ reason: "section_needs_transition_visual", confidence: 0.5 });
  }

  if (DATA_TYPES.includes(slide.layoutType) || matchPatterns(text, DATA_PATTERNS)) {
    reasons.push({ reason: "data_needs_chart", confidence: 0.9 });
  }

  if (COMPARISON_TYPES.includes(slide.layoutType) || matchPatterns(text, COMPARISON_PATTERNS)) {
    reasons.push({ reason: "comparison_needs_diagram", confidence: 0.85 });
  }

  if (matchPatterns(text, ABSTRACT_CONCEPT_PATTERNS)) {
    reasons.push({ reason: "concept_benefits_from_visual", confidence: 0.8 });
  }

  if (matchPatterns(text, PROCESS_PATTERNS)) {
    reasons.push({ reason: "process_needs_flowchart", confidence: 0.85 });
  }

  if (matchPatterns(text, ARCHITECTURE_PATTERNS)) {
    reasons.push({ reason: "method_needs_architecture", confidence: 0.9 });
  }

  if (matchPatterns(text, EXPERIMENT_PATTERNS)) {
    reasons.push({ reason: "result_needs_visualization", confidence: 0.8 });
  }

  if (slide.keyPoints.length > 5) {
    reasons.push({ reason: "text_heavy_needs_relief", confidence: 0.5 });
  }

  return reasons;
}

function buildPromptStrategy(
  slide: SlidePlan,
  reason: ImageTriggerReason,
  styleDescription: string,
  colorTone: string
): PromptStrategy {
  const anchors = [slide.title, ...slide.keyPoints.slice(0, 3)];

  const TEMPLATES: Partial<Record<ImageTriggerReason, { base: string; negative: string }>> = {
    cover_needs_visual_anchor: {
      base: `A visually striking cover background for a presentation about ${slide.title}, ${styleDescription}. ${colorTone} palette, elegant composition, space for title overlay, professional academic feel.`,
      negative: "text, words, letters, watermark, low quality, blurry"
    },
    concept_benefits_from_visual: {
      base: `An abstract conceptual illustration representing ${slide.title}, ${styleDescription}. Clean, professional, suitable for academic presentation, ${colorTone} palette.`,
      negative: "text-heavy, messy, cartoon, low quality, watermark"
    },
    data_needs_chart: {
      base: `A professional data visualization chart about ${slide.keyPoints[0] ?? slide.title}. Clean data visualization style, ${colorTone} palette, clear axis labels, academic presentation quality.`,
      negative: "photograph, illustration, cartoon, messy, dark background"
    },
    comparison_needs_diagram: {
      base: `A clean comparison diagram showing ${slide.title}. Professional diagram style, ${colorTone} palette, clear labels and visual hierarchy, academic presentation quality.`,
      negative: "photograph, 3D render, cartoon, messy, dark background"
    },
    process_needs_flowchart: {
      base: `A clean flowchart showing the process of ${slide.title}, with steps: ${slide.keyPoints.slice(0, 4).join(", ")}. Professional diagram style, ${colorTone} palette, clear arrows and labels, white background, academic presentation quality.`,
      negative: "photograph, 3D, cartoon, messy, dark background"
    },
    method_needs_architecture: {
      base: `A clean architectural diagram of ${slide.title}, showing ${slide.keyPoints.slice(0, 3).join(", ")} and their connections. Academic style, white/light gray background, clear labels, structured layout suitable for research presentation.`,
      negative: "photograph, 3D render, cartoon, messy handwriting, dark background, neon colors"
    },
    result_needs_visualization: {
      base: `A professional result visualization for ${slide.title}. Clean chart style, ${colorTone} palette, clear labels, academic presentation quality.`,
      negative: "photograph, illustration, cartoon, messy, dark background"
    },
    section_needs_transition_visual: {
      base: `A subtle decorative visual for section transition about ${slide.title}. ${styleDescription}, ${colorTone} palette, minimal, professional.`,
      negative: "text, words, complex, messy, dark background"
    },
    closing_needs_thematic_close: {
      base: `A thematic closing visual for a presentation about ${slide.title}. ${styleDescription}, ${colorTone} palette, elegant, professional.`,
      negative: "text, words, letters, watermark, low quality"
    },
    text_heavy_needs_relief: {
      base: `A supporting illustration for ${slide.title}. ${styleDescription}, ${colorTone} palette, clean, professional, academic feel.`,
      negative: "text-heavy, messy, cartoon, low quality, watermark"
    }
  };

  const template = TEMPLATES[reason] ?? {
    base: `An illustration for ${slide.title}. ${styleDescription}, ${colorTone} palette, professional academic style.`,
    negative: "text, watermark, low quality, blurry"
  };

  return {
    basePrompt: template.base,
    styleInjection: styleDescription,
    contentAnchors: anchors,
    negativePrompt: template.negative,
    aspectRatio: "landscape_16_9",
    quality: "standard"
  };
}

export function detectImageIntent(
  slide: SlidePlan,
  styleDescription: string,
  colorTone: string
): ImageIntent {
  const reasons = detectTriggerReasons(slide);

  if (reasons.length === 0) {
    return {
      slideId: slide.id,
      needsImage: false,
      confidence: 0,
      slots: [],
      reasoning: "No visual trigger detected for this slide"
    };
  }

  const topReason = reasons.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  const slots: ImageSlotIntent[] = [];

  const slotTypeMap: Partial<Record<ImageTriggerReason, ImageSlotIntent["slotType"]>> = {
    cover_needs_visual_anchor: "background",
    concept_benefits_from_visual: "supporting",
    data_needs_chart: "chart",
    comparison_needs_diagram: "chart",
    process_needs_flowchart: "chart",
    method_needs_architecture: "hero",
    result_needs_visualization: "chart",
    section_needs_transition_visual: "icon",
    closing_needs_thematic_close: "background",
    text_heavy_needs_relief: "supporting",
    source_figure_available: "supporting",
    user_explicitly_requested: "hero"
  };

  const requiredMap: Partial<Record<ImageTriggerReason, boolean>> = {
    cover_needs_visual_anchor: true,
    data_needs_chart: true,
    method_needs_architecture: true,
    comparison_needs_diagram: true
  };

  const fallbackMap: Partial<Record<ImageTriggerReason, ImageSlotIntent["fallbackIfFailed"]>> = {
    cover_needs_visual_anchor: "redesign_layout",
    data_needs_chart: "placeholder_text",
    comparison_needs_diagram: "placeholder_text",
    method_needs_architecture: "placeholder_text",
    process_needs_flowchart: "skip",
    concept_benefits_from_visual: "skip",
    result_needs_visualization: "placeholder_text",
    section_needs_transition_visual: "skip",
    closing_needs_thematic_close: "skip",
    text_heavy_needs_relief: "skip"
  };

  for (const { reason, confidence } of reasons) {
    slots.push({
      slotType: slotTypeMap[reason] ?? "supporting",
      triggerReason: reason,
      promptStrategy: buildPromptStrategy(slide, reason, styleDescription, colorTone),
      required: requiredMap[reason] ?? false,
      fallbackIfFailed: fallbackMap[reason] ?? "skip"
    });
  }

  return {
    slideId: slide.id,
    needsImage: true,
    confidence: topReason.confidence,
    slots,
    reasoning: reasons.map((r) => `${r.reason} (${(r.confidence * 100).toFixed(0)}%)`).join(", ")
  };
}

export function detectAllImageIntents(
  slides: SlidePlan[],
  styleDescription: string,
  colorTone: string
): ImageIntent[] {
  return slides.map((slide) => detectImageIntent(slide, styleDescription, colorTone));
}
