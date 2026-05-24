import { describe, it, expect } from "vitest";
import { KnowledgeGraphBuilder } from "./knowledge-graph.js";
import { StudyPlanner } from "./study-planner.js";
import { QuestionBank } from "./question-bank.js";
import type { CourseKnowledgeGraph, MistakeRecord, Question } from "./types.js";

describe("KnowledgeGraphBuilder", () => {
  const builder = new KnowledgeGraphBuilder();

  it("builds a knowledge graph from sources with headings", () => {
    const sources = [
      {
        id: "src-1",
        fileName: "chapter1_intro.pdf",
        content: "# Introduction\n## What is Machine Learning\nML is a subset of AI.\n### Supervised Learning\nUses labeled data."
      },
      {
        id: "src-2",
        fileName: "chapter2_methods.pdf",
        content: "# Methods\n## Linear Regression\nA simple method.\n## Neural Networks\nDeep learning approach."
      }
    ];

    const graph = builder.buildFromSources("proj-1", sources);

    expect(graph.projectId).toBe("proj-1");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const chapterNodes = graph.nodes.filter(n => n.type === "chapter");
    expect(chapterNodes).toHaveLength(2);

    const conceptNodes = graph.nodes.filter(n => n.type === "concept");
    expect(conceptNodes.length).toBeGreaterThan(0);
  });

  it("creates prerequisite edges between chapter nodes", () => {
    const sources = [
      { id: "src-1", fileName: "ch1.pdf", content: "# Chapter 1" },
      { id: "src-2", fileName: "ch2.pdf", content: "# Chapter 2" },
      { id: "src-3", fileName: "ch3.pdf", content: "# Chapter 3" }
    ];

    const graph = builder.buildFromSources("proj-2", sources);

    const prereqEdges = graph.edges.filter(e => e.type === "prerequisite");
    expect(prereqEdges).toHaveLength(2);
  });

  it("handles sources without content", () => {
    const sources = [
      { id: "src-1", fileName: "notes.pdf" }
    ];

    const graph = builder.buildFromSources("proj-3", sources);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe("chapter");
  });

  it("adds a mistake node and connects it", () => {
    const sources = [
      { id: "src-1", fileName: "ch1.pdf", content: "# Chapter 1\n## Concept A" }
    ];

    const graph = builder.buildFromSources("proj-4", sources);
    const conceptNode = graph.nodes.find(n => n.type === "concept");

    const mistake: MistakeRecord = {
      id: "m1",
      questionId: "q1",
      nodeId: conceptNode!.id,
      userAnswer: "Wrong answer",
      correctAnswer: "Right answer",
      attribution: "concept_unclear",
      reviewedAt: new Date().toISOString(),
      mastered: false
    };

    const updated = builder.addMistakeNode(graph, mistake);

    expect(updated.nodes.length).toBe(graph.nodes.length + 1);
    expect(updated.edges.length).toBe(graph.edges.length + 1);

    const mistakeNode = updated.nodes.find(n => n.type === "mistake");
    expect(mistakeNode).toBeDefined();
    expect(mistakeNode!.responsibilityColor).toBe("yellow");

    const mistakeEdge = updated.edges.find(e => e.from === mistakeNode!.id);
    expect(mistakeEdge).toBeDefined();
    expect(mistakeEdge!.type).toBe("often_confused");
  });
});

describe("StudyPlanner", () => {
  const planner = new StudyPlanner();

  function makeGraph(): CourseKnowledgeGraph {
    const builder = new KnowledgeGraphBuilder();
    return builder.buildFromSources("proj-plan", [
      { id: "s1", fileName: "ch1.pdf", content: "# Chapter 1\n## Concept A\n## Concept B" },
      { id: "s2", fileName: "ch2.pdf", content: "# Chapter 2\n## Concept C\n## Concept D" }
    ]);
  }

  it("generates a study plan with daily tasks", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 7);
    const examDateStr = examDate.toISOString().split("T")[0];

    const plan = planner.generatePlan("proj-plan", graph, examDateStr, 120);

    expect(plan.projectId).toBe("proj-plan");
    expect(plan.examDate).toBe(examDateStr);
    expect(plan.totalDays).toBeGreaterThanOrEqual(1);
    expect(plan.dailyTasks.length).toBeGreaterThan(0);
    expect(plan.dailyTasks[0].tasks.length).toBeGreaterThan(0);
  });

  it("prioritizes low-mastery nodes", () => {
    const graph = makeGraph();
    graph.nodes.forEach(n => { n.mastery = 0.8; });
    graph.nodes[0].mastery = 0.1;

    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 3);
    const examDateStr = examDate.toISOString().split("T")[0];

    const plan = planner.generatePlan("proj-plan", graph, examDateStr, 60);

    const firstDayNodeIds = plan.dailyTasks[0].tasks.map(t => t.nodeId);
    expect(firstDayNodeIds).toContain(graph.nodes[0].id);
  });

  it("alternates task types", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);
    const examDateStr = examDate.toISOString().split("T")[0];

    const plan = planner.generatePlan("proj-plan", graph, examDateStr, 90);

    const allTaskTypes = plan.dailyTasks.flatMap(d => d.tasks.map(t => t.type));
    const uniqueTypes = new Set(allTaskTypes);
    expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
  });
});

