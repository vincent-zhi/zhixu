import { describe, it, expect } from "vitest";
import { PaperAnalyzer } from "./paper-analyzer.js";
import type { PaperMatrix } from "./types.js";

describe("PaperAnalyzer", () => {
  const analyzer = new PaperAnalyzer();

  const samplePaper = `# Introduction
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
Future directions include multilingual extension and few-shot learning capabilities.`;

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

  it("analyzes a single paper and extracts structured information", () => {
    const result = analyzer.analyzeSinglePaper("paper-1", samplePaper);

    expect(result.sourceId).toBe("paper-1");
    expect(result.problem).toContain("efficient text classification");
    expect(result.method).toContain("transformer");
    expect(result.data).toContain("GLUE");
    expect(result.metrics).toContain("accuracy");
    expect(result.mainResults).toContain("92.3%");
    expect(result.limitations).toContain("English language");
    expect(result.futureWork).toContain("multilingual");
    expect(result.responsibilityColor).toBe("gray");
  });

  it("returns 'Not specified' for missing sections", () => {
    const minimalPaper = "This is a paper with no headings at all.";
    const result = analyzer.analyzeSinglePaper("paper-minimal", minimalPaper);

    expect(result.sourceId).toBe("paper-minimal");
    expect(result.problem).toBe("Not specified in source");
    expect(result.method).toBe("Not specified in source");
  });

  it("builds a comparison matrix from multiple papers", () => {
    const paper1 = analyzer.analyzeSinglePaper("paper-1", samplePaper);
    const paper2 = analyzer.analyzeSinglePaper("paper-2", samplePaper2);

    const matrix = analyzer.buildComparisonMatrix("proj-1", [paper1, paper2]);

    expect(matrix.projectId).toBe("proj-1");
    expect(matrix.papers).toHaveLength(2);
    expect(matrix.methodCategories.length).toBeGreaterThan(0);
    expect(matrix.timeline).toBeDefined();
    expect(matrix.controversies).toBeDefined();
    expect(matrix.researchGaps).toBeDefined();
    expect(matrix.suggestedOutline).toBeDefined();
  });

  it("identifies controversies when papers differ", () => {
    const paper1: PaperMatrix = {
      sourceId: "src-a",
      problem: "Text classification",
      method: "Transformer with LoRA",
      data: "GLUE benchmark",
      metrics: "Accuracy and F1",
      mainResults: "92.3% accuracy",
      limitations: "English only",
      futureWork: "Multilingual",
      responsibilityColor: "gray"
    };

    const paper2: PaperMatrix = {
      sourceId: "src-b",
      problem: "Scalability of LLMs",
      method: "Distributed inference",
      data: "Serving traces",
      metrics: "Latency percentiles",
      mainResults: "40% latency reduction",
      limitations: "70B parameter limit",
      futureWork: "MoE models",
      responsibilityColor: "gray"
    };

    const matrix = analyzer.buildComparisonMatrix("proj-2", [paper1, paper2]);

    expect(matrix.controversies.length).toBeGreaterThan(0);
  });

  it("generates a suggested outline with sections", () => {
    const paper1 = analyzer.analyzeSinglePaper("paper-1", samplePaper);
    const matrix = analyzer.buildComparisonMatrix("proj-1", [paper1]);

    expect(matrix.suggestedOutline.length).toBeGreaterThanOrEqual(4);
    expect(matrix.suggestedOutline[0].section).toBe("Introduction");
    expect(matrix.suggestedOutline[0].keyPoints.length).toBeGreaterThan(0);
  });

  it("identifies research gaps from limitations and future work", () => {
    const paper1 = analyzer.analyzeSinglePaper("paper-1", samplePaper);
    const paper2 = analyzer.analyzeSinglePaper("paper-2", samplePaper2);

    const matrix = analyzer.buildComparisonMatrix("proj-1", [paper1, paper2]);

    expect(matrix.researchGaps.length).toBeGreaterThan(0);
  });

  it("handles single paper without controversies", () => {
    const paper1 = analyzer.analyzeSinglePaper("paper-1", samplePaper);
    const matrix = analyzer.buildComparisonMatrix("proj-single", [paper1]);

    expect(matrix.controversies).toEqual([]);
  });
});
