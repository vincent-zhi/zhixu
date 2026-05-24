import { describe, it, expect } from "vitest";
import { UnderstandingAgent } from "./understanding.js";
import { PlannerAgent } from "./planner.js";
import { DispatcherAgent } from "./dispatcher.js";
import { WorkerAgent } from "./worker.js";
import { VerifierAgent } from "./verifier.js";
import { MemoryManager } from "./memory.js";
import { ReflectionEngine } from "./reflection.js";
import { AgentPipeline } from "./pipeline.js";
import type { UnderstandingResult, PlanTask, DispatchResult, WorkerResult } from "./types.js";

describe("UnderstandingAgent", () => {
  const agent = new UnderstandingAgent();

  it("extracts goals from raw input with Chinese keywords", () => {
    const result = agent.analyze({
      rawInput: "我需要做一份关于量子计算的PPT",
      sources: []
    });
    expect(result.goals.length).toBeGreaterThan(0);
    expect(result.goals[0]).toContain("量子计算");
  });

  it("extracts goals from English keywords", () => {
    const result = agent.analyze({
      rawInput: "I need to write a research paper on AI",
      sources: []
    });
    expect(result.goals.length).toBeGreaterThan(0);
  });

  it("detects PPT deliverable", () => {
    const result = agent.analyze({
      rawInput: "帮我做一份PPT",
      sources: []
    });
    expect(result.deliverables).toContain("PPT");
  });

  it("detects 论文 deliverable", () => {
    const result = agent.analyze({
      rawInput: "我需要写一篇论文",
      sources: []
    });
    expect(result.deliverables).toContain("论文");
  });

  it("detects 报告 deliverable", () => {
    const result = agent.analyze({
      rawInput: "请帮我写一份报告",
      sources: []
    });
    expect(result.deliverables).toContain("报告");
  });

  it("defaults to 项目成果 when no deliverable keywords match", () => {
    const result = agent.analyze({
      rawInput: "帮我整理一些资料",
      sources: []
    });
    expect(result.deliverables).toContain("项目成果");
  });

  it("detects missing due date", () => {
    const result = agent.analyze({
      rawInput: "我需要做一份PPT",
      sources: []
    });
    expect(result.missingInfo).toContain("截止日期未指定");
  });

  it("does not flag missing due date when provided", () => {
    const result = agent.analyze({
      rawInput: "我需要做一份PPT",
      sources: [],
      dueDate: "2025-06-01"
    });
    expect(result.missingInfo).not.toContain("截止日期未指定");
  });

  it("detects missing sources", () => {
    const result = agent.analyze({
      rawInput: "我需要做一份PPT",
      sources: []
    });
    expect(result.missingInfo).toContain("未提供参考资料");
  });

  it("flags sensitive info from source file names", () => {
    const result = agent.analyze({
      rawInput: "我需要写论文",
      sources: [
        { id: "1", fileName: "未发表数据.pdf" },
        { id: "2", fileName: "公开资料.docx" }
      ]
    });
    expect(result.sensitiveInfo).toContain("未发表数据.pdf");
    expect(result.sensitiveInfo).not.toContain("公开资料.docx");
  });

  it("flags sensitive info for 导师 keyword in source", () => {
    const result = agent.analyze({
      rawInput: "我需要整理资料",
      sources: [
        { id: "1", fileName: "导师反馈.docx" }
      ]
    });
    expect(result.sensitiveInfo).toContain("导师反馈.docx");
  });

  it("raises risk flag for sensitive sources", () => {
    const result = agent.analyze({
      rawInput: "我需要写论文",
      sources: [
        { id: "1", fileName: "unpublished draft.pdf" }
      ]
    });
    expect(result.riskFlags).toContain("包含敏感资料");
  });

  it("raises risk flag for urgent timeline", () => {
    const result = agent.analyze({
      rawInput: "紧急！我需要今天完成PPT",
      sources: []
    });
    expect(result.riskFlags).toContain("时间紧迫");
  });

  it("includes source scope from provided sources", () => {
    const result = agent.analyze({
      rawInput: "我需要做汇报",
      sources: [
        { id: "1", fileName: "数据.xlsx" },
        { id: "2", fileName: "参考文献.pdf" }
      ]
    });
    expect(result.sourceScope).toEqual(["数据.xlsx", "参考文献.pdf"]);
  });

  it("computes higher confidence with complete info", () => {
    const result = agent.analyze({
      rawInput: "我需要做一份关于机器学习的PPT",
      sources: [{ id: "1", fileName: "ml-basics.pdf" }],
      dueDate: "2025-07-01"
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("computes lower confidence with missing info", () => {
    const result = agent.analyze({
      rawInput: "帮我整理资料",
      sources: []
    });
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("returns null dueDate when not provided", () => {
    const result = agent.analyze({
      rawInput: "我需要做PPT",
      sources: []
    });
    expect(result.dueDate).toBeNull();
  });

  it("returns provided dueDate", () => {
    const result = agent.analyze({
      rawInput: "我需要做PPT",
      sources: [],
      dueDate: "2025-06-01"
    });
    expect(result.dueDate).toBe("2025-06-01");
  });
});

describe("PlannerAgent", () => {
  const planner = new PlannerAgent();

  function makeUnderstanding(overrides?: Partial<UnderstandingResult>): UnderstandingResult {
    return {
      goals: ["做PPT"],
      deliverables: ["PPT"],
      dueDate: "2025-06-01",
      sourceScope: [],
      riskFlags: [],
      missingInfo: [],
      sensitiveInfo: [],
      confidence: 0.8,
      ...overrides
    };
  }

  it("generates three distinct plans", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.recommended).toBeDefined();
    expect(result.expedited).toBeDefined();
    expect(result.conservative).toBeDefined();
  });

  it("each plan has correct planType", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.recommended.planType).toBe("recommended");
    expect(result.expedited.planType).toBe("expedited");
    expect(result.conservative.planType).toBe("conservative");
  });

  it("expedited has higher AI involvement than recommended", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.expedited.aiInvolvementRatio).toBeGreaterThan(result.recommended.aiInvolvementRatio);
  });

  it("conservative has lower AI involvement than recommended", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.conservative.aiInvolvementRatio).toBeLessThan(result.recommended.aiInvolvementRatio);
  });

  it("conservative has highest quality ceiling", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.conservative.qualityCeiling).toBeGreaterThan(result.recommended.qualityCeiling);
    expect(result.recommended.qualityCeiling).toBeGreaterThan(result.expedited.qualityCeiling);
  });

  it("expedited has highest overtime risk", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.expedited.overtimeRisk).toBeGreaterThan(result.recommended.overtimeRisk);
    expect(result.recommended.overtimeRisk).toBeGreaterThan(result.conservative.overtimeRisk);
  });

  it("each plan has 3-8 tasks", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    for (const plan of [result.recommended, result.expedited, result.conservative]) {
      expect(plan.taskTree.length).toBeGreaterThanOrEqual(3);
      expect(plan.taskTree.length).toBeLessThanOrEqual(8);
    }
  });

  it("tasks have sequential dependencies", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    for (const plan of [result.recommended, result.expedited, result.conservative]) {
      expect(plan.taskTree[0]?.dependencies).toEqual([]);
      for (let i = 1; i < plan.taskTree.length; i++) {
        expect(plan.taskTree[i]?.dependencies.length).toBeGreaterThan(0);
      }
    }
  });

  it("includes human gate nodes for L2+ tasks", () => {
    const result = planner.generateThreePlans(makeUnderstanding({ deliverables: ["论文"] }));
    for (const plan of [result.recommended, result.expedited, result.conservative]) {
      const l2Tasks = plan.taskTree.filter((t) => t.riskLevel === "L2" || t.riskLevel === "L3");
      for (const task of l2Tasks) {
        expect(plan.humanGateNodes).toContain(task.id);
      }
    }
  });

  it("includes skill candidates for relevant tasks", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.recommended.skillCandidates.length).toBeGreaterThan(0);
  });

  it("includes dependencies between tasks", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.recommended.dependencies.length).toBeGreaterThan(0);
  });

  it("includes comparison summary", () => {
    const result = planner.generateThreePlans(makeUnderstanding());
    expect(result.comparisonSummary.length).toBeGreaterThan(0);
    expect(result.comparisonSummary).toContain("推荐方案");
  });

  it("PPT plan includes expected task titles", () => {
    const result = planner.generateThreePlans(makeUnderstanding({ deliverables: ["PPT"] }));
    const titles = result.recommended.taskTree.map((t) => t.title);
    expect(titles).toContain("选题与目标确认");
    expect(titles).toContain("大纲生成");
    expect(titles).toContain("内容生成");
  });

  it("论文 plan uses literature template", () => {
    const result = planner.generateThreePlans(makeUnderstanding({ deliverables: ["论文"] }));
    const titles = result.recommended.taskTree.map((t) => t.title);
    expect(titles).toContain("文献检索与筛选");
    expect(titles).toContain("综述撰写");
  });

  it("higher source gap risk when no sources provided", () => {
    const noSources = planner.generateThreePlans(makeUnderstanding({ sourceScope: [] }));
    const withSources = planner.generateThreePlans(makeUnderstanding({ sourceScope: ["a.pdf"] }));
    expect(noSources.recommended.sourceGapRisk).toBeGreaterThan(withSources.recommended.sourceGapRisk);
  });

  it("expedited plan escalates L2 tasks to L3", () => {
    const result = planner.generateThreePlans(makeUnderstanding({ deliverables: ["论文"] }));
    const recommendedL2 = result.recommended.taskTree.filter((t) => t.riskLevel === "L2");
    const expeditedL3 = result.expedited.taskTree.filter((t) => t.riskLevel === "L3");
    if (recommendedL2.length > 0) {
      expect(expeditedL3.length).toBeGreaterThanOrEqual(recommendedL2.length);
    }
  });
});

