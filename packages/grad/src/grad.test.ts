import { describe, expect, it } from "vitest";
import { SubmissionChecker } from "./submission-checker.js";
import { ReviewResponseEngine } from "./review-response.js";
import { ExperimentLogManager } from "./experiment-log.js";
import { GrantApplicationHelper } from "./grant-helper.js";
import { ResearchGapAnalyzer } from "./research-gap.js";
import { AcademicTrackerManager } from "./academic-tracker.js";
import { AcademicResumeBuilder } from "./academic-resume.js";
import { CitationFixer } from "./citation-fixer.js";
import type { GrantSection, ResumeSection } from "./types.js";

describe("SubmissionChecker", () => {
  const checker = new SubmissionChecker();

  it("checks submission against IEEE requirements", () => {
    const result = checker.checkSubmission({
      targetVenue: "IEEE",
      artifactContent: "This paper uses double-column format with IEEE citation style and experimental validation.",
    });

    expect(result.id).toBeTruthy();
    expect(result.targetVenue).toBe("IEEE");
    expect(result.requirements.length).toBeGreaterThan(0);
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(result.overallReadiness).toBeLessThanOrEqual(100);
  });

  it("checks submission against custom requirements", () => {
    const result = checker.checkSubmission({
      targetVenue: "CustomConf",
      artifactContent: "This paper has an abstract and references.",
      requirements: [
        { category: "structure", requirement: "abstract" },
        { category: "structure", requirement: "references" },
        { category: "format", requirement: "page limit" },
      ],
    });

    expect(result.requirements).toHaveLength(3);
    const passed = result.checks.filter((c) => c.status === "pass");
    expect(passed.length).toBeGreaterThan(0);
  });

  it("returns 0 readiness for empty content", () => {
    const result = checker.checkSubmission({
      targetVenue: "IEEE",
      artifactContent: "",
    });

    expect(result.overallReadiness).toBe(0);
  });
});

describe("ReviewResponseEngine", () => {
  const engine = new ReviewResponseEngine();

  it("parses review comments", () => {
    const rawReview = "Reviewer 1: The methodology is a major concern. The paper lacks clarity in section 3. Good work on the experiments.";
    const comments = engine.parseReviewComments(rawReview);

    expect(comments.length).toBeGreaterThan(0);
    const categories = comments.map((c) => c.category);
    expect(categories).toContain("major");
  });

  it("classifies comments correctly", () => {
    const comments = engine.parseReviewComments(
      "Major issue with the evaluation. Minor formatting problems. Please clarify the method. Good presentation overall.",
    );

    const types = comments.map((c) => c.category);
    expect(types).toContain("major");
    expect(types).toContain("minor");
    expect(types).toContain("clarification");
    expect(types).toContain("positive");
  });

  it("generates action items from comments", () => {
    const comments = engine.parseReviewComments("Major issue with evaluation methodology.");
    const actionItems = engine.generateActionItems(comments);

    expect(actionItems.length).toBe(comments.length);
    for (const item of actionItems) {
      expect(item.id).toBeTruthy();
      expect(item.status).toBe("pending");
    }
  });

  it("drafts response letter", () => {
    const comments = engine.parseReviewComments("Major issue. Minor typo.");
    const actionItems = engine.generateActionItems(comments);
    const letter = engine.draftResponseLetter(actionItems);

    expect(letter.length).toBe(actionItems.length);
    for (const section of letter) {
      expect(section.responseText).toBeTruthy();
      expect(section.actionTaken).toBeTruthy();
    }
  });

  it("creates full review response", () => {
    const response = engine.createReviewResponse("Reviewer 1: Major concern about methodology. Minor formatting issues.");

    expect(response.id).toBeTruthy();
    expect(response.reviewComments.length).toBeGreaterThan(0);
    expect(response.actionItems.length).toBeGreaterThan(0);
    expect(response.responseLetter.length).toBeGreaterThan(0);
    expect(response.overallStrategy).toBeTruthy();
  });
});

