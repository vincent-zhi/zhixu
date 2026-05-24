import { describe, expect, it } from "vitest";
import { DefenseSimulator } from "./defense-simulator.js";
import { ProcrastinationAdapterEngine } from "./procrastination-adapter.js";
import { SocraticCoach } from "./socratic-coach.js";
import { MeetingBriefer } from "./meeting-briefer.js";
import { DiagnosticEngine } from "./diagnostic-engine.js";
import type { DefenseQuestion, SocraticQuestion } from "./types.js";

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
