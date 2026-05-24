import PptxGenJS from "pptxgenjs";
import type { ArtifactRenderer } from "./renderer.js";
import type { PptExportInput, ExportResult } from "./schemas.js";

const BRAND_THEMES = {
  academic_navy: {
    background: "0D1B2F",
    accent: "B89B5E",
    text: "FFFFFF",
    contentBackground: "F8F7F2",
    headingColor: "0D1B2F",
    bodyColor: "333333",
  },
  paper_white: {
    background: "F8F7F2",
    accent: "B89B5E",
    text: "0D1B2F",
    contentBackground: "FFFFFF",
    headingColor: "0D1B2F",
    bodyColor: "333333",
  },
} as const;

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

function buildTitleSlide(
  pptx: PptxGenJS,
  input: PptExportInput,
  theme: (typeof BRAND_THEMES)[keyof typeof BRAND_THEMES]
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  slide.addText(input.title, {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.5,
    fontSize: 36,
    fontFace: "Arial",
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
      fontFace: "Arial",
      color: theme.text,
      align: "center",
    });
  }
}

function buildContentSlide(
  pptx: PptxGenJS,
  slideInput: PptExportInput["slides"][number],
  theme: (typeof BRAND_THEMES)[keyof typeof BRAND_THEMES]
): void {
  const slide = pptx.addSlide();
  slide.background = { color: theme.contentBackground };

  slide.addText(slideInput.title, {
    x: 0.6,
    y: 0.3,
    w: 8.8,
    h: 0.8,
    fontSize: 24,
    fontFace: "Arial",
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

function addBlocksToSlide(
  slide: PptxGenJS.Slide,
  blocks: PptExportInput["slides"][number]["contentBlocks"],
  x: number,
  startY: number,
  w: number,
  theme: (typeof BRAND_THEMES)[keyof typeof BRAND_THEMES]
): void {
  let y = startY;
  for (const block of blocks) {
    if (block.type === "bullet_list") {
      const items = block.text
        .split("\n")
        .map((line) => ({
          text: line.replace(/^[-*]\s*/, ""),
          options: { fontSize: 14, fontFace: "Arial", color: theme.bodyColor, bullet: true },
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
        fontFace: "Arial",
        color: theme.bodyColor,
        valign: "top",
      });
      y += 0.75;
    }
  }
}

export class PptxRenderer implements ArtifactRenderer<PptExportInput> {
  readonly format = "pptx";

  async render(input: PptExportInput): Promise<ExportResult> {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const theme = BRAND_THEMES[input.brandTheme ?? "academic_navy"];

    buildTitleSlide(pptx, input, theme);

    for (const slideInput of input.slides) {
      buildContentSlide(pptx, slideInput, theme);
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

    return {
      buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileName: `${input.title}.pptx`,
      responsibilitySummary: computeResponsibilitySummary(input),
    };
  }
}
