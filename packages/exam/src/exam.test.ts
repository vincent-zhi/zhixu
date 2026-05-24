import { describe, expect, it } from "vitest";
import { KnowledgeGraphBuilder } from "./knowledge-graph.js";
import { ReviewPlanner } from "./review-planner.js";
import { QuestionBankManager } from "./question-bank.js";
import type { KnowledgeGraph, MistakeAttribution, QuestionBank } from "./types.js";

describe("KnowledgeGraphBuilder", () => {
  const builder = new KnowledgeGraphBuilder();

  it("builds a knowledge graph from sources", () => {
    const sources = [
      {
        id: "src-1",
        content: "# Introduction\n## What is Machine Learning\nML is a subset of AI.\n### Supervised Learning\nUses labeled data.",
        type: "chapter1",
      },
      {
        id: "src-2",
        content: "# Methods\n## Linear Regression\nA simple method.\n## Neural Networks\nDeep learning approach.",
        type: "chapter2",
      },
    ];

    const graph = builder.buildFromSources(sources);

    expect(graph.id).toBeTruthy();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const chapterNodes = graph.nodes.filter((n) => n.type === "chapter");
    expect(chapterNodes).toHaveLength(2);

    const conceptNodes = graph.nodes.filter((n) => n.type === "concept");
    expect(conceptNodes.length).toBeGreaterThan(0);
  });

  it("creates prerequisite edges between chapter nodes", () => {
    const sources = [
      { id: "src-1", content: "# Chapter 1", type: "ch1" },
      { id: "src-2", content: "# Chapter 2", type: "ch2" },
      { id: "src-3", content: "# Chapter 3", type: "ch3" },
    ];

    const graph = builder.buildFromSources(sources);

    const prereqEdges = graph.edges.filter((e) => e.type === "prerequisite");
    expect(prereqEdges).toHaveLength(2);
  });

  it("adds a node to an existing graph", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1", type: "ch1" },
    ]);

    const node = builder.addNode(graph, {
      type: "concept",
      label: "New Concept",
      content: "A new concept",
      masteryLevel: 0,
      metadata: {},
    });

    expect(node.id).toBeTruthy();
    expect(node.label).toBe("New Concept");
    expect(graph.nodes).toContain(node);
  });

  it("adds an edge to an existing graph", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1", type: "ch1" },
    ]);

    const node1 = builder.addNode(graph, {
      type: "concept",
      label: "A",
      content: "Concept A",
      masteryLevel: 0,
      metadata: {},
    });
    const node2 = builder.addNode(graph, {
      type: "concept",
      label: "B",
      content: "Concept B",
      masteryLevel: 0,
      metadata: {},
    });

    const edge = builder.addEdge(graph, {
      fromNodeId: node1.id,
      toNodeId: node2.id,
      type: "prerequisite",
      weight: 1,
    });

    expect(edge.id).toBeTruthy();
    expect(graph.edges).toContain(edge);
  });

  it("finds weak areas based on mastery level", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1\n## Concept A\n## Concept B", type: "ch1" },
    ]);

    for (const node of graph.nodes) {
      node.masteryLevel = 0.9;
    }

    const conceptA = graph.nodes.find((n) => n.label === "Concept A")!;
    const conceptB = graph.nodes.find((n) => n.label === "Concept B")!;

    conceptA.masteryLevel = 0.2;
    conceptB.masteryLevel = 0.8;

    const weakAreas = builder.findWeakAreas(graph);

    expect(weakAreas).toHaveLength(1);
    expect(weakAreas[0]!.id).toBe(conceptA.id);
  });

  it("finds related nodes within max depth", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1\n## Concept A\n## Concept B", type: "ch1" },
    ]);

    const conceptA = graph.nodes.find((n) => n.label === "Concept A")!;
    const related = builder.findRelatedNodes(graph, conceptA.id, 1);

    expect(related.length).toBeGreaterThan(0);
  });

  it("finds related nodes with depth 2", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1\n## Concept A\n### Detail 1\n## Concept B", type: "ch1" },
    ]);

    const chapterNode = graph.nodes.find((n) => n.type === "chapter")!;
    const related1 = builder.findRelatedNodes(graph, chapterNode.id, 1);
    const related2 = builder.findRelatedNodes(graph, chapterNode.id, 2);

    expect(related2.length).toBeGreaterThanOrEqual(related1.length);
  });

  it("returns empty for nonexistent node", () => {
    const graph = builder.buildFromSources([
      { id: "src-1", content: "# Chapter 1", type: "ch1" },
    ]);

    const related = builder.findRelatedNodes(graph, "nonexistent", 1);
    expect(related).toEqual([]);
  });
});