describe("ExperimentLogManager", () => {
  const manager = new ExperimentLogManager();

  it("creates an experiment log", () => {
    const log = manager.createLog({
      purpose: "Test hypothesis A",
      variables: [
        { name: "temperature", type: "independent", value: "25C" },
        { name: "yield", type: "dependent", value: "" },
      ],
      steps: [
        { order: 1, description: "Setup equipment", duration: "30min", notes: "" },
      ],
      environment: { lab: "Room 101" },
    });

    expect(log.id).toBeTruthy();
    expect(log.purpose).toBe("Test hypothesis A");
    expect(log.variables).toHaveLength(2);
    expect(log.steps).toHaveLength(1);
    expect(log.createdAt).toBeTruthy();
  });

  it("creates a minimal log", () => {
    const log = manager.createLog({ purpose: "Quick test" });
    expect(log.variables).toEqual([]);
    expect(log.steps).toEqual([]);
    expect(log.environment).toEqual({});
  });

  it("analyzes anomalies in a log", () => {
    const log = manager.createLog({ purpose: "Test" });
    log.issues = ["Unexpected noise in data"];
    log.results = "The experiment failed to produce expected results";

    const anomaly = manager.analyzeAnomaly(log);
    expect(anomaly.id).toBeTruthy();
    expect(anomaly.possibleCauses.length).toBeGreaterThan(0);
    expect(anomaly.suggestedActions.length).toBeGreaterThan(0);
  });

  it("detects missing variables as anomaly", () => {
    const log = manager.createLog({ purpose: "Test" });
    const anomaly = manager.analyzeAnomaly(log);
    expect(anomaly.possibleCauses.some((c) => c.includes("variables"))).toBe(true);
  });

  it("standardizes a log with missing fields", () => {
    const log = manager.createLog({ purpose: "Test" });
    log.steps = [
      { order: 5, description: "Step A", duration: "10min", notes: "" },
      { order: 2, description: "Step B", duration: "20min", notes: "" },
    ];

    const standardized = manager.standardizeLog(log);
    expect(standardized.steps[0]!.order).toBe(1);
    expect(standardized.steps[1]!.order).toBe(2);
  });
});

describe("GrantApplicationHelper", () => {
  const helper = new GrantApplicationHelper();

  it("analyzes a grant application", () => {
    const sections: GrantSection[] = [
      { type: "background", title: "Background", content: "Previous research data supports this approach", completeness: 80, issues: [] },
      { type: "innovation", title: "Innovation", content: "Novel methodology with experimental evidence", completeness: 70, issues: [] },
      { type: "methodology", title: "Methodology", content: "We will conduct experiments to validate", completeness: 60, issues: [] },
      { type: "feasibility", title: "Feasibility", content: "Preliminary data shows feasibility", completeness: 50, issues: [] },
    ];

    const result = helper.analyzeGrant({ grantType: "NSFC", sections });
    expect(result.id).toBeTruthy();
    expect(result.completeness).toBeGreaterThan(0);
    expect(result.logicGaps).toBeDefined();
    expect(result.evidenceGaps).toBeDefined();
  });

  it("detects missing required sections", () => {
    const sections: GrantSection[] = [
      { type: "background", title: "Background", content: "Some content", completeness: 50, issues: [] },
    ];

    const gaps = helper.checkLogicGaps(sections);
    expect(gaps.some((g) => g.includes("Missing"))).toBe(true);
  });

  it("detects evidence gaps", () => {
    const sections: GrantSection[] = [
      { type: "methodology", title: "Methodology", content: "We will use a novel approach that can solve all problems", completeness: 50, issues: [] },
    ];

    const gaps = helper.checkEvidenceGaps(sections);
    expect(gaps.length).toBeGreaterThan(0);
  });
});

