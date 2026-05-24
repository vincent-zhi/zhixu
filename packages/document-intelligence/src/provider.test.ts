import { describe, expect, it } from "vitest";
import { MarkItDownProvider } from "./markitdown-provider.js";
import { normalizeParseResult, mergeResults } from "./normalizer.js";
import type { ParseResult, DocumentNode } from "./provider.js";

describe("MarkItDownProvider", () => {
  const provider = new MarkItDownProvider();

  describe("supportedFileTypes", () => {
    it("returns markdown and text types", () => {
      const types = provider.supportedFileTypes();
      expect(types).toContain("text/markdown");
      expect(types).toContain(".md");
      expect(types).toContain(".txt");
    });
  });

  describe("parse", () => {
    it("parses markdown with headings and paragraphs", async () => {
      const md = `# Main Title

This is the first paragraph.

## Section One

Content under section one.

### Subsection

More details here.`;

      const result = await provider.parse({
        sourceId: "src_1",
        fileName: "doc.md",
        fileType: "text/markdown",
        content: md
      });

      expect(result.document.id).toBe("doc_src_1");
      expect(result.document.sourceId).toBe("src_1");
      expect(result.document.title).toBe("Main Title");

      const headingNodes = result.document.nodes.filter((n) => n.type === "heading");
      expect(headingNodes.length).toBe(3);

      const h1 = headingNodes.find((n) => n.metadata?.level === 1);
      expect(h1?.text).toBe("Main Title");

      const h2 = headingNodes.find((n) => n.metadata?.level === 2);
      expect(h2?.text).toBe("Section One");

      const paragraphNodes = result.document.nodes.filter((n) => n.type === "paragraph");
      expect(paragraphNodes.length).toBe(3);
    });

    it("parses code blocks", async () => {
      const md = "## Code\n\n```js\nconst x = 1;\nconsole.log(x);\n```";

      const result = await provider.parse({
        sourceId: "src_2",
        fileName: "code.md",
        fileType: "text/markdown",
        content: md
      });

      const codeNode = result.document.nodes.find((n) => n.type === "code");
      expect(codeNode).toBeDefined();
      expect(codeNode!.text).toContain("const x = 1");
    });

    it("parses lists", async () => {
      const md = "## Items\n\n- First item\n- Second item\n- Third item";

      const result = await provider.parse({
        sourceId: "src_3",
        fileName: "list.md",
        fileType: "text/markdown",
        content: md
      });

      const listNode = result.document.nodes.find((n) => n.type === "list");
      expect(listNode).toBeDefined();
      expect(listNode!.text).toContain("First item");
      expect(listNode!.text).toContain("Second item");
    });

    it("parses blockquotes", async () => {
      const md = "> This is a quote\n> With multiple lines";

      const result = await provider.parse({
        sourceId: "src_4",
        fileName: "quote.md",
        fileType: "text/markdown",
        content: md
      });

      const quoteNode = result.document.nodes.find((n) => n.type === "quote");
      expect(quoteNode).toBeDefined();
      expect(quoteNode!.text).toContain("This is a quote");
    });

    it("parses tables", async () => {
      const md = "| A | B |\n|---|---|\n| 1 | 2 |";

      const result = await provider.parse({
        sourceId: "src_5",
        fileName: "table.md",
        fileType: "text/markdown",
        content: md
      });

      const tableNode = result.document.nodes.find((n) => n.type === "table");
      expect(tableNode).toBeDefined();
    });

    it("returns placeholder for unsupported file types", async () => {
      const result = await provider.parse({
        sourceId: "src_6",
        fileName: "report.pdf",
        fileType: "application/pdf",
        content: Buffer.from("binary")
      });

      expect(result.document.nodes).toHaveLength(1);
      expect(result.document.nodes[0]!.metadata?.placeholder).toBe(true);
      expect(result.evidenceAnchors[0]!.responsibilityColor).toBe("yellow");
    });

    it("generates evidence anchors for each node", async () => {
      const md = "# Title\n\nParagraph text.";

      const result = await provider.parse({
        sourceId: "src_7",
        fileName: "doc.md",
        fileType: "text/markdown",
        content: md
      });

      expect(result.evidenceAnchors).toHaveLength(result.document.nodes.length);
      for (const anchor of result.evidenceAnchors) {
        expect(anchor.sourceId).toBe("src_7");
        expect(anchor.responsibilityColor).toBe("green");
        expect(anchor.verificationStatus).toBe("pending");
      }
    });

    it("uses fileName as title when no h1 heading exists", async () => {
      const md = "Just a paragraph without heading.";

      const result = await provider.parse({
        sourceId: "src_8",
        fileName: "notes.md",
        fileType: "text/markdown",
        content: md
      });

      expect(result.document.title).toBe("notes.md");
    });

    it("accepts Buffer content", async () => {
      const md = "# Buffered\n\nFrom buffer.";
      const result = await provider.parse({
        sourceId: "src_buf",
        fileName: "buf.md",
        fileType: "text/markdown",
        content: Buffer.from(md)
      });

      expect(result.document.title).toBe("Buffered");
    });
  });

  describe("toAgentOutput", () => {
    it("converts ParseResult to AgentOutput", async () => {
      const md = "# Test\n\nHello world.";
      const result = await provider.parse({
        sourceId: "src_out",
        fileName: "test.md",
        fileType: "text/markdown",
        content: md
      });

      const output = provider.toAgentOutput("src_out", result);

      expect(output.outputType).toBe("source.parse");
      expect(output.confidence).toBe(0.85);
      expect(output.costEstimate.provider).toBe("local");
      expect(output.costEstimate.model).toBe("markitdown");
      expect(output.nextActions).toContain("build_index");
      expect(output.nextActions).toContain("generate_summary");
      expect(output.evidenceRefs.length).toBeGreaterThan(0);
    });
  });
});

