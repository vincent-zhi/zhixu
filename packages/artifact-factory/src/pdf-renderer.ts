import type { ArtifactRenderer } from "./renderer.js";
import type { DocExportInput, ExportResult } from "./schemas.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class PdfRenderer implements ArtifactRenderer<DocExportInput> {
  readonly format = "pdf";

  async render(input: DocExportInput): Promise<ExportResult> {
    const greenCount = input.sections.filter(
      (s) => s.responsibilityColor === "green"
    ).length;
    const yellowCount = input.sections.filter(
      (s) => s.responsibilityColor === "yellow"
    ).length;
    const grayCount = input.sections.filter(
      (s) => s.responsibilityColor === "gray"
    ).length;

    const sectionsHtml = input.sections
      .map((section) => {
        const colorClass = section.responsibilityColor
          ? `color-${section.responsibilityColor}`
          : "";
        const evidenceTag = section.evidenceRefs?.length
          ? `<span class="evidence-badge">[${section.evidenceRefs.length} 条证据]</span>`
          : "";

        switch (section.type) {
          case "heading": {
            const level = Math.min(section.level ?? 1, 6);
            return `<h${level} class="${colorClass}">${escapeHtml(section.text)} ${evidenceTag}</h${level}>`;
          }
          case "paragraph":
            return `<p class="${colorClass}">${escapeHtml(section.text)} ${evidenceTag}</p>`;
          case "bullet_list":
            return `<li class="${colorClass}">${escapeHtml(section.text)}</li>`;
          case "citation":
            return `<blockquote class="${colorClass}">${escapeHtml(section.text)}</blockquote>`;
          case "table":
            return `<p class="${colorClass}"><strong>[表格]</strong> ${escapeHtml(section.text)}</p>`;
          case "formula":
            return `<pre class="formula ${colorClass}">${escapeHtml(section.text)}</pre>`;
          case "figure":
            return `<p class="${colorClass}"><em>[图] ${escapeHtml(section.text)}</em></p>`;
          default:
            return `<p class="${colorClass}">${escapeHtml(section.text)}</p>`;
        }
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(input.title)}</title>
<style>
  @media print { body { margin: 2cm; } @page { margin: 2cm; } }
  body { font-family: "Noto Serif SC", "SimSun", serif; font-size: 14px; line-height: 1.8; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
  h1 { font-size: 24px; text-align: center; margin-bottom: 32px; border-bottom: 2px solid #b8956b; padding-bottom: 16px; }
  h2 { font-size: 20px; margin-top: 28px; border-bottom: 1px solid #e5ddd2; padding-bottom: 6px; }
  h3 { font-size: 17px; margin-top: 24px; }
  h4, h5, h6 { font-size: 15px; margin-top: 20px; }
  p { margin: 8px 0; text-indent: 2em; }
  li { margin: 4px 0; list-style: disc inside; }
  blockquote { border: 1px solid #e2e8f0; padding: 12px 16px; margin: 12px 0; color: #475569; font-style: italic; background: #f8fafc; }
  pre.formula { background: #f8f6f1; padding: 12px; border-radius: 6px; font-family: "JetBrains Mono", monospace; font-size: 13px; }
  .color-green { border: 1px solid #bbf7d0; padding: 8px 10px; background: #f0fdf4; }
  .color-yellow { border: 1px solid #fed7aa; padding: 8px 10px; background: #fffbeb; }
  .color-gray { border: 1px solid #e2e8f0; padding: 8px 10px; background: #f8fafc; }
  .evidence-badge { font-size: 11px; background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 8px; margin-left: 8px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #94a3b8; }
  .footer .green { color: #16a34a; } .footer .yellow { color: #d97706; } .footer .gray { color: #94a3b8; }
</style>
</head>
<body>
<h1>${escapeHtml(input.title)}</h1>
${sectionsHtml}
<div class="footer">
  <p>知序 AI 生成 · 权责溯源：绿色(可溯源) ${greenCount} · 黄色(需核验) ${yellowCount} · 灰色(供参考) ${grayCount}</p>
</div>
</body>
</html>`;

    const buffer = Buffer.from(html, "utf-8");
    return {
      buffer,
      mimeType: "text/html",
      fileName: `${input.title}.html`,
      responsibilitySummary: { green: greenCount, yellow: yellowCount, gray: grayCount },
    };
  }
}