describe("DispatcherAgent", () => {
  const dispatcher = new DispatcherAgent();

  function makePlan(tasks: Partial<PlanTask>[]): import("./types.js").PlanOption {
    return {
      id: "test",
      label: "Test",
      planType: "recommended",
      taskTree: tasks.map((t, i) => ({
        id: t.id ?? `t${i + 1}`,
        title: t.title ?? "Task",
        assigneeType: t.assigneeType ?? "ai",
        responsibilityLabel: t.responsibilityLabel ?? "ai_draft",
        estimatedDuration: t.estimatedDuration ?? 20,
        dependencies: t.dependencies ?? [],
        riskLevel: t.riskLevel ?? "L1"
      })),
      dependencies: [],
      estimatedCompletionProbability: 0.85,
      overtimeRisk: 0.15,
      contentErrorRisk: 0.2,
      sourceGapRisk: 0.15,
      aiInvolvementRatio: 0.4,
      userEffortHours: 2.5,
      qualityCeiling: 8.0,
      applicableScenario: "test",
      humanGateNodes: tasks.filter((t) => t.riskLevel === "L2" || t.riskLevel === "L3").map((t, i) => t.id ?? `t${i + 1}`),
      skillCandidates: []
    };
  }

  it("assigns human tasks to user", () => {
    const plan = makePlan([{ assigneeType: "human" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.assignedTo).toBe("user");
  });

  it("assigns L3 tasks to user regardless of assigneeType", () => {
    const plan = makePlan([{ assigneeType: "ai", riskLevel: "L3" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.assignedTo).toBe("user");
  });

  it("assigns ai_human tasks to model", () => {
    const plan = makePlan([{ assigneeType: "ai_human" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.assignedTo).toBe("model");
  });

  it("assigns ai tasks to model by default", () => {
    const plan = makePlan([{ assigneeType: "ai" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.assignedTo).toBe("model");
  });

  it("calculates estimated cost based on task duration", () => {
    const plan = makePlan([{ assigneeType: "ai", estimatedDuration: 20 }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.estimatedCost).toBeGreaterThan(0);
  });

  it("user tasks have zero cost", () => {
    const plan = makePlan([{ assigneeType: "human" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.estimatedCost).toBe(0);
  });

  it("flags tasks requiring human gate", () => {
    const plan = makePlan([{ riskLevel: "L2" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.requiresHumanGate).toBe(true);
  });

  it("does not flag L0 tasks for human gate", () => {
    const plan = makePlan([{ riskLevel: "L0" }]);
    const result = dispatcher.dispatch(plan);
    expect(result[0]?.requiresHumanGate).toBe(false);
  });

  it("returns one dispatch per task", () => {
    const plan = makePlan([
      { assigneeType: "ai" },
      { assigneeType: "human" },
      { assigneeType: "ai_human" }
    ]);
    const result = dispatcher.dispatch(plan);
    expect(result.length).toBe(3);
  });
});

describe("WorkerAgent", () => {
  const worker = new WorkerAgent();

  it("produces a WorkerResult with all required fields", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: false
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "大纲生成",
      taskRiskLevel: "L1"
    });

    expect(result.taskId).toBe("t1");
    expect(result.outputType).toBeDefined();
    expect(result.structuredResult).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.requiredConfirmations)).toBe(true);
    expect(Array.isArray(result.evidenceRefs)).toBe(true);
    expect(Array.isArray(result.riskFlags)).toBe(true);
    expect(Array.isArray(result.nextActions)).toBe(true);
    expect(typeof result.costEstimate).toBe("number");
  });

  it("returns waiting status for user-assigned tasks", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "user",
      estimatedCost: 0,
      requiresHumanGate: true
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "Review",
      taskRiskLevel: "L0"
    });
    expect(result.structuredResult["status"]).toBe("waiting_for_user");
  });

  it("returns completed status for model-assigned tasks", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: false
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "内容生成",
      taskRiskLevel: "L1"
    });
    expect(result.structuredResult["status"]).toBe("completed");
  });

  it("includes evidence refs for non-user tasks", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: false
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "内容生成",
      taskRiskLevel: "L1"
    });
    expect(result.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("has no evidence refs for user tasks", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "user",
      estimatedCost: 0,
      requiresHumanGate: true
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "Review",
      taskRiskLevel: "L0"
    });
    expect(result.evidenceRefs.length).toBe(0);
  });

  it("requires confirmations for human gate tasks", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: true
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "选题确认",
      taskRiskLevel: "L1"
    });
    expect(result.requiredConfirmations.length).toBeGreaterThan(0);
  });

  it("maps task titles to output types", async () => {
    const dispatch: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: false
    };
    const result = await worker.execute(dispatch, {
      taskTitle: "大纲生成",
      taskRiskLevel: "L1"
    });
    expect(result.outputType).toBe("outline");
  });

  it("computes lower confidence for higher risk tasks", async () => {
    const dispatchLow: DispatchResult = {
      taskId: "t1",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: false
    };
    const dispatchHigh: DispatchResult = {
      taskId: "t2",
      assignedTo: "model",
      estimatedCost: 0.06,
      requiresHumanGate: true
    };
    const lowResult = await worker.execute(dispatchLow, { taskTitle: "Task", taskRiskLevel: "L0" });
    const highResult = await worker.execute(dispatchHigh, { taskTitle: "Task", taskRiskLevel: "L2" });
    expect(lowResult.confidence).toBeGreaterThan(highResult.confidence);
  });
});