describe("normalizeToAgentOutput (via MarkItDownProvider)", () => {
  it("produces valid AgentOutput from a ParseResult", async () => {
    const { normalizeToAgentOutput } = await import("./markitdown-provider.js");
    const md = "# Normalized\n\nContent.";
    const provider = new MarkItDownProvider();
    const result = await provider.parse({
      sourceId: "src_norm",
      fileName: "norm.md",
      fileType: "text/markdown",
      content: md
    });

    const output = normalizeToAgentOutput(result);
    expect(output.outputType).toBe("source.parse");
    expect(output.structuredResult).toHaveProperty("provider");
    expect(output.structuredResult).toHaveProperty("document");
  });
});

describe("ParseResultNormalizer", () => {
  function makeNode(overrides: Partial<DocumentNode> & { sourceId: string }): DocumentNode {
    return {
      id: overrides.id ?? `node_${overrides.sourceId}_0`,
      sourceId: overrides.sourceId,
      type: overrides.type ?? "paragraph",
      orderIndex: overrides.orderIndex ?? 0,
      text: overrides.text ?? "text"
    };
  }

  function makeResult(overrides: Partial<ParseResult> & { sourceId: string }): ParseResult {
    return {
      document: {
        id: overrides.document?.id ?? `doc_${overrides.sourceId}`,
        sourceId: overrides.sourceId,
        title: overrides.document?.title ?? "Test",
        nodes: overrides.document?.nodes ?? []
      },
      evidenceAnchors: overrides.evidenceAnchors ?? []
    };
  }

  describe("normalizeParseResult", () => {
    it("sorts nodes by orderIndex and re-indexes", () => {
      const result = makeResult({
        sourceId: "s1",
        document: {
          id: "doc_s1",
          sourceId: "s1",
          title: "Test",
          nodes: [
            makeNode({ sourceId: "s1", orderIndex: 2, text: "second" }),
            makeNode({ sourceId: "s1", orderIndex: 0, text: "first" }),
            makeNode({ sourceId: "s1", orderIndex: 1, text: "middle" })
          ]
        }
      });

      const normalized = normalizeParseResult(result);
      expect(normalized.document.nodes[0]!.orderIndex).toBe(0);
      expect(normalized.document.nodes[0]!.text).toBe("first");
      expect(normalized.document.nodes[1]!.orderIndex).toBe(1);
      expect(normalized.document.nodes[1]!.text).toBe("middle");
      expect(normalized.document.nodes[2]!.orderIndex).toBe(2);
      expect(normalized.document.nodes[2]!.text).toBe("second");
    });

    it("provides default title when missing", () => {
      const result: ParseResult = {
        document: { id: "doc_s2", sourceId: "s2", title: "", nodes: [] },
        evidenceAnchors: []
      };

      const normalized = normalizeParseResult(result);
      expect(normalized.document.title).toBe("Untitled");
    });

    it("removes empty children arrays", () => {
      const result = makeResult({
        sourceId: "s3",
        document: {
          id: "doc_s3",
          sourceId: "s3",
          title: "Test",
          nodes: [
            {
              ...makeNode({ sourceId: "s3" }),
              children: []
            }
          ]
        }
      });

      const normalized = normalizeParseResult(result);
      expect(normalized.document.nodes[0]!.children).toBeUndefined();
    });
  });

  describe("mergeResults", () => {
    it("returns empty result for empty array", () => {
      const merged = mergeResults([]);
      expect(merged.document.nodes).toHaveLength(0);
      expect(merged.evidenceAnchors).toHaveLength(0);
    });

    it("returns normalized single result", () => {
      const result = makeResult({
        sourceId: "s1",
        document: {
          id: "doc_s1",
          sourceId: "s1",
          title: "Single",
          nodes: [makeNode({ sourceId: "s1", text: "hello" })]
        }
      });

      const merged = mergeResults([result]);
      expect(merged.document.nodes).toHaveLength(1);
      expect(merged.document.title).toBe("Single");
    });

    it("merges multiple results with offset orderIndex", () => {
      const resultA = makeResult({
        sourceId: "sa",
        document: {
          id: "doc_sa",
          sourceId: "sa",
          title: "Doc A",
          nodes: [
            makeNode({ sourceId: "sa", orderIndex: 0, text: "A1" }),
            makeNode({ sourceId: "sa", orderIndex: 1, text: "A2" })
          ]
        }
      });

      const resultB = makeResult({
        sourceId: "sb",
        document: {
          id: "doc_sb",
          sourceId: "sb",
          title: "Doc B",
          nodes: [
            makeNode({ sourceId: "sb", orderIndex: 0, text: "B1" }),
            makeNode({ sourceId: "sb", orderIndex: 1, text: "B2" })
          ]
        }
      });

      const merged = mergeResults([resultA, resultB]);
      expect(merged.document.nodes).toHaveLength(4);
      expect(merged.document.sourceId).toBe("sa");
      expect(merged.document.title).toBe("Doc A");
      expect(merged.document.nodes[0]!.text).toBe("A1");
      expect(merged.document.nodes[2]!.text).toBe("B1");
      expect(merged.document.nodes[2]!.orderIndex).toBe(2);
    });

    it("merges evidence anchors from all results", () => {
      const resultA: ParseResult = {
        document: { id: "doc_sa", sourceId: "sa", title: "A", nodes: [] },
        evidenceAnchors: [
          { sourceId: "sa", responsibilityColor: "green", verificationStatus: "pending" }
        ]
      };
      const resultB: ParseResult = {
        document: { id: "doc_sb", sourceId: "sb", title: "B", nodes: [] },
        evidenceAnchors: [
          { sourceId: "sb", responsibilityColor: "green", verificationStatus: "pending" }
        ]
      };

      const merged = mergeResults([resultA, resultB]);
      expect(merged.evidenceAnchors).toHaveLength(2);
    });
  });
});