describe("ResearchGapAnalyzer", () => {
  const analyzer = new ResearchGapAnalyzer();

  it("analyzes research gaps from papers", () => {
    const papers = [
      {
        title: "Deep Learning for NLP",
        limitations: "Limited to English language; does not handle low-resource languages",
        futureWork: "Extend to multilingual settings; explore transfer learning",
      },
      {
        title: "Transfer Learning in NLP",
        limitations: "Computational cost is prohibitive for real-time applications",
        futureWork: "Develop efficient inference methods",
      },
    ];

    const gaps = analyzer.analyzeGaps(papers);
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.id).toBeTruthy();
      expect(gap.description).toBeTruthy();
      expect(gap.feasibility).toBeGreaterThanOrEqual(1);
      expect(gap.feasibility).toBeLessThanOrEqual(10);
    }
  });

  it("scores research gaps", () => {
    const gap = {
      id: "gap-1",
      projectId: "",
      description: "Test gap",
      evidence: ["paper1", "paper2", "paper3"],
      feasibility: 8,
      risk: 3,
      requiredExperiments: ["exp1"],
      relatedPapers: ["paper1"],
    };

    const score = analyzer.scoreGap(gap);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores high-feasibility low-risk gaps higher", () => {
    const goodGap = {
      id: "g1",
      projectId: "",
      description: "Good gap",
      evidence: ["p1", "p2", "p3"],
      feasibility: 9,
      risk: 2,
      requiredExperiments: [],
      relatedPapers: ["p1"],
    };
    const badGap = {
      id: "g2",
      projectId: "",
      description: "Bad gap",
      evidence: [],
      feasibility: 3,
      risk: 9,
      requiredExperiments: ["e1", "e2", "e3", "e4"],
      relatedPapers: [],
    };

    expect(analyzer.scoreGap(goodGap)).toBeGreaterThan(analyzer.scoreGap(badGap));
  });
});

describe("AcademicTrackerManager", () => {
  const trackerManager = new AcademicTrackerManager();

  it("creates a tracker", () => {
    const tracker = trackerManager.createTracker({
      keywords: ["machine learning", "NLP"],
      authors: ["Smith", "Zhang"],
      venues: ["ACL", "NeurIPS"],
    });

    expect(tracker.id).toBeTruthy();
    expect(tracker.keywords).toHaveLength(2);
    expect(tracker.authors).toHaveLength(2);
    expect(tracker.venues).toHaveLength(2);
  });

  it("generates a digest filtering relevant papers", () => {
    const tracker = trackerManager.createTracker({
      keywords: ["machine learning"],
      authors: ["Smith"],
      venues: ["NeurIPS"],
    });

    const papers = [
      { title: "Machine Learning Advances", abstract: "New machine learning methods", year: 2025 },
      { title: "Unrelated Topic", abstract: "Something about cooking", year: 2025 },
      { title: "Smith et al. New Approach", abstract: "A novel approach by Smith", year: 2025 },
    ];

    const digest = trackerManager.generateDigest(tracker, papers);
    expect(digest.relevantPapers.length).toBeGreaterThan(0);
    expect(digest.relevantPapers.length).toBeLessThan(papers.length);
    expect(digest.newPapers).toBe(3);
    expect(digest.trends.length).toBeGreaterThan(0);
  });

  it("returns empty relevant papers when nothing matches", () => {
    const tracker = trackerManager.createTracker({
      keywords: ["quantum computing"],
      authors: [],
      venues: [],
    });

    const digest = trackerManager.generateDigest(tracker, [
      { title: "Cooking Tips", abstract: "How to bake bread", year: 2025 },
    ]);

    expect(digest.relevantPapers).toHaveLength(0);
  });
});

