import { describe, expect, it } from "vitest";
import { DefenseSimulator } from "./defense-simulator.js";
import { ProcrastinationAdapterEngine } from "./procrastination-adapter.js";
import { SocraticCoach } from "./socratic-coach.js";
import { MeetingBriefer } from "./meeting-briefer.js";
import { DiagnosticEngine } from "./diagnostic-engine.js";
import type { DefenseQuestion, SocraticQuestion, LLMCallable } from "./types.js";

describe("DefenseSimulator", () => {
  const simulator = new DefenseSimulator();

  it("generates defense questions", () => {
    const questions = simulator.generateQuestions({
      projectTitle: "Deep Learning for NLP",
      projectType: "thesis",
      content: "This thesis explores deep learning methods for natural language processing.",
    });

    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(q.expectedPoints.length).toBeGreaterThan(0);
      expect(q.difficulty).toBeGreaterThanOrEqual(0);
      expect(q.difficulty).toBeLessThanOrEqual(1);
    }
  });

  it("evaluates an answer", () => {
    const question: DefenseQuestion = {
      id: "q1",
      category: "methodology",
      question: "Why did you choose this methodology?",
      expectedPoints: ["comparison with alternatives", "justification for choice"],
      difficulty: 0.5,
    };

    const result = simulator.evaluateAnswer(question, "I made a comparison with alternatives and my justification for choice is based on evidence.");
    expect(result.score).toBeGreaterThan(0);
    expect(result.coveredPoints.length).toBeGreaterThan(0);
  });

  it("detects missed points", () => {
    const question: DefenseQuestion = {
      id: "q1",
      category: "methodology",
      question: "Why did you choose this methodology?",
      expectedPoints: ["comparison with alternatives", "justification for choice", "limitations acknowledged"],
      difficulty: 0.5,
    };

    const result = simulator.evaluateAnswer(question, "I just picked it.");
    expect(result.missedPoints.length).toBeGreaterThan(0);
  });

  it("runs a full simulation", () => {
    const questions = simulator.generateQuestions({
      projectTitle: "Test Project",
      projectType: "thesis",
      content: "Test content",
    });

    const answers = questions.map((q) => ({
      questionId: q.id,
      answer: "I compared alternatives and justified my choice based on evidence and limitations.",
    }));

    const simulation = simulator.runSimulation(questions, answers);
    expect(simulation.id).toBeTruthy();
    expect(simulation.performance.answeredQuestions).toBe(questions.length);
    expect(simulation.performance.totalQuestions).toBe(questions.length);
    expect(simulation.overallScore).toBeGreaterThanOrEqual(0);
    expect(simulation.overallScore).toBeLessThanOrEqual(1);
  });
});

describe("ProcrastinationAdapterEngine", () => {
  const engine = new ProcrastinationAdapterEngine();

  it("analyzes slight delay with gentle nudge", () => {
    const result = engine.analyze({ projectId: "p1", currentDelay: 0.5, taskTitle: "Write introduction" });
    expect(result.suggestedApproach).toBe("gentle_nudge");
    expect(result.microTasks.length).toBeGreaterThan(0);
    expect(result.motivationMessage).toBeTruthy();
  });

  it("analyzes moderate delay with micro task", () => {
    const result = engine.analyze({ projectId: "p1", currentDelay: 2, taskTitle: "Write introduction" });
    expect(result.suggestedApproach).toBe("micro_task");
  });

  it("analyzes significant delay with break down", () => {
    const result = engine.analyze({ projectId: "p1", currentDelay: 5, taskTitle: "Write introduction" });
    expect(result.suggestedApproach).toBe("break_down");
  });

  it("analyzes long delay with deadline reframe", () => {
    const result = engine.analyze({ projectId: "p1", currentDelay: 10, taskTitle: "Write introduction" });
    expect(result.suggestedApproach).toBe("deadline_reframe");
  });

  it("analyzes very long delay with accountability", () => {
    const result = engine.analyze({ projectId: "p1", currentDelay: 20, taskTitle: "Write introduction" });
    expect(result.suggestedApproach).toBe("accountability");
  });

  it("generates micro tasks", () => {
    const tasks = engine.generateMicroTasks("Write introduction", 1);
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.id).toBeTruthy();
      expect(task.title).toBeTruthy();
      expect(task.estimatedMinutes).toBeGreaterThanOrEqual(5);
      expect(task.estimatedMinutes).toBeLessThanOrEqual(15);
      expect(task.completed).toBe(false);
    }
  });

  it("adds accountability task for long delays", () => {
    const tasks = engine.generateMicroTasks("Write introduction", 10);
    const hasAccountability = tasks.some((t) =>
      t.title.toLowerCase().includes("accountability") || t.title.toLowerCase().includes("partner")
    );
    expect(hasAccountability).toBe(true);
  });
});

