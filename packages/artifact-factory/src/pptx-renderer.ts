import PptxGenJS from "pptxgenjs";
import type { SlidePlan } from "@zhixu/core";
import type { ArtifactRenderer } from "./renderer.js";
import type { PptExportInput, ExportResult, StyleTriple } from "./schemas.js";

export interface BrandTheme {
  background: string;
  accent: string;
  text: string;
  contentBackground: string;
  headingColor: string;
  bodyColor: string;
  fontHeading: string;
  fontBody: string;
}

const BRAND_THEMES = {
  academic_navy: {
    background: "0D1B2F",
    accent: "B89B5E",
    text: "FFFFFF",
    contentBackground: "F8F7F2",
    headingColor: "0D1B2F",
    bodyColor: "333333",
    fontHeading: "Arial",
    fontBody: "Arial",
  },
  paper_white: {
    background: "F8F7F2",
    accent: "B89B5E",
    text: "0D1B2F",
    contentBackground: "FFFFFF",
    headingColor: "0D1B2F",
    bodyColor: "333333",
    fontHeading: "Arial",
    fontBody: "Arial",
  },
} as const satisfies Record<string, BrandTheme>;

const DESIGN_STYLE_MAP: Record<StyleTriple["designStyle"], Partial<BrandTheme>> = {
  classic: { fontHeading: "Georgia", fontBody: "Georgia" },
  modern: { fontHeading: "Arial", fontBody: "Arial" },
  minimalist: { fontHeading: "Arial", fontBody: "Arial" },
  vibrant: { fontHeading: "Arial", fontBody: "Arial" },
  ink_chinese: { fontHeading: "SimSun", fontBody: "SimSun" },
  infographic: { fontHeading: "Arial", fontBody: "Arial" },
  dashboard: { fontHeading: "Arial", fontBody: "Arial" },
  ultra_minimal: { fontHeading: "Arial", fontBody: "Arial" },
};

const COLOR_TONE_MAP: Record<StyleTriple["colorTone"], { warmShift: number; satShift: number }> = {
  warm: { warmShift: 20, satShift: 0 },
  cool: { warmShift: -20, satShift: 0 },
  neutral: { warmShift: 0, satShift: 0 },
  vivid: { warmShift: 0, satShift: 30 },
  muted: { warmShift: 0, satShift: -30 },
  monochrome: { warmShift: 0, satShift: -100 },
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

export function themeFromStyleTriple(triple: StyleTriple): BrandTheme {
  const base = BRAND_THEMES.academic_navy;
  const styleOverride = DESIGN_STYLE_MAP[triple.designStyle] ?? {};
  const toneShift = COLOR_TONE_MAP[triple.colorTone] ?? { warmShift: 0, satShift: 0 };

  const primaryHsl = hexToHsl(triple.primaryColor);
  const accentHex = hslToHex(primaryHsl.h + 30, primaryHsl.s, primaryHsl.l);
  const bgHex = hslToHex(primaryHsl.h, Math.max(0, primaryHsl.s + toneShift.satShift), 8);
  const contentBgHex = hslToHex(primaryHsl.h, Math.max(0, primaryHsl.s - 40 + toneShift.satShift), 97);
  const textHex = hslToHex(primaryHsl.h, 10, 95);
  const headingHex = hslToHex(primaryHsl.h, Math.max(0, primaryHsl.s + toneShift.satShift), 12);
  const bodyHex = "333333";

  return {
    background: bgHex.toUpperCase(),
    accent: accentHex.toUpperCase(),
    text: textHex.toUpperCase(),
    contentBackground: contentBgHex.toUpperCase(),
    headingColor: headingHex.toUpperCase(),
    bodyColor: bodyHex,
    fontHeading: styleOverride.fontHeading ?? base.fontHeading,
    fontBody: styleOverride.fontBody ?? base.fontBody,
  };
}

function computeResponsibilitySummary(
  input: PptExportInput
): ExportResult["responsibilitySummary"] {
  const summary = { green: 0, yellow: 0, gray: 0 };
  for (const slide of input.slides) {
    for (const block of slide.contentBlocks ?? []) {
      summary[block.responsibilityColor ?? "gray"]++;
    }
  }
  return summary;
}

function resolveTheme(input: PptExportInput): BrandTheme {
  if (input.styleTriple) {
    return themeFromStyleTriple(input.styleTriple);
  }
  return BRAND_THEMES[input.brandTheme ?? "academic_navy"];
}

function buildTitleSlide(
  pptx: PptxGenJS,
  input: PptExportInput,
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  slide.addText(input.title, {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.5,
    fontSize: 36,
    fontFace: theme.fontHeading,
    color: theme.text,
    bold: true,
    align: "center",
  });

  const accentLineY = 3.5;
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: accentLineY,
    w: 3,
    h: 0.04,
    fill: { color: theme.accent },
  });

  if (input.slides[0]?.objective) {
    slide.addText(input.slides[0].objective, {
      x: 1.5,
      y: 3.8,
      w: 7,
      h: 0.8,
      fontSize: 16,
      fontFace: theme.fontBody,
      color: theme.text,
      align: "center",
    });
  }
}

function buildComparisonSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBackground };

  slide.addText(slideInput.title, {
    x: 0.6,
    y: 0.3,
    w: 8.8,
    h: 0.8,
    fontSize: 24,
    fontFace: theme.fontHeading,
    color: theme.headingColor,
    bold: true,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6,
    y: 1.1,
    w: 8.8,
    h: 0.02,
    fill: { color: theme.accent },
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 5.0,
    y: 1.3,
    w: 0,
    h: 5.5,
    line: { color: theme.accent, width: 1.5, dashType: "dash" },
  });

  const textBlocks = slideInput.contentBlocks.filter(
    (b) => b.type === "text" || b.type === "bullet_list"
  );
  const half = Math.ceil(textBlocks.length / 2);
  const leftBlocks = textBlocks.slice(0, half);
  const rightBlocks = textBlocks.slice(half);

  addBlocksToSlide(slide, leftBlocks, 0.6, 1.4, 4.0, theme);
  addBlocksToSlide(slide, rightBlocks, 5.4, 1.4, 4.0, theme);

  addImagePlaceholders(slide, slideInput, theme);
  addSlideNotes(slide, slideInput);
}

function buildDataHighlightSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBackground };

  slide.addText(slideInput.title, {
    x: 0.6,
    y: 0.3,
    w: 8.8,
    h: 0.8,
    fontSize: 24,
    fontFace: theme.fontHeading,
    color: theme.headingColor,
    bold: true,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6,
    y: 1.1,
    w: 8.8,
    h: 0.02,
    fill: { color: theme.accent },
  });

  const textBlocks = slideInput.contentBlocks.filter(
    (b) => b.type === "text" || b.type === "bullet_list"
  );
  if (textBlocks.length > 0) {
    const highlightBlock = textBlocks[0];
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.0,
      y: 1.5,
      w: 8.0,
      h: 1.2,
      fill: { color: theme.background },
      rectRadius: 0.1,
    });
    slide.addText(highlightBlock?.text ?? "", {
      x: 1.2,
      y: 1.6,
      w: 7.6,
      h: 1.0,
      fontSize: 20,
      fontFace: theme.fontBody,
      color: theme.text,
      bold: true,
      align: "center",
      valign: "middle",
    });

    const remainingBlocks = textBlocks.slice(1);
    addBlocksToSlide(slide, remainingBlocks, 0.6, 3.0, 8.8, theme);
  }

  addImagePlaceholders(slide, slideInput, theme);
  addSlideNotes(slide, slideInput);
}

function buildSectionSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 3.0,
    w: 10,
    h: 0.04,
    fill: { color: theme.accent },
  });

  slide.addText(slideInput.title, {
    x: 1.0,
    y: 2.0,
    w: 8.0,
    h: 1.0,
    fontSize: 32,
    fontFace: theme.fontHeading,
    color: theme.text,
    bold: true,
    align: "center",
  });

  if (slideInput.objective) {
    slide.addText(slideInput.objective, {
      x: 1.5,
      y: 3.3,
      w: 7.0,
      h: 0.6,
      fontSize: 16,
      fontFace: theme.fontBody,
      color: theme.text,
      align: "center",
    });
  }

  addImagePlaceholders(slide, slideInput, theme);
  addSlideNotes(slide, slideInput);
}

function buildClosingSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  slide.addText(slideInput.title, {
    x: 1.0,
    y: 2.5,
    w: 8.0,
    h: 1.2,
    fontSize: 36,
    fontFace: theme.fontHeading,
    color: theme.text,
    bold: true,
    align: "center",
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: 3.8,
    w: 3,
    h: 0.04,
    fill: { color: theme.accent },
  });

  const textBlocks = slideInput.contentBlocks.filter(
    (b) => b.type === "text" || b.type === "bullet_list"
  );
  if (textBlocks.length > 0) {
    slide.addText(textBlocks.map((b) => b.text).join("  |  "), {
      x: 1.0,
      y: 4.2,
      w: 8.0,
      h: 0.6,
      fontSize: 14,
      fontFace: theme.fontBody,
      color: theme.text,
      align: "center",
    });
  }

  addImagePlaceholders(slide, slideInput, theme);
  addSlideNotes(slide, slideInput);
}

function addImagePlaceholders(
  slide: PptxGenJS.Slide,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const imageBlocks = slideInput.contentBlocks.filter(
    (b) => b.type === "image_placeholder" && b.imageUrl
  );
  for (const block of imageBlocks) {
    slide.addImage({
      path: block.imageUrl!,
      x: 5.5,
      y: 1.4,
      w: 4.0,
      h: 3.5,
      sizing: { type: "contain", w: 4.0, h: 3.5 },
    });
  }
}

function addSlideNotes(
  slide: PptxGenJS.Slide,
  slideInput: PptExportInput["slides"][number]
): void {
  let notes = slideInput.speakerNotes ?? "";
  const evidenceRefs = slideInput.evidenceRefs ?? [];
  if (evidenceRefs.length > 0) {
    const evidenceTag = `[Evidence: ${evidenceRefs.join(", ")}]`;
    notes = notes ? `${notes}\n${evidenceTag}` : evidenceTag;
  }
  if (notes) {
    slide.addNotes(notes);
  }
}

function buildContentSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: BrandTheme
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBackground };

  slide.addText(slideInput.title, {
    x: 0.6,
    y: 0.3,
    w: 8.8,
    h: 0.8,
    fontSize: 24,
    fontFace: theme.fontHeading,
    color: theme.headingColor,
    bold: true,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6,
    y: 1.1,
    w: 8.8,
    h: 0.02,
    fill: { color: theme.accent },
  });

  const textBlocks = slideInput.contentBlocks.filter(
    (b) => b.type === "text" || b.type === "bullet_list"
  );
  const half = Math.ceil(textBlocks.length / 2);

  if (slideInput.layoutType === "two_column" && textBlocks.length > 1) {
    const leftBlocks = textBlocks.slice(0, half);
    const rightBlocks = textBlocks.slice(half);

    addBlocksToSlide(slide, leftBlocks, 0.6, 1.4, 4.0, theme);
    addBlocksToSlide(slide, rightBlocks, 5.2, 1.4, 4.2, theme);
  } else {
    addBlocksToSlide(slide, textBlocks, 0.6, 1.4, 8.8, theme);
  }

  addImagePlaceholders(slide, slideInput, theme);
  addSlideNotes(slide, slideInput);
}

function addBlocksToSlide(
  slide: PptxGenJS.Slide,
  blocks: PptExportInput["slides"][number]["contentBlocks"],
  x: number,
  startY: number,
  w: number,
  theme: BrandTheme
): void {
  let y = startY;
  for (const block of blocks) {
    if (block.type === "bullet_list") {
      const items = block.text
        .split("\n")
        .map((line) => ({
          text: line.replace(/^[-*]\s*/, ""),
          options: { fontSize: 14, fontFace: theme.fontBody, color: theme.bodyColor, bullet: true },
        }));
      slide.addText(items, {
        x,
        y,
        w,
        h: 0.4 * items.length,
        valign: "top",
      });
      y += 0.4 * items.length + 0.15;
    } else {
      slide.addText(block.text, {
        x,
        y,
        w,
        h: 0.6,
        fontSize: 14,
        fontFace: theme.fontBody,
        color: theme.bodyColor,
        valign: "top",
      });
      y += 0.75;
    }
  }
}

