import type { ArtifactRenderer } from "./renderer.js";
import type { DocExportInput, ExportResult } from "./schemas.js";

function computeResponsibilitySummary(
  input: DocExportInput
): ExportResult["responsibilitySummary"] {
  const summary = { green: 0, yellow: 0, gray: 0 };
  for (const section of input.sections) {
    summary[section.responsibilityColor]++;
  }
  return summary;
}

function sectionToMarkdown(section: DocExportInput["sections"][number]): string {
  switch (section.type) {
    case "heading": {
      const level = section.level ?? 1;
      const prefix = "#".repeat(level);
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `${prefix} ${section.text}\n${colorTag}`;
    }
    case "bullet_list": {
      const items = section.text
        .split("\n")
        .map((line) => `- ${line.replace(/^[-*]\s*/, "")}`);
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `${items.join("\n")}\n${colorTag}`;
    }
    case "citation": {
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `[cite] ${section.text}\n${colorTag}`;
    }
    case "formula": {
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `\`\`\`\n${section.text}\n\`\`\`\n${colorTag}`;
    }
    case "table": {
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `${section.text}\n${colorTag}`;
    }
    case "figure": {
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `![${section.text}]\n${colorTag}`;
    }
    default: {
      const colorTag = `<!-- color: ${section.responsibilityColor} -->`;
      return `${section.text}\n${colorTag}`;
    }
  }
}

export class MarkdownRenderer implements ArtifactRenderer<DocExportInput> {
  readonly format = "markdown";

  async render(input: DocExportInput): Promise<ExportResult> {
    const lines: string[] = [`# ${input.title}`];

    for (const section of input.sections) {
      lines.push("");
      lines.push(sectionToMarkdown(section));
    }

    const content = lines.join("\n");

    return {
      buffer: Buffer.from(content, "utf8"),
      mimeType: "text/markdown",
      fileName: `${input.title}.md`,
      responsibilitySummary: computeResponsibilitySummary(input),
    };
  }
}
