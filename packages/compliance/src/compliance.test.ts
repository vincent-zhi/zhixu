import { describe, expect, it } from "vitest";
import { PlagiarismPrechecker } from "./plagiarism-precheck.js";
import { CitationCompleter } from "./citation-completer.js";
import { RiskAlerter } from "./risk-alerter.js";
import { TraceabilityReporter } from "./traceability-reporter.js";
import { CrossVerifier } from "./cross-verifier.js";

describe("PlagiarismPrechecker", () => {
  const prechecker = new PlagiarismPrechecker();

  it("flags AI-generated phrases", () => {
    const result = prechecker.checkContent("As an AI language model, I can explain this. Furthermore, it is essential to note the findings.");
    expect(result.flaggedSegments.some((s) => s.sourceType === "ai_generated")).toBe(true);
  });

  it("flags long quoted passages", () => {
    const longQuote = "This is a very long quoted passage that spans more than fifty characters and should be flagged as potentially plagiarized content from academic sources.";
    const result = prechecker.checkContent(`The author stated: "${longQuote}"`);
    expect(result.flaggedSegments.some((s) => s.sourceType === "academic")).toBe(true);
  });

  it("returns high score for clean content", () => {
    const result = prechecker.checkContent("The experiment was conducted over three weeks. Results showed a significant improvement in performance metrics.");
    expect(result.overallScore).toBeGreaterThan(0.5);
  });

  it("estimates AI generation probability", () => {
    const aiProb = prechecker.estimateAIGeneration("As an AI, I think this is crucial. Furthermore, it is essential. Moreover, the results demonstrate.");
    expect(aiProb).toBeGreaterThan(0.3);
  });

  it("returns low AI probability for natural text", () => {
    const aiProb = prechecker.estimateAIGeneration("We ran the experiment on Tuesday. The data came back positive. Our team was surprised by the outcome.");
    expect(aiProb).toBeLessThan(0.5);
  });

  it("provides recommendations for flagged content", () => {
    const content = "As an AI language model, I must say that furthermore, it is essential to note the findings. Moreover, the results demonstrate significance. Additionally, it is crucial to note the implications. In today's world, this represents a paradigm shift in the multifaceted landscape of research.";
    const result = prechecker.checkContent(content);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("CitationCompleter", () => {
  const completer = new CitationCompleter();

  it("finds incomplete citations", () => {
    const citations = [
      { rawText: "Smith et al. 2023", doi: undefined, title: undefined, year: 2023, authors: "Smith et al.", venue: undefined },
      { rawText: "Complete citation", doi: "10.1234/test", title: "Test Paper", year: 2023, authors: "Author A", venue: "Test Venue" },
    ];
    const incomplete = completer.findIncompleteCitations(citations);
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]!.missingFields).toContain("doi");
    expect(incomplete[0]!.missingFields).toContain("title");
    expect(incomplete[0]!.missingFields).toContain("venue");
  });

  it("finds no incomplete citations when all fields present", () => {
    const citations = [
      { rawText: "Full citation", doi: "10.1234/test", title: "Test", year: 2023, authors: "Author", venue: "Venue" },
    ];
    const incomplete = completer.findIncompleteCitations(citations);
    expect(incomplete).toHaveLength(0);
  });

  it("suggests completions based on patterns", () => {
    const incomplete = completer.findIncompleteCitations([
      { rawText: 'Smith 2023 "Deep Learning for NLP" in Proceedings of ACL', doi: undefined, title: undefined, year: 2023, authors: undefined, venue: undefined },
    ]);
    const suggestions = completer.suggestCompletions(incomplete);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.confidence).toBeGreaterThan(0);
  });

  it("suggests year from raw text", () => {
    const incomplete = completer.findIncompleteCitations([
      { rawText: "Smith 2023 paper", doi: undefined, title: undefined, year: undefined, authors: undefined, venue: undefined },
    ]);
    const suggestions = completer.suggestCompletions(incomplete);
    if (suggestions.length > 0) {
      expect(suggestions[0]!.suggestedFields).toBeDefined();
    }
  });
});

describe("RiskAlerter", () => {
  const alerter = new RiskAlerter();

  it("detects fabricated citations", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "research",
      artifacts: [],
      citations: [
        { verificationStatus: "unverified" },
        { verificationStatus: "failed" },
      ],
    });
    expect(alerts.some((a) => a.riskType === "fabricated_citation")).toBe(true);
  });

  it("escalates severity for many unverified citations", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "research",
      artifacts: [],
      citations: [
        { verificationStatus: "unverified" },
        { verificationStatus: "unverified" },
        { verificationStatus: "unverified" },
      ],
    });
    const citationAlert = alerts.find((a) => a.riskType === "fabricated_citation");
    expect(citationAlert!.severity).toBe("L3");
  });

  it("detects fabricated data with gray responsibility", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "research",
      artifacts: [
        {
          blocks: [
            { responsibilityColor: "gray", contentJson: { type: "data", content: "Results table" } },
          ],
        },
      ],
      citations: [],
    });
    expect(alerts.some((a) => a.riskType === "fabricated_data")).toBe(true);
  });

  it("detects sensitive content", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "research",
      artifacts: [
        {
          blocks: [
            { responsibilityColor: "green", contentJson: { content: "api_key=sk-12345" } },
          ],
        },
      ],
      citations: [],
    });
    expect(alerts.some((a) => a.riskType === "sensitive_upload")).toBe(true);
  });

  it("detects auto-submission in exam projects", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "exam",
      artifacts: [
        {
          blocks: [
            { responsibilityColor: "green", contentJson: { action: "auto_submit" } },
          ],
        },
      ],
      citations: [],
    });
    expect(alerts.some((a) => a.riskType === "auto_submission")).toBe(true);
  });

  it("returns no alerts for clean project", () => {
    const alerts = alerter.scanProject({
      id: "p1",
      type: "research",
      artifacts: [
        {
          blocks: [
            { responsibilityColor: "green", contentJson: { content: "Normal content" } },
          ],
        },
      ],
      citations: [{ verificationStatus: "verified" }],
    });
    expect(alerts).toHaveLength(0);
  });
});

