import type { AgentOutput, SourceSummary } from "@zhixu/core";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MarkItDownProvider,
  normalizeToAgentOutput,
  type DocumentParserProvider
} from "@zhixu/document-intelligence";

const nodeRequire = createRequire(import.meta.url);

export class DocumentPipeline {
  private readonly providers: DocumentParserProvider[];

  constructor(providers?: DocumentParserProvider[]) {
    this.providers = providers ?? [new MarkItDownProvider()];
  }

  async parseSource(
    source: SourceSummary,
    content?: Buffer | string
  ): Promise<AgentOutput> {
    const sourceContent = content ?? this.readLocalStorageUri(source.storageUri);
    if (sourceContent !== undefined) {
      const prepared = await this.prepareContent(source, sourceContent);
      if (!prepared) {
        return this.unavailableOutput(source, "unsupported_file_type");
      }
      const provider = this.resolveProvider({ ...source, fileType: prepared.fileType });
      const doc = await provider.parse({
        sourceId: source.id,
        fileName: source.fileName,
        fileType: prepared.fileType,
        content: prepared.content
      });
      return normalizeToAgentOutput(doc);
    }

    return this.unavailableOutput(source, "source_content_unavailable");
  }

  private resolveProvider(source: SourceSummary): DocumentParserProvider {
    for (const provider of this.providers) {
      if (provider.supportedFileTypes().includes(source.fileType)) {
        return provider;
      }
    }

    return this.providers[0]!;
  }

  private readLocalStorageUri(storageUri: string): Buffer | undefined {
    const localPath = storageUri.startsWith("file://")
      ? fileURLToPath(storageUri)
      : storageUri;
    if (!localPath.includes("://") && existsSync(localPath)) {
      return readFileSync(localPath);
    }
    return undefined;
  }

  private async prepareContent(
    source: SourceSummary,
    content: Buffer | string
  ): Promise<{ content: Buffer | string; fileType: string } | null> {
    const lowerType = source.fileType.toLowerCase();
    const ext = extname(source.fileName).toLowerCase();
    if (
      lowerType.includes("markdown") ||
      lowerType.includes("text/plain") ||
      lowerType.includes("text/csv") ||
      ext === ".md" ||
      ext === ".txt" ||
      ext === ".csv"
    ) {
      return { content, fileType: lowerType.includes("markdown") ? "text/markdown" : "text/plain" };
    }

    const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    if (lowerType.includes("pdf") || ext === ".pdf") {
      return { content: await extractPdfText(buffer), fileType: "text/plain" };
    }
    if (lowerType.includes("wordprocessingml") || ext === ".docx" || ext === ".doc") {
      return { content: await extractDocxText(buffer), fileType: "text/plain" };
    }
    if (lowerType.includes("spreadsheet") || ext === ".xlsx" || ext === ".xls") {
      return { content: await extractSpreadsheetText(buffer), fileType: "text/plain" };
    }
    if (lowerType.includes("presentation") || ext === ".pptx") {
      return { content: extractPptxText(buffer), fileType: "text/plain" };
    }
    return null;
  }

  private unavailableOutput(source: SourceSummary, reason: string): AgentOutput {
    return {
      outputType: "source.parse",
      structuredResult: {
        provider: "document-pipeline",
        parseStatus: reason,
        document: {
          id: `doc_${source.id}`,
          sourceId: source.id,
          title: source.fileName,
          nodes: []
        }
      },
      confidence: 0,
      requiredConfirmations: [],
      evidenceRefs: [],
      riskFlags: [reason],
      nextActions: ["upload_source_content", "retry_parse"],
      costEstimate: {
        provider: "local",
        model: "document-pipeline",
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0
      }
    };
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer } as any);
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractSpreadsheetText(buffer: Buffer): Promise<string> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return sheet ? `# ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}` : `# ${sheetName}`;
  }).join("\n\n");
}

function extractPptxText(buffer: Buffer): string {
  const AdmZip = requireAdmZip();
  const zip = new AdmZip(buffer);
  return zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName))
    .map((entry, index) => `# Slide ${index + 1}\n${xmlToText(zip.readAsText(entry))}`)
    .join("\n\n");
}

function requireAdmZip(): new (buffer: Buffer) => { getEntries(): Array<{ entryName: string }>; readAsText(entry: { entryName: string }): string } {
  const admZip = nodeRequire("adm-zip");
  return admZip.default ?? admZip;
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
