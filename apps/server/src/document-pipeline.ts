import type { AgentOutput, SourceSummary } from "@zhixu/core";
import {
  MarkItDownProvider,
  normalizeToAgentOutput,
  type DocumentParserProvider,
  type ParseResult,
  type DocumentNode,
  type EvidenceAnchor
} from "@zhixu/document-intelligence";

export class MockDocumentPipeline {
  async parseSource(source: SourceSummary): Promise<AgentOutput> {
    return {
      outputType: "source.parse",
      structuredResult: {
        provider: "mock-document-pipeline",
        document: {
          id: `doc_${source.id}`,
          sourceId: source.id,
          title: source.fileName,
          nodes: [
            {
              id: `node_${source.id}_0`,
              type: source.fileType.includes("presentation") ? "slide" : "paragraph",
              orderIndex: 0,
              text: `Parsed placeholder for ${source.fileName}`,
              evidenceAnchor: {
                sourceId: source.id,
                pageNumber: 1,
                textSpan: "0:120",
                responsibilityColor: "green",
                verificationStatus: "pending"
              }
            }
          ]
        }
      },
      confidence: 0.7,
      requiredConfirmations: [],
      evidenceRefs: [`source:${source.id}:page:1`],
      riskFlags: [],
      nextActions: ["build_index", "generate_summary"],
      costEstimate: {
        provider: "local",
        model: "mock-parser",
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0
      }
    };
  }
}

export class DocumentPipeline {
  private readonly providers: DocumentParserProvider[];

  constructor(providers?: DocumentParserProvider[]) {
    this.providers = providers ?? [new MarkItDownProvider()];
  }

  async parseSource(
    source: SourceSummary,
    content?: Buffer | string
  ): Promise<AgentOutput> {
    if (content !== undefined) {
      const provider = this.resolveProvider(source);
      const doc = await provider.parse({
        sourceId: source.id,
        fileName: source.fileName,
        fileType: source.fileType,
        content
      });
      return normalizeToAgentOutput(doc);
    }

    const mock = new MockDocumentPipeline();
    return mock.parseSource(source);
  }

  private resolveProvider(source: SourceSummary): DocumentParserProvider {
    for (const provider of this.providers) {
      if (provider.supportedFileTypes().includes(source.fileType)) {
        return provider;
      }
    }

    return this.providers[0]!;
  }
}