describe("VerifierAgent", () => {
  const verifier = new VerifierAgent();

  function makeWorkerResult(overrides?: Partial<WorkerResult>): WorkerResult {
    return {
      taskId: "t1",
      outputType: "content_draft",
      structuredResult: { status: "completed", summary: "Test output" },
      confidence: 0.85,
      requiredConfirmations: [],
      evidenceRefs: ["evidence-1"],
      riskFlags: [],
      nextActions: ["continue"],
      costEstimate: 0.06,
      ...overrides
    };
  }

  function makeTask(overrides?: Partial<PlanTask>): PlanTask {
    return {
      id: "t1",
      title: "内容生成",
      assigneeType: "ai",
      responsibilityLabel: "ai_draft",
      estimatedDuration: 20,
      dependencies: [],
      riskLevel: "L1",
      ...overrides
    };
  }

  it("passes for valid worker result with evidence", () => {
    const result = verifier.verify(makeWorkerResult(), makeTask());
    expect(result.passed).toBe(true);
    expect(result.overallScore).toBeGreaterThan(0.5);
  });

  it("fails fact check when AI content has no evidence", () => {
    const result = verifier.verify(
      makeWorkerResult({ evidenceRefs: [] }),
      makeTask({ assigneeType: "ai" })
    );
    expect(result.factCheck.passed).toBe(false);
    expect(result.factCheck.issues.length).toBeGreaterThan(0);
  });

  it("passes fact check for human tasks without evidence", () => {
    const result = verifier.verify(
      makeWorkerResult({ evidenceRefs: [] }),
      makeTask({ assigneeType: "human" })
    );
    expect(result.factCheck.passed).toBe(true);
  });

  it("fails citation check for content_draft without evidence", () => {
    const result = verifier.verify(
      makeWorkerResult({ evidenceRefs: [], outputType: "content_draft" }),
      makeTask()
    );
    expect(result.citationCheck.passed).toBe(false);
  });

  it("fails responsibility check for L2 task without confirmations", () => {
    const result = verifier.verify(
      makeWorkerResult({ requiredConfirmations: [] }),
      makeTask({ riskLevel: "L2" })
    );
    expect(result.responsibilityCheck.passed).toBe(false);
  });

  it("passes responsibility check for L2 task with confirmations", () => {
    const result = verifier.verify(
      makeWorkerResult({ requiredConfirmations: ["请确认结果"] }),
      makeTask({ riskLevel: "L2" })
    );
    expect(result.responsibilityCheck.passed).toBe(true);
  });

  it("fails format check for empty structured result", () => {
    const result = verifier.verify(
      makeWorkerResult({ structuredResult: {} }),
      makeTask()
    );
    expect(result.formatCheck.passed).toBe(false);
  });

  it("fails logic check when risk flags and high confidence conflict", () => {
    const result = verifier.verify(
      makeWorkerResult({ riskFlags: ["高风险"], confidence: 0.95 }),
      makeTask()
    );
    expect(result.logicCheck.passed).toBe(false);
  });

  it("fails compliance check for prohibited content", () => {
    const result = verifier.verify(
      makeWorkerResult({ structuredResult: { content: "这是抄袭的内容" } }),
      makeTask()
    );
    expect(result.complianceCheck.passed).toBe(false);
    expect(result.complianceCheck.score).toBe(0);
  });

  it("fails export integrity for export_result without status", () => {
    const result = verifier.verify(
      makeWorkerResult({ outputType: "export_result", structuredResult: { data: "test" } }),
      makeTask()
    );
    expect(result.exportIntegrityCheck.passed).toBe(false);
  });

  it("computes overall score as average of check scores", () => {
    const result = verifier.verify(makeWorkerResult(), makeTask());
    const checks = [
      result.factCheck,
      result.citationCheck,
      result.responsibilityCheck,
      result.formatCheck,
      result.logicCheck,
      result.complianceCheck,
      result.exportIntegrityCheck
    ];
    const expected = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    expect(result.overallScore).toBeCloseTo(expected);
  });

  it("returns all 7 check dimensions", () => {
    const result = verifier.verify(makeWorkerResult(), makeTask());
    expect(result.factCheck).toBeDefined();
    expect(result.citationCheck).toBeDefined();
    expect(result.responsibilityCheck).toBeDefined();
    expect(result.formatCheck).toBeDefined();
    expect(result.logicCheck).toBeDefined();
    expect(result.complianceCheck).toBeDefined();
    expect(result.exportIntegrityCheck).toBeDefined();
  });
});