describe("SocraticCoach", () => {
  const coach = new SocraticCoach();

  it("generates Socratic questions", () => {
    const questions = coach.generateQuestions("machine learning");
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(q.followUpQuestions.length).toBeGreaterThan(0);
      expect(q.relatedConcept).toBe("machine learning");
    }
  });

  it("generates more questions with greater depth", () => {
    const q1 = coach.generateQuestions("deep learning", 1);
    const q2 = coach.generateQuestions("deep learning", 3);
    expect(q2.length).toBeGreaterThanOrEqual(q1.length);
  });

  it("generates follow-up questions", () => {
    const previousQuestion: SocraticQuestion = {
      id: "sq-1",
      category: "assumption",
      question: "What assumptions underlie machine learning?",
      followUpQuestions: ["Are these assumptions justified?"],
      relatedConcept: "machine learning",
    };

    const followUps = coach.followUp(previousQuestion, "The main assumption is that data is representative.");
    expect(followUps.length).toBeGreaterThan(0);
    for (const q of followUps) {
      expect(q.id).toBeTruthy();
      expect(q.category).toBeTruthy();
    }
  });
});

describe("MeetingBriefer", () => {
  const briefer = new MeetingBriefer();

  it("generates a group meeting brief", () => {
    const brief = briefer.generateBrief({
      projectId: "p1",
      meetingType: "group_meeting",
      recentProgress: ["Completed data collection", "Started analysis"],
      upcomingDeadlines: ["Paper submission on June 1"],
    });

    expect(brief.id).toBeTruthy();
    expect(brief.projectId).toBe("p1");
    expect(brief.meetingType).toBe("group_meeting");
    expect(brief.keyPoints.length).toBeGreaterThan(0);
    expect(brief.suggestedSlides.length).toBeGreaterThan(0);
    expect(brief.anticipatedQuestions.length).toBeGreaterThan(0);
    expect(brief.preparationChecklist.length).toBeGreaterThan(0);
  });

  it("includes recent progress in key points", () => {
    const brief = briefer.generateBrief({
      projectId: "p1",
      meetingType: "advising",
      recentProgress: ["Finished experiment 1"],
      upcomingDeadlines: [],
    });

    expect(brief.keyPoints.some((p) => p.includes("Finished experiment 1"))).toBe(true);
  });

  it("includes deadline-related questions", () => {
    const brief = briefer.generateBrief({
      projectId: "p1",
      meetingType: "progress_update",
      recentProgress: [],
      upcomingDeadlines: ["Paper submission"],
    });

    expect(brief.anticipatedQuestions.some((q) => q.includes("Paper submission"))).toBe(true);
  });

  it("generates defense prep brief with more checklist items", () => {
    const brief = briefer.generateBrief({
      projectId: "p1",
      meetingType: "defense_prep",
      recentProgress: [],
      upcomingDeadlines: [],
    });

    expect(brief.preparationChecklist.length).toBeGreaterThanOrEqual(5);
  });
});

