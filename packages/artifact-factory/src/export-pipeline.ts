import type { ArtifactRenderer } from "./renderer.js";
import type { PptExportInput, DocExportInput, ExportResult } from "./schemas.js";

export class ExportPipeline {
  constructor(
    private readonly pptxRenderer: ArtifactRenderer<PptExportInput>,
    private readonly docxRenderer: ArtifactRenderer<DocExportInput>,
    private readonly markdownRenderer: ArtifactRenderer<DocExportInput>,
    private readonly pdfRenderer: ArtifactRenderer<DocExportInput>
  ) {}

  async exportPptx(input: PptExportInput): Promise<ExportResult> {
    return this.pptxRenderer.render(input);
  }

  async exportDocx(input: DocExportInput): Promise<ExportResult> {
    return this.docxRenderer.render(input);
  }

  async exportMarkdown(input: DocExportInput): Promise<ExportResult> {
    return this.markdownRenderer.render(input);
  }

  async exportPdf(input: DocExportInput): Promise<ExportResult> {
    return this.pdfRenderer.render(input);
  }
}