describe("AcademicResumeBuilder", () => {
  const builder = new AcademicResumeBuilder();

  it("creates an empty resume", () => {
    const resume = builder.createResume("user-1");
    expect(resume.id).toBeTruthy();
    expect(resume.userId).toBe("user-1");
    expect(resume.sections).toEqual([]);
  });

  it("adds sections to resume", () => {
    let resume = builder.createResume("user-1");
    const education: ResumeSection = {
      type: "education",
      entries: [{ title: "BS Computer Science", details: { university: "MIT" }, date: "2023" }],
    };

    resume = builder.addSection(resume, education);
    expect(resume.sections).toHaveLength(1);
    expect(resume.sections[0]!.type).toBe("education");
  });

  it("updates existing section type", () => {
    let resume = builder.createResume("user-1");
    const education1: ResumeSection = {
      type: "education",
      entries: [{ title: "BS", details: {}, date: "2023" }],
    };
    const education2: ResumeSection = {
      type: "education",
      entries: [{ title: "MS", details: {}, date: "2025" }],
    };

    resume = builder.addSection(resume, education1);
    resume = builder.addSection(resume, education2);
    expect(resume.sections).toHaveLength(1);
    expect(resume.sections[0]!.entries[0]!.title).toBe("MS");
  });

  it("generates resume for job scene", () => {
    let resume = builder.createResume("user-1");
    resume = builder.addSection(resume, {
      type: "publications",
      entries: [{ title: "Paper 1", details: {}, date: "2024" }],
    });
    resume = builder.addSection(resume, {
      type: "education",
      entries: [{ title: "PhD", details: {}, date: "2023" }],
    });
    resume = builder.addSection(resume, {
      type: "skills",
      entries: [{ title: "Python", details: {}, date: "2020" }],
    });

    const jobResume = builder.generateForScene(resume, "job");
    expect(jobResume.length).toBe(3);
    expect(jobResume[0]!.type).toBe("education");
  });

  it("generates resume for conference scene prioritizing publications", () => {
    let resume = builder.createResume("user-1");
    resume = builder.addSection(resume, {
      type: "education",
      entries: [{ title: "PhD", details: {}, date: "2023" }],
    });
    resume = builder.addSection(resume, {
      type: "publications",
      entries: [{ title: "Paper 1", details: {}, date: "2024" }],
    });

    const confResume = builder.generateForScene(resume, "conference");
    expect(confResume[0]!.type).toBe("publications");
  });
});

describe("CitationFixer", () => {
  const fixer = new CitationFixer();

  it("formats citations in APA style", () => {
    const result = fixer.formatCitations([
      { raw: "Smith, 2024, Deep Learning Methods", style: "APA" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.formatted).toContain("Smith");
    expect(result[0]!.style).toBe("APA");
  });

  it("formats citations in IEEE style", () => {
    const result = fixer.formatCitations([
      { raw: "Smith, Deep Learning Methods, 2024", style: "IEEE" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.formatted).toContain("Smith");
    expect(result[0]!.style).toBe("IEEE");
  });

  it("formats citations in GB/T 7714 style", () => {
    const result = fixer.formatCitations([
      { raw: "Smith, Deep Learning Methods, 2024", style: "GB/T 7714" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.formatted).toContain("Smith");
  });

  it("detects citation anomalies", () => {
    const anomalies = fixer.detectAnomalies([
      { raw: "Short", title: undefined, doi: undefined, year: undefined },
      { raw: "Valid citation with enough content", title: "Paper", doi: "10.1234/test", year: 2025 },
      { raw: "Another citation", title: "Paper 2", doi: undefined, year: 1800 },
    ]);

    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.includes("Missing"))).toBe(true);
    expect(anomalies.some((a) => a.includes("Suspicious year"))).toBe(true);
  });

  it("deduplicates citations by DOI", () => {
    const result = fixer.deduplicate([
      { raw: "Citation A", doi: "10.1234/abc", title: "Paper A" },
      { raw: "Citation B", doi: "10.1234/abc", title: "Paper A Duplicate" },
      { raw: "Citation C", doi: "10.5678/xyz", title: "Paper C" },
    ]);

    expect(result).toHaveLength(2);
  });

  it("deduplicates citations by title similarity", () => {
    const result = fixer.deduplicate([
      { raw: "Citation A", title: "Deep Learning for NLP" },
      { raw: "Citation B", title: "Deep Learning for NLP" },
    ]);

    expect(result).toHaveLength(1);
  });
});