describe("DiagnosticEngine", () => {
  const engine = new DiagnosticEngine();

  it("generates a diagnostic report with good performance", () => {
    const report = engine.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      tasks: [
        { status: "completed", dueAt: "2025-01-10", completedAt: "2025-01-09" },
        { status: "completed", dueAt: "2025-01-15", completedAt: "2025-01-14" },
        { status: "completed", dueAt: "2025-01-20", completedAt: "2025-01-20" },
      ],
      artifacts: [
        { evidenceCoverage: 0.8 },
        { evidenceCoverage: 0.9 },
      ],
    });

    expect(report.id).toBeTruthy();
    expect(report.projectId).toBe("p1");
    expect(report.taskCompletionRate).toBe(1);
    expect(report.averageDelay).toBe(0);
    expect(report.strengthAreas.length).toBeGreaterThan(0);
  });

  it("identifies risk areas for poor performance", () => {
    const report = engine.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      tasks: [
        { status: "pending", dueAt: "2025-01-10", completedAt: null },
        { status: "pending", dueAt: "2025-01-15", completedAt: null },
        { status: "in_progress", dueAt: "2025-01-20", completedAt: null },
      ],
      artifacts: [
        { evidenceCoverage: 0.2 },
      ],
    });

    expect(report.taskCompletionRate).toBe(0);
    expect(report.riskAreas.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("calculates average delay correctly", () => {
    const report = engine.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      tasks: [
        { status: "completed", dueAt: "2025-01-10", completedAt: "2025-01-15" },
        { status: "completed", dueAt: "2025-01-10", completedAt: "2025-01-20" },
      ],
      artifacts: [],
    });

    expect(report.averageDelay).toBeGreaterThan(0);
  });

  it("calculates knowledge retention", () => {
    const report = engine.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      tasks: [
        { status: "completed", dueAt: "2025-01-10", completedAt: "2025-01-10" },
      ],
      artifacts: [
        { evidenceCoverage: 0.8 },
      ],
    });

    expect(report.knowledgeRetention).toBeGreaterThanOrEqual(0);
    expect(report.knowledgeRetention).toBeLessThanOrEqual(1);
  });
});

// --- LLM-Enhanced Method Tests ---

describe("DefenseSimulator LLM enhanced", () => {
  it("generateQuestionsFromPaper returns LLM-generated questions", async () => {
    const sim = new DefenseSimulator();
    const mockLLM: LLMCallable = {
      async chat() {
        return {
          content: JSON.stringify({
            questions: [
              { category: "methodology", question: "Why this method?", expectedPoints: ["justification"], difficulty: 0.5 },
              { category: "results", question: "What are findings?", expectedPoints: ["main results"], difficulty: 0.6 },
            ],
          }),
        };
      },
    };
    const result = await sim.generateQuestionsFromPaper("test paper content", mockLLM);
    expect(result.length).toBe(2);
    expect(result[0]!.category).toBe("methodology");
    expect(result[1]!.category).toBe("results");
  });

  it("generateQuestionsFromPaper falls back on LLM error", async () => {
    const sim = new DefenseSimulator();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await sim.generateQuestionsFromPaper("test paper content", badLLM);
    expect(result.length).toBeGreaterThan(0);
  });

  it("evaluateAnswerWithRubric returns LLM feedback", async () => {
    const sim = new DefenseSimulator();
    const mockLLM: LLMCallable = {
      async chat() {
        return {
          content: JSON.stringify({
            score: 0.8,
            strengths: ["Clear explanation"],
            weaknesses: ["Missing details"],
            suggestions: ["Add more detail"],
          }),
        };
      },
    };
    const question = sim.generateQuestions({ projectTitle: "Test", projectType: "research", content: "" })[0]!;
    const result = await sim.evaluateAnswerWithRubric(question, "test answer", mockLLM);
    expect(result.score).toBe(0.8);
    expect(result.strengths).toEqual(["Clear explanation"]);
    expect(result.suggestions).toEqual(["Add more detail"]);
  });

  it("evaluateAnswerWithRubric falls back on LLM error", async () => {
    const sim = new DefenseSimulator();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const question: DefenseQuestion = {
      id: "q1", category: "methodology", question: "Why?",
      expectedPoints: ["comparison with alternatives"], difficulty: 0.5,
    };
    const result = await sim.evaluateAnswerWithRubric(question, "I compared alternatives.", badLLM);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.strengths)).toBe(true);
  });
});