describe("ReviewPlanner", () => {
  const planner = new ReviewPlanner();

  function makeGraph(): KnowledgeGraph {
    const builder = new KnowledgeGraphBuilder();
    return builder.buildFromSources([
      { id: "s1", content: "# Chapter 1\n## Concept A\n## Concept B", type: "ch1" },
      { id: "s2", content: "# Chapter 2\n## Concept C\n## Concept D", type: "ch2" },
    ]);
  }

  it("creates a review plan with daily tasks", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 7);
    const examDateStr = examDate.toISOString().split("T")[0]!;

    const plan = planner.createPlan({
      projectId: "proj-1",
      examDate: examDateStr,
      knowledgeGraph: graph,
    });

    expect(plan.id).toBeTruthy();
    expect(plan.projectId).toBe("proj-1");
    expect(plan.examDate).toBe(examDateStr);
    expect(plan.totalDays).toBeGreaterThanOrEqual(1);
    expect(plan.dailyTasks.length).toBeGreaterThan(0);
    expect(plan.dailyTasks[0]!.activities.length).toBeGreaterThan(0);
    expect(plan.progress).toBe(0);
  });

  it("respects dailyMinutes parameter", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 3);
    const examDateStr = examDate.toISOString().split("T")[0]!;

    const plan60 = planner.createPlan({
      projectId: "proj-1",
      examDate: examDateStr,
      knowledgeGraph: graph,
      dailyMinutes: 60,
    });

    const plan120 = planner.createPlan({
      projectId: "proj-1",
      examDate: examDateStr,
      knowledgeGraph: graph,
      dailyMinutes: 120,
    });

    expect(plan120.dailyTasks[0]!.estimatedMinutes).toBeGreaterThan(plan60.dailyTasks[0]!.estimatedMinutes);
  });

  it("updates progress when activities are completed", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);
    const examDateStr = examDate.toISOString().split("T")[0]!;

    const plan = planner.createPlan({
      projectId: "proj-1",
      examDate: examDateStr,
      knowledgeGraph: graph,
    });

    const firstDay = plan.dailyTasks[0]!;
    const activityIds = firstDay.activities.map((a) => a.id);

    const updated = planner.updateProgress(plan, 1, activityIds);

    expect(updated.dailyTasks[0]!.completed).toBe(true);
    expect(updated.progress).toBeGreaterThan(0);
  });

  it("adjusts plan based on performance", () => {
    const graph = makeGraph();
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);
    const examDateStr = examDate.toISOString().split("T")[0]!;

    const plan = planner.createPlan({
      projectId: "proj-1",
      examDate: examDateStr,
      knowledgeGraph: graph,
    });

    const performance = new Map<string, number>();
    for (const node of graph.nodes) {
      performance.set(node.id, 0.3);
    }

    const adjusted = planner.adjustPlan(plan, performance);

    expect(adjusted).toBeDefined();
    for (const node of adjusted.knowledgeGraph.nodes) {
      if (performance.has(node.id)) {
        expect(node.masteryLevel).toBe(0.3);
      }
    }
  });
});

