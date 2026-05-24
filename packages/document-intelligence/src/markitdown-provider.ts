import type { AgentOutput } from "@zhixu/core";
import type { DocumentParserProvider, DocumentNode, ParseResult, EvidenceAnchor } from "./provider.js";

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const CODE_FENCE_RE = /^```/;
const LIST_RE = /^(\s*)([-*+]|\d+\.)\s+(.+)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const TABLE_ROW_RE = /^\|(.+)\|$/;
const TABLE_SEP_RE = /^\|[\s-:]+\|$/;

interface RawBlock {
  type: "heading" | "paragraph" | "code" | "list" | "quote" | "table";
  level?: number;
  text: string;
  lines: string[];
}

function splitIntoBlocks(lines: string[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length,
        text: headingMatch[2]!.trim(),
        lines: [line]
      });
      i++;
      continue;
    }

    if (CODE_FENCE_RE.test(line)) {
      const fence = line;
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i] !== fence.replace(/`.*/, "```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) {
        codeLines.push(lines[i]!);
        i++;
      }
      const inner = codeLines.slice(1, -1).join("\n");
      blocks.push({ type: "code", text: inner, lines: codeLines });
      continue;
    }

    if (LIST_RE.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && (LIST_RE.test(lines[i]!) || (lines[i]!.trim() === ""))) {
        listLines.push(lines[i]!);
        i++;
      }
      const text = listLines
        .filter((l) => LIST_RE.test(l))
        .map((l) => LIST_RE.exec(l)![3]!)
        .join("\n");
      blocks.push({ type: "list", text, lines: listLines });
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i]!)) {
        quoteLines.push(lines[i]!);
        i++;
      }
      const text = quoteLines
        .map((l) => BLOCKQUOTE_RE.exec(l)![1]!)
        .join("\n");
      blocks.push({ type: "quote", text, lines: quoteLines });
      continue;
    }

    if (TABLE_ROW_RE.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (TABLE_ROW_RE.test(lines[i]!) || TABLE_SEP_RE.test(lines[i]!))) {
        tableLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "table", text: tableLines.join("\n"), lines: tableLines });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !HEADING_RE.test(lines[i]!) && !CODE_FENCE_RE.test(lines[i]!) && !LIST_RE.test(lines[i]!) && !BLOCKQUOTE_RE.test(lines[i]!) && !TABLE_ROW_RE.test(lines[i]!)) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join("\n"), lines: paraLines });
    }
  }

  return blocks;
}

function blocksToNodes(blocks: RawBlock[], sourceId: string): DocumentNode[] {
  return blocks.map((block, index) => {
    const nodeType = block.type as DocumentNode["type"];
    const node: DocumentNode = {
      id: `node_${sourceId}_${index}`,
      sourceId,
      type: nodeType,
      orderIndex: index,
      text: block.text
    };
    if (block.type === "heading" && block.level !== undefined) {
      node.metadata = { level: block.level };
    }
    return node;
  });
}

function buildEvidenceAnchors(nodes: DocumentNode[], sourceId: string): EvidenceAnchor[] {
  return nodes.map((node) => {
    const anchor: EvidenceAnchor = {
      sourceId,
      textSpan: `node:${node.id}`,
      responsibilityColor: "green" as const,
      verificationStatus: "pending" as const
    };
    if (node.pageNumber !== undefined) {
      anchor.pageNumber = node.pageNumber;
    }
    return anchor;
  });
}

export class MarkItDownProvider implements DocumentParserProvider {
  readonly name = "markitdown";

  supportedFileTypes(): string[] {
    return ["text/markdown", "text/plain", ".md", ".txt"];
  }

  async parse(input: { sourceId: string; fileName: string; fileType: string; content: Buffer | string }): Promise<ParseResult> {
    const contentStr = typeof input.content === "string" ? input.content : input.content.toString("utf-8");
    const ext = input.fileName.split(".").pop()?.toLowerCase();

    if (ext !== "md" && ext !== "txt" && !input.fileType.includes("markdown") && !input.fileType.includes("text/plain")) {
      return this.placeholderResult(input.sourceId, input.fileName);
    }

    const lines = contentStr.split("\n");
    const blocks = splitIntoBlocks(lines);
    const nodes = blocksToNodes(blocks, input.sourceId);
    const evidenceAnchors = buildEvidenceAnchors(nodes, input.sourceId);
    const title = this.extractTitle(blocks) || input.fileName;

    return {
      document: {
        id: `doc_${input.sourceId}`,
        sourceId: input.sourceId,
        title,
        nodes
      },
      evidenceAnchors
    };
  }

  toAgentOutput(sourceId: string, result: ParseResult): AgentOutput {
    return {
      outputType: "source.parse",
      structuredResult: {
        provider: this.name,
        document: result.document
      },
      confidence: 0.85,
      requiredConfirmations: [],
      evidenceRefs: result.evidenceAnchors.map((a) => `source:${a.sourceId}:node:${a.textSpan}`),
      riskFlags: [],
      nextActions: ["build_index", "generate_summary"],
      costEstimate: {
        provider: "local",
        model: "markitdown",
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0
      }
    };
  }

  private extractTitle(blocks: RawBlock[]): string | null {
    const firstHeading = blocks.find((b) => b.type === "heading" && b.level === 1);
    return firstHeading?.text ?? null;
  }

  private placeholderResult(sourceId: string, fileName: string): ParseResult {
    const node: DocumentNode = {
      id: `node_${sourceId}_0`,
      sourceId,
      type: "paragraph",
      orderIndex: 0,
      text: `Placeholder: real parsing of "${fileName}" requires the markitdown library`,
      metadata: { placeholder: true }
    };
    return {
      document: {
        id: `doc_${sourceId}`,
        sourceId,
        title: fileName,
        nodes: [node]
      },
      evidenceAnchors: [
        {
          sourceId,
          textSpan: `node:${node.id}`,
          responsibilityColor: "yellow",
          verificationStatus: "unverified"
        }
      ]
    };
  }
}

export function normalizeToAgentOutput(result: ParseResult): AgentOutput {
  const provider = new MarkItDownProvider();
  return provider.toAgentOutput(result.document.sourceId, result);
}
