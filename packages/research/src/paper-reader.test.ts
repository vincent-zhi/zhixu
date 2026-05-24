import { describe, expect, it } from "vitest";
import { PaperReader } from "./paper-reader.js";
import type { PaperEntry, PaperMatrix } from "./types.js";

describe("PaperReader", () => {
  const reader = new PaperReader();

  const samplePaper1 = `# Introduction
This paper addresses the problem of efficient text classification in low-resource settings.

# Method
We propose a novel transformer-based approach with parameter-efficient fine-tuning using LoRA adapters.

# Data
We evaluate on GLUE benchmark and a custom dataset of 10k examples.

# Evaluation
We use accuracy, F1 score, and AUC-ROC as evaluation metrics.

# Results
Our method achieves 92.3% accuracy, outperforming the baseline by 5.1 points on average.

# Limitations
The approach is limited to English language and requires at least 1000 labeled examples.

# Future Work
Future directions include multilingual extension and few-shot learning capabilities.

DOI: 10.1234/test.2023`;

  const samplePaper2 = `# Introduction
This work explores the scalability challenges of large language models in production.

# Method
We employ a distributed inference architecture with model sharding and quantization.

# Data
Experiments conducted on internal serving traces with 1M requests per day.

# Evaluation
Latency percentiles (P50, P95, P99) and throughput measured.

# Results
Our system reduces P99 latency by 40% while maintaining 99.9% availability.

# Limitations
Only tested on decoder-only architectures up to 70B parameters.

# Future Work
Extending to mixture-of-experts models and exploring dynamic batching strategies.`;

  describe("readPaper", () => {
    it("extracts structured fields from paper content", () => {
      const entry = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });

      expect(entry.id).toBeTruthy();
      expect(entry.sourceId).toBe("src-1");
      expect(entry.problem).toContain("efficient text classification");
      expect(entry.method).toContain("transformer");
      expect(entry.dataset).toContain("GLUE");
      expect(entry.mainResults).toContain("92.3%");
      expect(entry.limitations).toContain("English language");
      expect(entry.futureWork).toContain("multilingual");
    });

    it("extracts DOI from content", () => {
      const entry = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      expect(entry.doi).toBe("10.1234/test.2023");
    });

    it("returns null DOI when not present", () => {
      const entry = reader.readPaper({ id: "src-2", fileName: "paper2.pdf", content: samplePaper2 });
      expect(entry.doi).toBeNull();
    });

    it("extracts metrics as array", () => {
      const entry = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      expect(entry.metrics.length).toBeGreaterThan(0);
    });

    it("extracts year from content", () => {
      const entry = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      expect(entry.year).toBeGreaterThan(2000);
    });

    it("returns defaults for minimal content", () => {
      const entry = reader.readPaper({ id: "src-min", fileName: "minimal.pdf", content: "Just some text without headings." });
      expect(entry.problem).toBe("Not specified in source");
      expect(entry.method).toBe("Not specified in source");
      expect(entry.title).toBe("Untitled");
    });
  });

  describe("comparePapers", () => {
    it("generates a comparison matrix from multiple papers", () => {
      const paper1 = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      const paper2 = reader.readPaper({ id: "src-2", fileName: "paper2.pdf", content: samplePaper2 });

      const matrix = reader.comparePapers([paper1, paper2]);

      expect(matrix.id).toBeTruthy();
      expect(matrix.papers).toHaveLength(2);
      expect(matrix.comparisonMatrix.length).toBeGreaterThan(0);
      expect(matrix.timeline).toBeDefined();
      expect(matrix.researchGaps).toBeDefined();
      expect(matrix.controversies).toBeDefined();
      expect(matrix.suggestedOutline).toBeDefined();
    });

    it("builds comparison fields with paper values", () => {
      const paper1 = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      const paper2 = reader.readPaper({ id: "src-2", fileName: "paper2.pdf", content: samplePaper2 });

      const matrix = reader.comparePapers([paper1, paper2]);

      const problemField = matrix.comparisonMatrix.find((f) => f.field === "problem");
      expect(problemField).toBeDefined();
      expect(Object.keys(problemField!.values)).toHaveLength(2);
    });

    it("builds timeline sorted by year", () => {
      const paper1: PaperEntry = {
        id: "p1",
        sourceId: "s1",
        title: "Paper 1",
        authors: [],
        year: 2020,
        venue: "Conf A",
        problem: "test",
        method: "method A",
        dataset: "data A",
        metrics: [],
        mainResults: "result A",
        limitations: "limit A",
        futureWork: "future A",
        relevanceToProject: "",
        doi: null,
      };
      const paper2: PaperEntry = {
        ...paper1,
        id: "p2",
        sourceId: "s2",
        title: "Paper 2",
        year: 2022,
      };

      const matrix = reader.comparePapers([paper2, paper1]);

      expect(matrix.timeline[0]!.year).toBeLessThanOrEqual(matrix.timeline[1]!.year!);
    });

    it("identifies controversies when papers differ", () => {
      const paper1: PaperEntry = {
        id: "p1",
        sourceId: "s1",
        title: "Paper 1",
        authors: [],
        year: 2020,
        venue: "Conf A",
        problem: "Text classification",
        method: "Transformer with LoRA",
        dataset: "GLUE benchmark",
        metrics: [],
        mainResults: "92.3% accuracy",
        limitations: "English only",
        futureWork: "Multilingual",
        relevanceToProject: "",
        doi: null,
      };
      const paper2: PaperEntry = {
        ...paper1,
        id: "p2",
        sourceId: "s2",
        title: "Paper 2",
        problem: "Scalability of LLMs",
        method: "Distributed inference",
        dataset: "Serving traces",
      };

      const matrix = reader.comparePapers([paper1, paper2]);
      expect(matrix.controversies.length).toBeGreaterThan(0);
    });

    it("returns empty controversies for single paper", () => {
      const paper1 = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      const matrix = reader.comparePapers([paper1]);
      expect(matrix.controversies).toEqual([]);
    });

    it("identifies research gaps from limitations and future work", () => {
      const paper1 = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      const paper2 = reader.readPaper({ id: "src-2", fileName: "paper2.pdf", content: samplePaper2 });

      const matrix = reader.comparePapers([paper1, paper2]);
      expect(matrix.researchGaps.length).toBeGreaterThan(0);
    });
  });

  describe("generateReportOutline", () => {
    it("returns the suggested outline from the matrix", () => {
      const paper1 = reader.readPaper({ id: "src-1", fileName: "paper1.pdf", content: samplePaper1 });
      const matrix = reader.comparePapers([paper1]);

      const outline = reader.generateReportOutline(matrix);
      expect(outline.length).toBeGreaterThan(0);
      expect(outline).toContain("Introduction and Background");
      expect(outline).toContain("Conclusion");
    });
  });
});