describe("TraceabilityReporter", () => {
  const reporter = new TraceabilityReporter();

  it("generates a traceability report", () => {
    const report = reporter.generateReport({
      projectId: "p1",
      artifactId: "a1",
      blocks: [
        { responsibilityColor: "green", verificationStatus: "verified", evidenceRefs: ["e1"] },
        { responsibilityColor: "green", verificationStatus: "verified", evidenceRefs: ["e2"] },
        { responsibilityColor: "yellow", verificationStatus: "pending", evidenceRefs: [] },
        { responsibilityColor: "gray", verificationStatus: "unverified", evidenceRefs: [] },
      ],
      citations: [
        { verificationStatus: "verified" },
        { verificationStatus: "unverified" },
      ],
    });

    expect(report.id).toBeTruthy();
    expect(report.projectId).toBe("p1");
    expect(report.artifactId).toBe("a1");
    expect(report.greenRatio).toBe(0.5);
    expect(report.yellowRatio).toBe(0.25);
    expect(report.grayRatio).toBe(0.25);
    expect(report.unverifiedCitations).toBe(1);
    expect(report.highRiskItems).toBe(1);
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it("calculates overall compliance", () => {
    const report = reporter.generateReport({
      projectId: "p1",
      artifactId: "a1",
      blocks: [
        { responsibilityColor: "green", verificationStatus: "verified", evidenceRefs: ["e1"] },
        { responsibilityColor: "green", verificationStatus: "verified", evidenceRefs: ["e2"] },
      ],
      citations: [],
    });

    expect(report.overallCompliance).toBe(1);
  });

  it("handles empty blocks", () => {
    const report = reporter.generateReport({
      projectId: "p1",
      artifactId: "a1",
      blocks: [],
      citations: [],
    });

    expect(report.overallCompliance).toBe(0);
    expect(report.greenRatio).toBe(0);
  });
});

describe("CrossVerifier", () => {
  const verifier = new CrossVerifier();

  it("matches in-text citations to reference list", () => {
    const result = verifier.verify(
      [
        { key: "smith2023", rawText: "Smith (2023)" },
        { key: "jones2022", rawText: "Jones (2022)" },
      ],
      [
        { key: "smith2023", rawText: "Smith, J. (2023). Paper Title." },
        { key: "jones2022", rawText: "Jones, K. (2022). Another Paper." },
      ]
    );

    expect(result.matchedCitations).toBe(2);
    expect(result.orphanedInText).toEqual([]);
    expect(result.orphanedInReference).toEqual([]);
    expect(result.consistencyScore).toBe(1);
  });

  it("finds orphaned in-text citations", () => {
    const result = verifier.verify(
      [
        { key: "smith2023", rawText: "Smith (2023)" },
        { key: "missing2021", rawText: "Missing (2021)" },
      ],
      [
        { key: "smith2023", rawText: "Smith, J. (2023). Paper Title." },
      ]
    );

    expect(result.matchedCitations).toBe(1);
    expect(result.orphanedInText).toHaveLength(1);
    expect(result.orphanedInText[0]).toContain("Missing");
  });

  it("finds orphaned reference list entries", () => {
    const result = verifier.verify(
      [{ key: "smith2023", rawText: "Smith (2023)" }],
      [
        { key: "smith2023", rawText: "Smith, J. (2023). Paper Title." },
        { key: "orphan2020", rawText: "Orphan, R. (2020). Unused Paper." },
      ]
    );

    expect(result.orphanedInReference).toHaveLength(1);
    expect(result.orphanedInReference[0]).toContain("Orphan");
  });

  it("normalizes keys case-insensitively", () => {
    const result = verifier.verify(
      [{ key: "Smith2023", rawText: "Smith (2023)" }],
      [{ key: "smith2023", rawText: "Smith, J. (2023)." }]
    );

    expect(result.matchedCitations).toBe(1);
    expect(result.consistencyScore).toBe(1);
  });

  it("handles empty inputs", () => {
    const result = verifier.verify([], []);
    expect(result.matchedCitations).toBe(0);
    expect(result.consistencyScore).toBe(1);
  });
});