describe("QuestionBankManager", () => {
  const manager = new QuestionBankManager();

  it("creates an empty question bank", () => {
    const bank = manager.createBank("proj-1");

    expect(bank.id).toBeTruthy();
    expect(bank.projectId).toBe("proj-1");
    expect(bank.questions).toEqual([]);
    expect(bank.mistakes).toEqual([]);
  });

  it("generates questions for given node IDs", () => {
    const bank = manager.createBank("proj-1");
    const questions = manager.generateQuestions(bank, ["node-1", "node-2"], 3);

    expect(questions).toHaveLength(3);
    expect(bank.questions).toHaveLength(3);

    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(q.stem).toBeTruthy();
      expect(q.answer).toBeTruthy();
      expect(q.nodeIds).toHaveLength(1);
    }
  });

  it("generates questions with specified types", () => {
    const bank = manager.createBank("proj-1");
    const questions = manager.generateQuestions(bank, ["node-1"], 3, ["multiple_choice", "true_false"]);

    for (const q of questions) {
      expect(["multiple_choice", "true_false"]).toContain(q.type);
    }
  });

  it("generates multiple choice questions with options", () => {
    const bank = manager.createBank("proj-1");
    const questions = manager.generateQuestions(bank, ["node-1"], 1, ["multiple_choice"]);

    expect(questions[0]!.options).toBeDefined();
    expect(questions[0]!.options!.length).toBeGreaterThan(1);
  });

  it("records a mistake", () => {
    const bank = manager.createBank("proj-1");
    manager.generateQuestions(bank, ["node-1"], 1);

    const question = bank.questions[0]!;
    const attribution: MistakeAttribution = {
      type: "concept_unclear",
      description: "Did not understand the concept",
      relatedNodeIds: ["node-1"],
    };

    const mistake = manager.recordMistake(bank, question.id, "user-1", "wrong answer", attribution);

    expect(mistake.id).toBeTruthy();
    expect(mistake.questionId).toBe(question.id);
    expect(mistake.userId).toBe("user-1");
    expect(mistake.userAnswer).toBe("wrong answer");
    expect(mistake.attribution.type).toBe("concept_unclear");
    expect(mistake.mastered).toBe(false);
    expect(mistake.reviewCount).toBe(0);
    expect(bank.mistakes).toHaveLength(1);
  });

  it("gets mistakes by attribution type", () => {
    const bank = manager.createBank("proj-1");
    manager.generateQuestions(bank, ["node-1"], 2);

    const q1 = bank.questions[0]!;
    const q2 = bank.questions[1]!;

    manager.recordMistake(bank, q1.id, "u1", "wrong", {
      type: "concept_unclear",
      description: "unclear",
      relatedNodeIds: [],
    });
    manager.recordMistake(bank, q2.id, "u1", "wrong", {
      type: "calculation_error",
      description: "calc error",
      relatedNodeIds: [],
    });

    const conceptMistakes = manager.getMistakesByAttribution(bank, "concept_unclear");
    expect(conceptMistakes).toHaveLength(1);
    expect(conceptMistakes[0]!.attribution.type).toBe("concept_unclear");

    const calcMistakes = manager.getMistakesByAttribution(bank, "calculation_error");
    expect(calcMistakes).toHaveLength(1);
  });

  it("generates questions targeting weak areas", () => {
    const builder = new KnowledgeGraphBuilder();
    const graph = builder.buildFromSources([
      { id: "s1", content: "# Chapter 1\n## Concept A\n## Concept B\n## Concept C", type: "ch1" },
    ]);

    const conceptA = graph.nodes.find((n) => n.label === "Concept A")!;
    const conceptB = graph.nodes.find((n) => n.label === "Concept B")!;
    const conceptC = graph.nodes.find((n) => n.label === "Concept C")!;

    conceptA.masteryLevel = 0.1;
    conceptB.masteryLevel = 0.2;
    conceptC.masteryLevel = 0.9;

    const bank = manager.createBank("proj-1");
    const questions = manager.getWeakAreaQuestions(bank, graph, 2);

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(2);
  });
});