describe("QuestionBank", () => {
  const bank = new QuestionBank();

  it("generates questions for a concept node", () => {
    const questions = bank.generateQuestions("node-1", "Machine Learning", "concept", 3);

    expect(questions).toHaveLength(3);
    expect(questions[0].nodeId).toBe("node-1");
    expect(questions[0].question).toContain("Machine Learning");
    expect(questions[0].responsibilityColor).toBe("gray");
  });

  it("generates questions with options for concept type", () => {
    const questions = bank.generateQuestions("node-1", "Neural Networks", "concept", 1);

    expect(questions[0].options).toBeDefined();
    expect(questions[0].options!.length).toBeGreaterThan(1);
    expect(questions[0].type).toBe("multiple_choice");
  });

  it("generates formula questions", () => {
    const questions = bank.generateQuestions("node-2", "Bayes Theorem", "formula", 2);

    expect(questions).toHaveLength(2);
    expect(questions[0].question).toContain("Bayes Theorem");
  });

  it("generates the requested number of questions", () => {
    const questions = bank.generateQuestions("node-3", "Gradient Descent", "concept", 5);

    expect(questions).toHaveLength(5);
  });

  it("records a mistake from a question", () => {
    const question: Question = {
      id: "q-test-1",
      type: "multiple_choice",
      nodeId: "node-1",
      question: "What is ML?",
      options: ["A", "B", "C", "D"],
      answer: "A",
      explanation: "ML is A",
      difficulty: 3,
      responsibilityColor: "gray"
    };

    const mistake = bank.recordMistake(question, "B", "concept_unclear");

    expect(mistake.questionId).toBe("q-test-1");
    expect(mistake.nodeId).toBe("node-1");
    expect(mistake.userAnswer).toBe("B");
    expect(mistake.correctAnswer).toBe("A");
    expect(mistake.attribution).toBe("concept_unclear");
    expect(mistake.mastered).toBe(false);
  });

  it("identifies weak nodes from mistakes", () => {
    const builder = new KnowledgeGraphBuilder();
    const graph = builder.buildFromSources("proj-weak", [
      { id: "s1", fileName: "ch1.pdf", content: "# Chapter 1\n## Concept A\n## Concept B\n## Concept C" }
    ]);

    const conceptA = graph.nodes.find(n => n.label === "Concept A")!;
    const conceptB = graph.nodes.find(n => n.label === "Concept B")!;
    const conceptC = graph.nodes.find(n => n.label === "Concept C")!;

    const mistakes: MistakeRecord[] = [
      { id: "m1", questionId: "q1", nodeId: conceptA.id, userAnswer: "X", correctAnswer: "Y", attribution: "concept_unclear", reviewedAt: new Date().toISOString(), mastered: false },
      { id: "m2", questionId: "q2", nodeId: conceptA.id, userAnswer: "X", correctAnswer: "Y", attribution: "formula_misuse", reviewedAt: new Date().toISOString(), mastered: false },
      { id: "m3", questionId: "q3", nodeId: conceptB.id, userAnswer: "X", correctAnswer: "Y", attribution: "misread", reviewedAt: new Date().toISOString(), mastered: false },
    ];

    const weakNodes = bank.getWeakNodes(mistakes, graph);

    expect(weakNodes.length).toBeGreaterThan(0);
    expect(weakNodes[0].id).toBe(conceptA.id);
  });
});
