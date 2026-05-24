import { describe, it, expect } from "vitest";
import { PptxRenderer } from "./pptx-renderer.js";
import type { PptExportInput } from "./schemas.js";

describe("PptxRenderer", () => {
  const renderer = new PptxRenderer();

  const sampleInput: PptExportInput = {
    title: "Test Presentation",
    slides: [
      {
        title: "Introduction",
        objective: "Overview of the topic",
        layoutType: "content",
        contentBlocks: [
          { type: "text", text: "Hello world", responsibilityColor: "green" },
          { type: "bullet_list", text: "Point A\nPoint B", responsibilityColor: "yellow" },
        ],
        speakerNotes: "Speak slowly",
        evidenceRefs: ["ref1", "ref2"],
      },
      {
        title: "Conclusion",
        layoutType: "two_column",
        contentBlocks: [
          { type: "text", text: "Left column", responsibilityColor: "green" },
          { type: "text", text: "Right column", responsibilityColor: "gray" },
        ],
        evidenceRefs: [],
      },
    ],
    brandTheme: "academic_navy",
  };

  it("returns a Buffer with correct mimeType", async () => {
    const result = await renderer.render(sampleInput);

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    expect(result.fileName).toBe("Test Presentation.pptx");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("calculates responsibility summary correctly", async () => {
    const result = await renderer.render(sampleInput);

    expect(result.responsibilitySummary).toEqual({
      green: 2,
      yellow: 1,
      gray: 1,
    });
  });

  it("applies academic_navy brand theme", async () => {
    const result = await renderer.render(sampleInput);

    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("applies paper_white brand theme", async () => {
    const paperWhiteInput: PptExportInput = {
      ...sampleInput,
      brandTheme: "paper_white",
    };
    const result = await renderer.render(paperWhiteInput);

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("handles slides with no evidence refs", async () => {
    const noEvidenceInput: PptExportInput = {
      title: "No Evidence",
      slides: [
        {
          title: "Slide 1",
          layoutType: "content",
          contentBlocks: [
            { type: "text", text: "Content", responsibilityColor: "gray" },
          ],
        },
      ],
    };
    const result = await renderer.render(noEvidenceInput);

    expect(result.responsibilitySummary.gray).toBe(1);
    expect(result.responsibilitySummary.green).toBe(0);
    expect(result.responsibilitySummary.yellow).toBe(0);
  });
});