describe("MemoryManager", () => {
  it("stores and retrieves items", () => {
    const manager = new MemoryManager();
    const item = manager.store({
      type: "preference",
      content: { theme: "dark", language: "zh" },
      source: "user_settings"
    });

    expect(item.id).toBeDefined();
    expect(item.createdAt).toBeDefined();
    expect(item.type).toBe("preference");
  });

  it("queries items by keyword match", () => {
    const manager = new MemoryManager();
    manager.store({
      type: "pattern",
      content: { workflow: "ppt_generation", steps: 5 },
      source: "project_history"
    });
    manager.store({
      type: "terminology",
      content: { term: "quantum", definition: "量子" },
      source: "glossary"
    });

    const result = manager.query({
      projectId: "p1",
      queryType: "pattern",
      query: "ppt"
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.relevanceScore).toBeGreaterThan(0);
  });

  it("returns empty result for non-matching query", () => {
    const manager = new MemoryManager();
    manager.store({
      type: "preference",
      content: { theme: "dark" },
      source: "settings"
    });

    const result = manager.query({
      projectId: "p1",
      queryType: "preference",
      query: "nonexistent"
    });

    expect(result.items.length).toBe(0);
    expect(result.relevanceScore).toBe(0);
  });

  it("assigns unique IDs to stored items", () => {
    const manager = new MemoryManager();
    const item1 = manager.store({ type: "capsule", content: { a: 1 }, source: "s1" });
    const item2 = manager.store({ type: "capsule", content: { b: 2 }, source: "s2" });

    expect(item1.id).not.toBe(item2.id);
  });

  it("sets createdAt timestamp", () => {
    const manager = new MemoryManager();
    const before = new Date().toISOString();
    const item = manager.store({ type: "capsule", content: {}, source: "s1" });

    expect(item.createdAt).toBeDefined();
    expect(new Date(item.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime() - 1000);
  });
});

describe("ReflectionEngine", () => {
  const engine = new ReflectionEngine();

  it("identifies defects from failed tasks", () => {
    const result = engine.reflect({
      tasks: [
        { status: "completed", riskLevel: "L1" },
        { status: "failed", riskLevel: "L2" }
      ],
      artifacts: [{ evidenceCoverage: 0.9 }]
    });

    expect(result.defectAttribution.some((d) => d.includes("失败"))).toBe(true);
  });

  it("identifies defects from low coverage artifacts", () => {
    const result = engine.reflect({
      tasks: [
        { status: "completed", riskLevel: "L1" }
      ],
      artifacts: [{ evidenceCoverage: 0.3 }]
    });

    expect(result.defectAttribution.some((d) => d.includes("证据覆盖率"))).toBe(true);
  });

  it("extracts knowledge capsule candidates", () => {
    const result = engine.reflect({
      tasks: [
        { status: "completed", riskLevel: "L1" },
        { status: "completed", riskLevel: "L0" }
      ],
      artifacts: [{ evidenceCoverage: 0.9 }]
    });

    expect(result.knowledgeCapsuleCandidates.length).toBeGreaterThan(0);
  });

  it("suggests next tasks for pending items", () => {
    const result = engine.reflect({
      tasks: [
        { status: "pending", riskLevel: "L1" },
        { status: "waiting_user", riskLevel: "L0" }
      ],
      artifacts: [{ evidenceCoverage: 0.8 }]
    });

    expect(result.nextTaskSuggestions.some((s) => s.includes("待处理"))).toBe(true);
  });

  it("identifies improvement areas for low coverage", () => {
    const result = engine.reflect({
      tasks: [{ status: "completed", riskLevel: "L1" }],
      artifacts: [{ evidenceCoverage: 0.4 }]
    });

    expect(result.improvementAreas.some((a) => a.includes("证据引用"))).toBe(true);
  });

  it("identifies improvement areas for L3 tasks", () => {
    const result = engine.reflect({
      tasks: [{ status: "completed", riskLevel: "L3" }],
      artifacts: [{ evidenceCoverage: 0.9 }]
    });

    expect(result.improvementAreas.some((a) => a.includes("L3"))).toBe(true);
  });

  it("returns all four reflection dimensions", () => {
    const result = engine.reflect({
      tasks: [{ status: "completed", riskLevel: "L1" }],
      artifacts: [{ evidenceCoverage: 0.9 }]
    });

    expect(Array.isArray(result.defectAttribution)).toBe(true);
    expect(Array.isArray(result.knowledgeCapsuleCandidates)).toBe(true);
    expect(Array.isArray(result.nextTaskSuggestions)).toBe(true);
    expect(Array.isArray(result.improvementAreas)).toBe(true);
  });
});

describe("AgentPipeline", () => {
  const pipeline = new AgentPipeline();

  it("runs full pipeline end to end", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份关于机器学习的PPT",
      sources: [
        { id: "1", fileName: "机器学习基础.pdf" }
      ],
      dueDate: "2025-07-01"
    });

    expect(result.understanding.goals.length).toBeGreaterThan(0);
    expect(result.plans.recommended).toBeDefined();
    expect(result.plans.expedited).toBeDefined();
    expect(result.plans.conservative).toBeDefined();
    expect(result.selectedPlan.planType).toBe("recommended");
    expect(result.dispatches.length).toBeGreaterThan(0);
    expect(result.workerResults.length).toBeGreaterThan(0);
    expect(result.verificationResults.length).toBeGreaterThan(0);
    expect(result.reflection).not.toBeNull();
  });

  it("pipeline understanding feeds into planning", async () => {
    const result = await pipeline.run({
      rawInput: "帮我写一篇论文综述",
      sources: []
    });

    expect(result.understanding.deliverables).toContain("论文");
    const titles = result.selectedPlan.taskTree.map((t) => t.title);
    expect(titles).toContain("文献检索与筛选");
  });

  it("pipeline dispatches recommended plan tasks", async () => {
    const result = await pipeline.run({
      rawInput: "我需要准备期末考试复习",
      sources: []
    });

    expect(result.dispatches.length).toBe(result.selectedPlan.taskTree.length);
    for (const dispatch of result.dispatches) {
      expect(dispatch).toHaveProperty("taskId");
      expect(dispatch).toHaveProperty("assignedTo");
      expect(dispatch).toHaveProperty("estimatedCost");
      expect(dispatch).toHaveProperty("requiresHumanGate");
    }
  });

  it("pipeline produces worker results for each dispatch", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份PPT",
      sources: [{ id: "1", fileName: "data.pdf" }]
    });

    expect(result.workerResults.length).toBe(result.dispatches.length);
    for (const wr of result.workerResults) {
      expect(wr.taskId).toBeDefined();
      expect(wr.outputType).toBeDefined();
      expect(wr.confidence).toBeGreaterThanOrEqual(0);
      expect(wr.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("pipeline produces verification results for each worker result", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份PPT",
      sources: []
    });

    expect(result.verificationResults.length).toBe(result.workerResults.length);
    for (const vr of result.verificationResults) {
      expect(vr).toHaveProperty("passed");
      expect(vr).toHaveProperty("overallScore");
      expect(vr).toHaveProperty("factCheck");
      expect(vr).toHaveProperty("citationCheck");
      expect(vr).toHaveProperty("complianceCheck");
    }
  });

  it("pipeline includes reflection", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份报告",
      sources: [{ id: "1", fileName: "reference.pdf" }]
    });

    expect(result.reflection).not.toBeNull();
    expect(result.reflection!.defectAttribution.length).toBeGreaterThan(0);
    expect(result.reflection!.knowledgeCapsuleCandidates.length).toBeGreaterThan(0);
    expect(result.reflection!.nextTaskSuggestions.length).toBeGreaterThan(0);
    expect(result.reflection!.improvementAreas.length).toBeGreaterThan(0);
  });

  it("pipeline auto-selects recommended plan", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份PPT",
      sources: []
    });

    expect(result.selectedPlan.planType).toBe("recommended");
    expect(result.selectedPlan.id).toBe("recommended");
  });

  it("pipeline result includes comparison summary", async () => {
    const result = await pipeline.run({
      rawInput: "我需要做一份PPT",
      sources: []
    });

    expect(result.plans.comparisonSummary).toBeDefined();
    expect(result.plans.comparisonSummary.length).toBeGreaterThan(0);
  });
});
