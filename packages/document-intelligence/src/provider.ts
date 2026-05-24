import type { AgentOutput } from "@zhixu/core";

export interface DocumentNode {
  id: string;
  sourceId: string;
  type: "paragraph" | "heading" | "slide" | "table" | "figure" | "list" | "code" | "quote";
  orderIndex: number;
  text: string;
  pageNumber?: number;
  children?: DocumentNode[];
  metadata?: Record<string, unknown>;
}

export interface EvidenceAnchor {
  sourceId: string;
  pageNumber?: number;
  textSpan?: string;
  boundingBox?: Record<string, unknown>;
  responsibilityColor: "green" | "yellow" | "gray";
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
}

export interface ParseResult {
  document: {
    id: string;
    sourceId: string;
    title: string;
    nodes: DocumentNode[];
  };
  evidenceAnchors: EvidenceAnchor[];
}

export interface DocumentParserProvider {
  readonly name: string;
  supportedFileTypes(): string[];
  parse(input: { sourceId: string; fileName: string; fileType: string; content: Buffer | string }): Promise<ParseResult>;
  toAgentOutput(sourceId: string, result: ParseResult): AgentOutput;
}