describe("SocraticCoach LLM enhanced", () => {
  it("generateContextualQuestions returns questions", async () => {
    const coach = new SocraticCoach();
    const mockLLM: LLMCallable = {
      async chat() {
        return {
          content: JSON.stringify([
            { category: "assumption", question: "What assumptions?", followUp: "Are they justified?" },
          ]),
        };
      },
    };
    const result = await coach.generateContextualQuestions("machine learning", [], { title: "ML Project", type: "research" }, mockLLM);
    expect(result.length).toBe(1);
    expect(result[0]!.category).toBe("assumption");
    expect(result[0]!.relatedConcept).toBe("machine learning");
    expect(result[0]!.followUpQuestions).toEqual(["Are they justified?"]);
  });

  it("generateContextualQuestions falls back on LLM error", async () => {
    const coach = new SocraticCoach();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await coach.generateContextualQuestions("topic", [], { title: "P", type: "t" }, badLLM);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("MeetingBriefer LLM enhanced", () => {
  it("generateProjectBrief returns LLM brief", async () => {
    const briefer = new MeetingBriefer();
    const mockLLM: LLMCallable = {
      async chat() {
        return {
          content: JSON.stringify({
            keyPoints: ["Point 1"],
            slideSuggestions: ["Slide 1"],
            anticipatedQuestions: ["Q1"],
            checklist: ["Check 1"],
          }),
        };
      },
    };
    const result = await briefer.generateProjectBrief({
      projectTitle: "Test Project", projectType: "research",
      recentProgress: ["Completed draft"], upcomingDeadlines: ["Friday"],
      sourceCount: 5, taskCount: 3, llm: mockLLM,
    });
    expect(result.keyPoints).toEqual(["Point 1"]);
    expect(result.suggestedSlides).toEqual(["Slide 1"]);
    expect(result.meetingType).toBe("group_meeting");
  });

  it("generateProjectBrief falls back on LLM error", async () => {
    const briefer = new MeetingBriefer();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await briefer.generateProjectBrief({
      projectTitle: "Test", projectType: "thesis",
      recentProgress: ["Draft done"], upcomingDeadlines: ["June 1"],
      sourceCount: 2, taskCount: 1, llm: badLLM,
    });
    expect(result.keyPoints.length).toBeGreaterThan(0);
    expect(result.meetingType).toBe("group_meeting");
  });
});

describe("DiagnosticEngine LLM enhanced", () => {
  it("generateInsightReport returns LLM insights", async () => {
    const engine = new DiagnosticEngine();
    const mockLLM: LLMCallable = {
      async chat() {
        return {
          content: JSON.stringify({
            insights: ["Focus on task completion", "Break large tasks into smaller ones"],
          }),
        };
      },
    };
    const result = await engine.generateInsightReport({
      tasks: [{ title: "Write paper", status: "completed", completedAt: "2026-05-28" }],
      sourceCount: 3, evidenceCoverage: 0.7, llm: mockLLM,
    });
    expect(result.aiInsights).toEqual(["Focus on task completion", "Break large tasks into smaller ones"]);
    expect(result.completionRate).toBe(1);
    expect(result.retentionScore).toBeGreaterThanOrEqual(0);
  });

  it("generateInsightReport falls back on LLM error", async () => {
    const engine = new DiagnosticEngine();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await engine.generateInsightReport({
      tasks: [{ title: "Write paper", status: "completed" }],
      sourceCount: 1, evidenceCoverage: 0.5, llm: badLLM,
    });
    expect(result.aiInsights).toEqual([]);
    expect(result.completionRate).toBe(1);
  });
});