function buildSlideFromPlan(
  pptx: PptxGenJS,
  plan: SlidePlan,
  theme: BrandTheme,
  isFirst: boolean
): void {
  const layoutType = plan.layoutType;

  if (layoutType === "title" || isFirst) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };

    slide.addText(plan.title, {
      x: 0.8,
      y: 1.8,
      w: 8.4,
      h: 1.5,
      fontSize: 36,
      fontFace: theme.fontHeading,
      color: theme.text,
      bold: true,
      align: "center",
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 3.5,
      y: 3.5,
      w: 3,
      h: 0.04,
      fill: { color: theme.accent },
    });

    if (plan.objective) {
      slide.addText(plan.objective, {
        x: 1.5,
        y: 3.8,
        w: 7,
        h: 0.8,
        fontSize: 16,
        fontFace: theme.fontBody,
        color: theme.text,
        align: "center",
      });
    }

    if (plan.speakerNotes) {
      slide.addNotes(plan.speakerNotes);
    }
    return;
  }

  if (layoutType === "section") {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 3.0,
      w: 10,
      h: 0.04,
      fill: { color: theme.accent },
    });

    slide.addText(plan.title, {
      x: 1.0,
      y: 2.0,
      w: 8.0,
      h: 1.0,
      fontSize: 32,
      fontFace: theme.fontHeading,
      color: theme.text,
      bold: true,
      align: "center",
    });

    if (plan.objective) {
      slide.addText(plan.objective, {
        x: 1.5,
        y: 3.3,
        w: 7.0,
        h: 0.6,
        fontSize: 16,
        fontFace: theme.fontBody,
        color: theme.text,
        align: "center",
      });
    }

    if (plan.speakerNotes) {
      slide.addNotes(plan.speakerNotes);
    }
    return;
  }

  if (layoutType === "closing") {
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };

    slide.addText(plan.title, {
      x: 1.0,
      y: 2.5,
      w: 8.0,
      h: 1.2,
      fontSize: 36,
      fontFace: theme.fontHeading,
      color: theme.text,
      bold: true,
      align: "center",
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 3.5,
      y: 3.8,
      w: 3,
      h: 0.04,
      fill: { color: theme.accent },
    });

    if (plan.keyPoints.length > 0) {
      slide.addText(plan.keyPoints.join("  |  "), {
        x: 1.0,
        y: 4.2,
        w: 8.0,
        h: 0.6,
        fontSize: 14,
        fontFace: theme.fontBody,
        color: theme.text,
        align: "center",
      });
    }

    if (plan.speakerNotes) {
      slide.addNotes(plan.speakerNotes);
    }
    return;
  }

  if (layoutType === "comparison") {
    const slide = pptx.addSlide();
    slide.background = { color: theme.contentBackground };

    slide.addText(plan.title, {
      x: 0.6,
      y: 0.3,
      w: 8.8,
      h: 0.8,
      fontSize: 24,
      fontFace: theme.fontHeading,
      color: theme.headingColor,
      bold: true,
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 1.1,
      w: 8.8,
      h: 0.02,
      fill: { color: theme.accent },
    });

    slide.addShape(pptx.ShapeType.line, {
      x: 5.0,
      y: 1.3,
      w: 0,
      h: 5.5,
      line: { color: theme.accent, width: 1.5, dashType: "dash" },
    });

    const half = Math.ceil(plan.keyPoints.length / 2);
    const leftItems = plan.keyPoints.slice(0, half).map((kp) => ({
      text: kp,
      options: { fontSize: 14, fontFace: theme.fontBody, color: theme.bodyColor, bullet: true },
    }));
    const rightItems = plan.keyPoints.slice(half).map((kp) => ({
      text: kp,
      options: { fontSize: 14, fontFace: theme.fontBody, color: theme.bodyColor, bullet: true },
    }));

    if (leftItems.length > 0) {
      slide.addText(leftItems, { x: 0.6, y: 1.4, w: 4.0, h: 0.4 * leftItems.length, valign: "top" });
    }
    if (rightItems.length > 0) {
      slide.addText(rightItems, { x: 5.4, y: 1.4, w: 4.0, h: 0.4 * rightItems.length, valign: "top" });
    }

    if (plan.speakerNotes) {
      slide.addNotes(plan.speakerNotes);
    }
    return;
  }

  if (layoutType === "data_highlight") {
    const slide = pptx.addSlide();
    slide.background = { color: theme.contentBackground };

    slide.addText(plan.title, {
      x: 0.6,
      y: 0.3,
      w: 8.8,
      h: 0.8,
      fontSize: 24,
      fontFace: theme.fontHeading,
      color: theme.headingColor,
      bold: true,
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 1.1,
      w: 8.8,
      h: 0.02,
      fill: { color: theme.accent },
    });

    if (plan.keyPoints.length > 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 1.0,
        y: 1.5,
        w: 8.0,
        h: 1.2,
        fill: { color: theme.background },
        rectRadius: 0.1,
      });
      slide.addText(plan.keyPoints[0] ?? "", {
        x: 1.2,
        y: 1.6,
        w: 7.6,
        h: 1.0,
        fontSize: 20,
        fontFace: theme.fontBody,
        color: theme.text,
        bold: true,
        align: "center",
        valign: "middle",
      });

      const remaining = plan.keyPoints.slice(1);
      if (remaining.length > 0) {
        const items = remaining.map((kp) => ({
          text: kp,
          options: { fontSize: 14, fontFace: theme.fontBody, color: theme.bodyColor, bullet: true },
        }));
        slide.addText(items, { x: 0.6, y: 3.0, w: 8.8, h: 0.4 * items.length, valign: "top" });
      }
    }

    if (plan.speakerNotes) {
      slide.addNotes(plan.speakerNotes);
    }
    return;
  }

  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBackground };

  slide.addText(plan.title, {
    x: 0.6,
    y: 0.3,
    w: 8.8,
    h: 0.8,
    fontSize: 24,
    fontFace: theme.fontHeading,
    color: theme.headingColor,
    bold: true,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6,
    y: 1.1,
    w: 8.8,
    h: 0.02,
    fill: { color: theme.accent },
  });

  const items = plan.keyPoints.map((kp) => ({
    text: kp,
    options: { fontSize: 14, fontFace: theme.fontBody, color: theme.bodyColor, bullet: true },
  }));
  if (items.length > 0) {
    slide.addText(items, { x: 0.6, y: 1.4, w: 8.8, h: 0.4 * items.length, valign: "top" });
  }

  if (plan.speakerNotes) {
    slide.addNotes(plan.speakerNotes);
  }
}

export class PptxRenderer implements ArtifactRenderer<PptExportInput> {
  readonly format = "pptx";

  async render(input: PptExportInput): Promise<ExportResult> {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const theme = resolveTheme(input);

    buildTitleSlide(pptx, input, theme);

    for (const slideInput of input.slides) {
      const layoutType = slideInput.layoutType;
      if (layoutType === "comparison") {
        buildComparisonSlide(pptx, slideInput, theme);
      } else if (layoutType === "data_highlight") {
        buildDataHighlightSlide(pptx, slideInput, theme);
      } else if (layoutType === "section") {
        buildSectionSlide(pptx, slideInput, theme);
      } else if (layoutType === "closing") {
        buildClosingSlide(pptx, slideInput, theme);
      } else {
        buildContentSlide(pptx, slideInput, theme);
      }
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

    return {
      buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileName: `${input.title}.pptx`,
      responsibilitySummary: computeResponsibilitySummary(input),
    };
  }

  async renderSlidePlan(plan: SlidePlan, theme: BrandTheme): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    buildSlideFromPlan(pptx, plan, theme, plan.layoutType === "title");

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    return buffer;
  }
}
