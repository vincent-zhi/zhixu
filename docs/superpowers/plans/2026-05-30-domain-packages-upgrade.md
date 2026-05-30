# Domain Packages Full Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 5 domain packages (coaching, grad, research, undergrad, efficiency) from standalone utility libraries to LLM-enhanced, server-integrated, UI-connected domain services.

**Architecture:** Each package gets: (1) LLM-enhanced methods added to existing classes, (2) a dedicated route module registered in the monolithic app.ts, (3) API client functions in the web frontend, and (4) UI integration in existing pages. Five packages execute in parallel via independent agents, then a final integration task registers all skills and verifies the build.

**Tech Stack:** TypeScript, Fastify, @zhixu/model-gateway (LLMClient), @zhixu/core (Zod schemas, AgentOutput), @zhixu/skill-runtime (SkillManifest), Vitest, Next.js React.

**Spec:** `docs/superpowers/specs/2026-05-30-domain-packages-upgrade-design.md`

**Parallelization:** Tasks 1 and 14 are shared (sequential). Tasks 2-4, 5-7, 8-10, 11-13 can each run as a single package agent. Agents do not touch each other's files.

---

## File Structure

### Shared files (sequential)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/server/src/domain-routes.ts` | Create | Route registration hub — imports and registers all 5 domain route modules |
| `apps/server/src/app.ts:1-50` | Modify | Add import of `domain-routes.ts` |
| `apps/server/src/app.ts:~line 3867` | Modify | Call `registerDomainRoutes(fastify, store, gateway)` before closing brace |
| `apps/server/package.json` | Modify | Add `@zhixu/coaching`, `@zhixu/grad`, `@zhixu/research`, `@zhixu/undergrad`, `@zhixu/efficiency` as dependencies |
| `apps/web/app/api-client.ts` | Modify | Append ~27 new API functions |
| `apps/server/src/skill-registry.ts` | Modify | Register 25 new domain skills |

### Per-package files (parallel, one agent per package)

| Package | New Files | Modified Files |
|---------|-----------|---------------|
| coaching | `apps/server/src/routes/coaching.ts` | `packages/coaching/src/defense-simulator.ts`, `packages/coaching/src/socratic-coach.ts`, `packages/coaching/src/meeting-briefer.ts`, `packages/coaching/src/diagnostic-engine.ts`, `packages/coaching/src/types.ts` |
| grad | `apps/server/src/routes/grad.ts` | `packages/grad/src/submission-checker.ts`, `packages/grad/src/review-response.ts`, `packages/grad/src/experiment-log.ts`, `packages/grad/src/grant-helper.ts`, `packages/grad/src/research-gap.ts`, `packages/grad/src/citation-fixer.ts`, `packages/grad/src/types.ts` |
| research | `apps/server/src/routes/research.ts` | `packages/research/src/paper-reader.ts`, `packages/research/src/types.ts` |
| undergrad | `apps/server/src/routes/undergrad.ts` | `packages/undergrad/src/semester-planner.ts`, `packages/undergrad/src/class-notes-processor.ts`, `packages/undergrad/src/self-checker.ts`, `packages/undergrad/src/exam-crash.ts`, `packages/undergrad/src/types.ts` |
| efficiency | `apps/server/src/routes/efficiency.ts` | `packages/efficiency/src/style-unifier.ts`, `packages/efficiency/src/cross-project.ts`, `packages/efficiency/src/termbase.ts`, `packages/efficiency/src/types.ts` |

### UI integration files (parallel, after routes exist)

| Page | Action | New Features |
|------|--------|-------------|
| `apps/web/app/projects/[id]/page.tsx` | Modify | Add Quick Action buttons for coaching, grad, undergrad features; add slide-panel components |
| `apps/web/app/studio/[id]/page.tsx` | Modify | Add "Self-Check", "Citation Fix", "Style Unify" buttons in Inspector panel |
| `apps/web/app/knowledge/page.tsx` | Modify | Connect paper reading endpoints to research package |

---

## Task 1: Shared Infrastructure — Domain Route Registration

**Files:**
- Create: `apps/server/src/domain-routes.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/package.json`

This task creates the infrastructure that all 5 domain route modules plug into. Must be completed before any package agent starts.

- [ ] **Step 1: Create domain-routes.ts hub**

Create `apps/server/src/domain-routes.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "./project-store.js";
import type { ModelGateway } from "./model-gateway.js";

export async function registerDomainRoutes(
  fastify: FastifyInstance,
  store: ProjectStore,
  gateway: ModelGateway
): Promise<void> {
  // Each module registers its own routes under /api/projects/:projectId/<domain>
  const { registerCoachingRoutes } = await import("./routes/coaching.js");
  const { registerGradRoutes } = await import("./routes/grad.js");
  const { registerResearchRoutes } = await import("./routes/research.js");
  const { registerUndergradRoutes } = await import("./routes/undergrad.js");
  const { registerEfficiencyRoutes } = await import("./routes/efficiency.js");

  await registerCoachingRoutes(fastify, store, gateway);
  await registerGradRoutes(fastify, store, gateway);
  await registerResearchRoutes(fastify, store, gateway);
  await registerUndergradRoutes(fastify, store, gateway);
  await registerEfficiencyRoutes(fastify, store, gateway);
}
```

- [ ] **Step 2: Create routes directory**

Run: `mkdir -p apps/server/src/routes`

- [ ] **Step 3: Add import to app.ts**

In `apps/server/src/app.ts`, add after line 50 (`import { SkillRegistry } from "./skill-registry.js";`):

```typescript
import { registerDomainRoutes } from "./domain-routes.js";
```

- [ ] **Step 4: Call registerDomainRoutes in app.ts**

Find the closing `}` of the `ZhiXuApp` class (line 3868). Before it, add:

```typescript
    // Register domain package routes (coaching, grad, research, undergrad, efficiency)
    await registerDomainRoutes(this.fastify, this.store, this.gateway);
```

- [ ] **Step 5: Add package dependencies to server**

In `apps/server/package.json`, add to `dependencies`:

```json
"@zhixu/coaching": "workspace:*",
"@zhixu/grad": "workspace:*",
"@zhixu/research": "workspace:*",
"@zhixu/undergrad": "workspace:*",
"@zhixu/efficiency": "workspace:*"
```

- [ ] **Step 6: Run pnpm install and verify types**

Run: `pnpm install && pnpm --filter @zhixu/server typecheck`
Expected: PASS (domain-routes.ts has valid types, route modules don't exist yet so use `try/catch` or create stub files first)

- [ ] **Step 7: Create stub route modules**

Create 5 stub files to prevent import errors:

```typescript
// apps/server/src/routes/coaching.ts
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
export async function registerCoachingRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {}
```

Repeat for `grad.ts`, `research.ts`, `undergrad.ts`, `efficiency.ts` with the corresponding function names (`registerGradRoutes`, `registerResearchRoutes`, `registerUndergradRoutes`, `registerEfficiencyRoutes`).

- [ ] **Step 8: Run typecheck again**

Run: `pnpm --filter @zhixu/server typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/domain-routes.ts apps/server/src/routes/ apps/server/src/app.ts apps/server/package.json
git commit -m "feat(server): add domain route registration infrastructure"
```

---

## Task 2: Coaching Package — LLM-Enhanced Methods

**Files:**
- Modify: `packages/coaching/src/types.ts`
- Modify: `packages/coaching/src/defense-simulator.ts`
- Modify: `packages/coaching/src/socratic-coach.ts`
- Modify: `packages/coaching/src/meeting-briefer.ts`
- Modify: `packages/coaching/src/diagnostic-engine.ts`
- Modify: `packages/coaching/src/coaching.test.ts`

**Agent:** This task is assigned to the coaching agent. All files are within `packages/coaching/`.

- [ ] **Step 1: Add LLMClient type to types.ts**

Append to `packages/coaching/src/types.ts`:

```typescript
/** Minimal LLM interface for domain enhancement — avoids hard dependency on @zhixu/model-gateway */
export interface LLMCallable {
  chat(params: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    responseFormat?: { type: "json_object" };
  }): Promise<{ content: string }>;
}
```

- [ ] **Step 2: Add generateQuestionsFromPaper to DefenseSimulator**

In `packages/coaching/src/defense-simulator.ts`, add after the `runSimulation` method (after line 136):

```typescript
  async generateQuestionsFromPaper(
    paperContent: string,
    llm: LLMCallable
  ): Promise<DefenseQuestion[]> {
    try {
      const result = await llm.chat({
        system: `你是一位学术答辩评委。根据论文内容生成 6 个答辩问题，每个问题属于以下类别之一：methodology, results, contribution, literature, future_work, weakness。
返回 JSON 数组格式：[{"category": "...", "question": "...", "expectedPoints": ["..."], "difficulty": 0.0-1.0}]`,
        messages: [{ role: "user", content: `请根据以下论文内容生成答辩问题：\n\n${paperContent.slice(0, 4000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const questions: DefenseQuestion[] = (Array.isArray(parsed) ? parsed : parsed.questions ?? []).map((q: any) => ({
        id: crypto.randomUUID(),
        category: q.category ?? "methodology",
        question: q.question ?? "",
        expectedPoints: q.expectedPoints ?? [],
        difficulty: q.difficulty ?? 0.5,
      }));
      return questions.length > 0 ? questions : this.generateQuestions({ projectTitle: "", projectType: "", content: paperContent });
    } catch {
      return this.generateQuestions({ projectTitle: "", projectType: "", content: paperContent });
    }
  }

  async evaluateAnswerWithRubric(
    question: DefenseQuestion,
    answer: string,
    llm: LLMCallable
  ): Promise<{ score: number; strengths: string[]; weaknesses: string[]; suggestions: string[] }> {
    try {
      const result = await llm.chat({
        system: `你是一位学术答辩评委。评估学生对答辩问题的回答质量。
返回 JSON：{"score": 0.0-1.0, "strengths": ["..."], "weaknesses": ["..."], "suggestions": ["..."]}`,
        messages: [{ role: "user", content: `问题：${question.question}\n期望要点：${question.expectedPoints.join("、")}\n\n学生回答：\n${answer}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return {
        score: parsed.score ?? 0.5,
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        suggestions: parsed.suggestions ?? [],
      };
    } catch {
      const basic = this.evaluateAnswer(question, answer);
      return { score: basic.score, strengths: basic.coveredPoints, weaknesses: basic.missedPoints, suggestions: [] };
    }
  }
```

Add the import at the top of the file:

```typescript
import type { LLMCallable } from "./types.js";
```

- [ ] **Step 3: Add generateContextualQuestions to SocraticCoach**

In `packages/coaching/src/socratic-coach.ts`, add import and new method:

```typescript
import type { LLMCallable } from "./types.js";

// Add to the SocraticCoach class:
  async generateContextualQuestions(
    topic: string,
    conversationHistory: string[],
    projectContext: { title: string; type: string },
    llm: LLMCallable
  ): Promise<SocraticQuestion[]> {
    try {
      const result = await llm.chat({
        system: `你是一位苏格拉底式教学导师。根据话题和对话历史，生成 4 个递进式追问。
返回 JSON 数组：[{"category": "...", "question": "...", "followUp": "..."}]`,
        messages: [{ role: "user", content: `话题：${topic}\n项目：${projectContext.title}（${projectContext.type}）\n历史对话：\n${conversationHistory.slice(-5).join("\n")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return (Array.isArray(parsed) ? parsed : parsed.questions ?? []).map((q: any) => ({
        category: q.category ?? "assumption",
        question: q.question ?? "",
        followUp: q.followUp ?? "",
      }));
    } catch {
      return this.generateQuestions(topic, 2);
    }
  }
```

- [ ] **Step 4: Add generateProjectBrief to MeetingBriefer**

In `packages/coaching/src/meeting-briefer.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to the MeetingBriefer class:
  async generateProjectBrief(input: {
    projectTitle: string;
    projectType: string;
    recentProgress: string[];
    upcomingDeadlines: string[];
    sourceCount: number;
    taskCount: number;
    llm: LLMCallable;
  }): Promise<MeetingBrief> {
    try {
      const result = await input.llm.chat({
        system: `你是一位学术会议准备助手。根据项目信息生成组会简报。
返回 JSON：{"keyPoints": ["..."], "slideSuggestions": ["..."], "anticipatedQuestions": ["..."], "checklist": ["..."]}`,
        messages: [{ role: "user", content: `项目：${input.projectTitle}（${input.projectType}）\n近期进展：${input.recentProgress.join("、")}\n截止日期：${input.upcomingDeadlines.join("、")}\n资料数：${input.sourceCount}，任务数：${input.taskCount}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return {
        meetingType: "group_meeting",
        keyPoints: parsed.keyPoints ?? [],
        slideSuggestions: parsed.slideSuggestions ?? [],
        anticipatedQuestions: parsed.anticipatedQuestions ?? [],
        checklist: parsed.checklist ?? [],
      };
    } catch {
      return this.generateBrief("group_meeting", input.recentProgress, input.upcomingDeadlines);
    }
  }
```

- [ ] **Step 5: Add generateInsightReport to DiagnosticEngine**

In `packages/coaching/src/diagnostic-engine.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to the DiagnosticEngine class:
  async generateInsightReport(input: {
    tasks: Array<{ title: string; status: string; dueAt?: string; completedAt?: string }>;
    sourceCount: number;
    evidenceCoverage: number;
    llm: LLMCallable;
  }): Promise<{ completionRate: number; averageDelayDays: number; riskAreas: string[]; strengths: string[]; aiInsights: string[]; retentionScore: number }> {
    const basicTasks = input.tasks.map(t => ({
      id: crypto.randomUUID(),
      projectId: "",
      title: t.title,
      status: t.status,
      assigneeType: "user" as const,
      responsibilityLabel: "user_responsible" as const,
      priority: 1,
      riskLevel: "L0" as const,
      ...(t.dueAt ? { dueAt: new Date(t.dueAt) } : {}),
      ...(t.completedAt ? { completedAt: new Date(t.completedAt) } : {}),
    }));
    const basicReport = this.generateReport(basicTasks as any, []);

    try {
      const result = await input.llm.chat({
        system: `你是一位学业导师。根据学生的任务完成数据，给出 3-5 条具体可行的改进建议。
返回 JSON：{"insights": ["..."]}`,
        messages: [{ role: "user", content: `完成率：${(basicReport.completionRate * 100).toFixed(0)}%\n平均延迟：${basicReport.averageDelayDays.toFixed(1)} 天\n风险领域：${basicReport.riskAreas.join("、")}\n优势领域：${basicReport.strengths.join("、")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basicReport, aiInsights: parsed.insights ?? [] };
    } catch {
      return { ...basicReport, aiInsights: [] };
    }
  }
```

- [ ] **Step 6: Add tests for LLM-enhanced methods**

Append to `packages/coaching/src/coaching.test.ts`:

```typescript
import type { LLMCallable } from "./types.js";

const mockLLM: LLMCallable = {
  async chat() {
    return {
      content: JSON.stringify({
        questions: [
          { category: "methodology", question: "Why this method?", expectedPoints: ["justification"], difficulty: 0.5 }
        ],
        score: 0.8,
        strengths: ["Clear explanation"],
        weaknesses: ["Missing details"],
        suggestions: ["Add more detail"],
        insights: ["Focus on task completion"],
      }),
    };
  },
};

describe("DefenseSimulator LLM enhanced", () => {
  it("generateQuestionsFromPaper falls back on LLM error", async () => {
    const sim = new DefenseSimulator();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await sim.generateQuestionsFromPaper("test paper content", badLLM);
    expect(result.length).toBeGreaterThan(0);
  });

  it("evaluateAnswerWithRubric returns LLM feedback", async () => {
    const sim = new DefenseSimulator();
    const question = sim.generateQuestions({ projectTitle: "Test", projectType: "research", content: "" })[0]!;
    const result = await sim.evaluateAnswerWithRubric(question, "test answer", mockLLM);
    expect(result.score).toBeGreaterThan(0);
    expect(result.strengths.length).toBeGreaterThan(0);
  });
});

describe("SocraticCoach LLM enhanced", () => {
  it("generateContextualQuestions returns questions", async () => {
    const coach = new SocraticCoach();
    const result = await coach.generateContextualQuestions("machine learning", [], { title: "ML Project", type: "research" }, mockLLM);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("MeetingBriefer LLM enhanced", () => {
  it("generateProjectBrief returns brief", async () => {
    const briefer = new MeetingBriefer();
    const result = await briefer.generateProjectBrief({
      projectTitle: "Test Project", projectType: "research",
      recentProgress: ["Completed draft"], upcomingDeadlines: ["Friday"],
      sourceCount: 5, taskCount: 3, llm: mockLLM,
    });
    expect(result.keyPoints.length).toBeGreaterThan(0);
  });
});

describe("DiagnosticEngine LLM enhanced", () => {
  it("generateInsightReport returns insights", async () => {
    const engine = new DiagnosticEngine();
    const result = await engine.generateInsightReport({
      tasks: [{ title: "Write paper", status: "completed", completedAt: "2026-05-28" }],
      sourceCount: 3, evidenceCoverage: 0.7, llm: mockLLM,
    });
    expect(result.aiInsights.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Run coaching tests**

Run: `pnpm --filter @zhixu/coaching test`
Expected: All existing + new tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/coaching/src/
git commit -m "feat(coaching): add LLM-enhanced methods for defense, socratic, meeting, diagnostic"
```

---

## Task 3: Coaching Package — API Routes

**Files:**
- Modify: `apps/server/src/routes/coaching.ts` (replace stub)

**Agent:** Same coaching agent, after Task 2.

- [ ] **Step 1: Implement coaching routes**

Replace `apps/server/src/routes/coaching.ts` with:

```typescript
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { DefenseSimulator, SocraticCoach, MeetingBriefer, DiagnosticEngine, ProcrastinationAdapterEngine } from "@zhixu/coaching";
import { LLMClient } from "@zhixu/model-gateway";

function getLLMClient(gateway: ModelGateway): LLMClient | null {
  // Extract LLMClient from gateway if it's an LLM gateway (has chatWithTools)
  // If MockModelGateway, return null to use heuristic fallback
  if (!gateway.chatWithTools) return null;
  // The LLMModelGateway internally holds an LLMClient; we create a lightweight wrapper
  return null; // We'll use a simpler approach: pass gateway.chatWithTools as LLMCallable
}

function asLLMCallable(gateway: ModelGateway): import("@zhixu/coaching").LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [
          { role: "system", content: params.system },
          ...params.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content, toolCalls: undefined, toolCallId: undefined })),
        ],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

export async function registerCoachingRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const defenseSim = new DefenseSimulator();
  const socraticCoach = new SocraticCoach();
  const meetingBriefer = new MeetingBriefer();
  const diagnosticEngine = new DiagnosticEngine();
  const procrastinationEngine = new ProcrastinationAdapterEngine();
  const llm = asLLMCallable(gateway);

  // --- Defense Simulation ---
  fastify.post("/api/projects/:projectId/coaching/defense/start", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { paperContent?: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    let questions;
    if (body.paperContent && llm) {
      questions = await defenseSim.generateQuestionsFromPaper(body.paperContent, llm);
    } else {
      questions = defenseSim.generateQuestions({
        projectTitle: project.title,
        projectType: project.type,
        content: body.paperContent ?? "",
      });
    }

    // Create HumanGate for L2 defense simulation
    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "答辩模拟需要确认",
      riskLevel: "L2",
    });

    return { questions, gateId: gate.id, source: llm ? "llm_enhanced" : "heuristic" };
  });

  fastify.post("/api/projects/:projectId/coaching/defense/answer", async (req, reply) => {
    const body = req.body as { questionId: string; question: string; expectedPoints: string[]; answer: string };
    const question = { id: body.questionId, category: "methodology" as const, question: body.question, expectedPoints: body.expectedPoints, difficulty: 0.5 };
    if (llm) {
      const result = await defenseSim.evaluateAnswerWithRubric(question, body.answer, llm);
      return result;
    }
    return defenseSim.evaluateAnswer(question, body.answer);
  });

  // --- Socratic Coach ---
  fastify.post("/api/projects/:projectId/coaching/socratic", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { topic: string; depth?: number; conversationHistory?: string[] };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    if (body.conversationHistory && body.conversationHistory.length > 0 && llm) {
      return socraticCoach.generateContextualQuestions(body.topic, body.conversationHistory, { title: project.title, type: project.type }, llm);
    }
    return socraticCoach.generateQuestions(body.topic, body.depth ?? 2);
  });

  // --- Meeting Brief ---
  fastify.post("/api/projects/:projectId/coaching/meeting-brief", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const recentProgress = project.tasks.filter(t => t.status === "completed").map(t => t.title);
    const upcomingDeadlines = project.tasks.filter(t => t.dueAt && t.status !== "completed").map(t => `${t.title}: ${t.dueAt}`);

    if (llm) {
      return meetingBriefer.generateProjectBrief({
        projectTitle: project.title, projectType: project.type,
        recentProgress, upcomingDeadlines,
        sourceCount: project.sources.length, taskCount: project.tasks.length, llm,
      });
    }
    return meetingBriefer.generateBrief("group_meeting", recentProgress, upcomingDeadlines);
  });

  // --- Diagnostic ---
  fastify.post("/api/projects/:projectId/coaching/diagnostic", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const tasks = project.tasks.map(t => ({
      id: t.id, projectId, title: t.title, status: t.status,
      assigneeType: "user" as const, responsibilityLabel: "user_responsible" as const,
      priority: 1, riskLevel: "L0" as const,
      ...(t.dueAt ? { dueAt: new Date(t.dueAt) } : {}),
    }));

    if (llm) {
      return diagnosticEngine.generateInsightReport({
        tasks: project.tasks, sourceCount: project.sources.length, evidenceCoverage: 0.5, llm,
      });
    }
    return diagnosticEngine.generateReport(tasks as any, []);
  });

  // --- Procrastination ---
  fastify.post("/api/projects/:projectId/coaching/procrastination", async (req, reply) => {
    const body = req.body as { delayDays: number };
    const analysis = procrastinationEngine.analyze(body.delayDays);
    const microTasks = procrastinationEngine.generateMicroTasks(body.delayDays);
    return { ...analysis, microTasks };
  });
}
```

- [ ] **Step 2: Run server typecheck**

Run: `pnpm --filter @zhixu/server typecheck`
Expected: PASS. If `LLMCallable` is not exported from `@zhixu/coaching`, rebuild the package first: `pnpm --filter @zhixu/coaching build`

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/coaching.ts
git commit -m "feat(server): add coaching domain API routes"
```

---

## Task 4: Coaching Package — UI Integration

**Files:**
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/projects/[id]/page.tsx`

**Agent:** Same coaching agent, after Task 3.

- [ ] **Step 1: Add coaching API functions to api-client.ts**

Append to `apps/web/app/api-client.ts`:

```typescript
// --- Coaching ---
export async function startDefenseSimulation(projectId: string, input: { paperContent?: string }) {
  return request<{ questions: Array<{ id: string; category: string; question: string; expectedPoints: string[]; difficulty: number }>; gateId: string; source: string }>(
    `/api/projects/${projectId}/coaching/defense/start`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function submitDefenseAnswer(projectId: string, input: { questionId: string; question: string; expectedPoints: string[]; answer: string }) {
  return request<{ score: number; strengths: string[]; weaknesses: string[]; suggestions: string[]; coveredPoints?: string[]; missedPoints?: string[] }>(
    `/api/projects/${projectId}/coaching/defense/answer`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function getSocraticQuestions(projectId: string, input: { topic: string; depth?: number; conversationHistory?: string[] }) {
  return request<Array<{ category: string; question: string; followUp: string }>>(
    `/api/projects/${projectId}/coaching/socratic`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function getMeetingBrief(projectId: string) {
  return request<{ meetingType: string; keyPoints: string[]; slideSuggestions: string[]; anticipatedQuestions: string[]; checklist: string[] }>(
    `/api/projects/${projectId}/coaching/meeting-brief`, { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getDiagnosticReport(projectId: string) {
  return request<{ completionRate: number; averageDelayDays: number; riskAreas: string[]; strengths: string[]; aiInsights: string[]; retentionScore: number }>(
    `/api/projects/${projectId}/coaching/diagnostic`, { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getProcrastinationHelp(projectId: string, input: { delayDays: number }) {
  return request<{ tier: string; message: string; microTasks: Array<{ step: string; estimatedMinutes: number }> }>(
    `/api/projects/${projectId}/coaching/procrastination`, { method: "POST", body: JSON.stringify(input) }
  );
}
```

- [ ] **Step 2: Add Defense Simulation panel to project page**

In `apps/web/app/projects/[id]/page.tsx`, add a state variable and a slide panel for defense simulation. The exact location depends on the existing component structure. Add:

1. State: `const [defensePanel, setDefensePanel] = useState(false);`
2. State: `const [defenseQuestions, setDefenseQuestions] = useState<any[]>([]);`
3. Add button in Quick Actions bar: `<button onClick={async () => { setDefensePanel(true); const r = await startDefenseSimulation(project.id, {}); setDefenseQuestions(r.questions); }} className="action-btn">答辩模拟</button>`
4. Add a simple slide panel that renders questions with answer textareas and submit buttons.

The full UI component pattern is consistent with existing panels in the project page (e.g., the human gate confirmation panels).

- [ ] **Step 3: Run web typecheck**

Run: `pnpm --filter @zhixu/web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api-client.ts apps/web/app/projects/\[id\]/page.tsx
git commit -m "feat(web): add coaching UI integration — defense panel and API client"
```

---

## Task 5: Grad Package — LLM-Enhanced Methods

**Files:**
- Modify: `packages/grad/src/types.ts`
- Modify: `packages/grad/src/submission-checker.ts`
- Modify: `packages/grad/src/review-response.ts`
- Modify: `packages/grad/src/experiment-log.ts`
- Modify: `packages/grad/src/grant-helper.ts`
- Modify: `packages/grad/src/research-gap.ts`
- Modify: `packages/grad/src/citation-fixer.ts`
- Modify: `packages/grad/src/grad.test.ts`

**Agent:** Grad agent. All files within `packages/grad/`.

- [ ] **Step 1: Add LLMCallable to types.ts**

Append to `packages/grad/src/types.ts`:

```typescript
export interface LLMCallable {
  chat(params: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    responseFormat?: { type: "json_object" };
  }): Promise<{ content: string }>;
}
```

- [ ] **Step 2: Add checkSubmissionEnhanced to SubmissionChecker**

In `packages/grad/src/submission-checker.ts`, add import and new method:

```typescript
import type { LLMCallable } from "./types.js";

// Add to SubmissionChecker class:
  async checkSubmissionEnhanced(
    content: string,
    venue: string,
    llm: LLMCallable,
    customRequirements?: string[]
  ): Promise<SubmissionChecklist & { aiAnalysis: string[] }> {
    const basic = this.checkSubmission(content, venue as any);
    try {
      const result = await llm.chat({
        system: `你是一位学术期刊投稿检查助手。检查论文内容是否满足投稿要求。
返回 JSON：{"readiness": 0.0-1.0, "analysis": ["具体修改建议1", "..."], "missing": ["缺失项1", "..."]}`,
        messages: [{ role: "user", content: `目标期刊/会议：${venue}\n${customRequirements ? `额外要求：${customRequirements.join("、")}\n` : ""}\n论文内容（节选）：\n${content.slice(0, 4000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, readiness: parsed.readiness ?? basic.readiness, aiAnalysis: parsed.analysis ?? [] };
    } catch {
      return { ...basic, aiAnalysis: [] };
    }
  }
```

- [ ] **Step 3: Add createReviewResponseEnhanced to ReviewResponseEngine**

In `packages/grad/src/review-response.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to ReviewResponseEngine class:
  async createReviewResponseEnhanced(
    rawReview: string,
    paperContent: string,
    llm: LLMCallable
  ): Promise<ReviewResponse & { aiDraftSections: ResponseLetterSection[] }> {
    const basic = this.createReviewResponse(rawReview);
    try {
      const result = await llm.chat({
        system: `你是一位学术论文返修助手。根据审稿意见和论文内容，生成逐条回复草稿。
返回 JSON：{"sections": [{"reviewerComment": "...", "response": "...", "changes": "..."}], "overallStrategy": "..."}`,
        messages: [{ role: "user", content: `审稿意见：\n${rawReview}\n\n论文内容（节选）：\n${paperContent.slice(0, 3000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const sections: ResponseLetterSection[] = (parsed.sections ?? []).map((s: any) => ({
        reviewerComment: s.reviewerComment ?? "",
        responseType: "detailed_response" as const,
        response: s.response ?? "",
        changes: s.changes ?? "",
      }));
      return { ...basic, aiDraftSections: sections, overallStrategy: parsed.overallStrategy ?? basic.overallStrategy };
    } catch {
      return { ...basic, aiDraftSections: [] };
    }
  }
```

- [ ] **Step 4: Add analyzeAnomalyEnhanced to ExperimentLogManager**

In `packages/grad/src/experiment-log.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to ExperimentLogManager class:
  async analyzeAnomalyEnhanced(
    log: ExperimentLog,
    llm: LLMCallable
  ): Promise<ExperimentAnomaly & { hypotheses: string[]; nextSteps: string[] }> {
    const basic = this.analyzeAnomaly(log);
    try {
      const result = await llm.chat({
        system: `你是一位实验异常分析助手。根据实验记录，生成归因假设和排查步骤。
返回 JSON：{"hypotheses": ["假设1：...", "..."], "nextSteps": ["步骤1：...", "..."]}`,
        messages: [{ role: "user", content: `实验目的：${log.purpose}\n变量：${log.variables.map(v => `${v.name}=${v.value}`).join("、")}\n步骤：${log.steps.map(s => s.description).join("；")}\n结果：${log.results}\n分析：${log.analysis}\n已知问题：${log.issues.join("、")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, hypotheses: parsed.hypotheses ?? [], nextSteps: parsed.nextSteps ?? [] };
    } catch {
      return { ...basic, hypotheses: [], nextSteps: [] };
    }
  }
```

- [ ] **Step 5: Add analyzeGrantEnhanced to GrantApplicationHelper**

In `packages/grad/src/grant-helper.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to GrantApplicationHelper class:
  async analyzeGrantEnhanced(
    application: GrantApplication,
    llm: LLMCallable
  ): Promise<{ logicGaps: string[]; evidenceGaps: string[]; completeness: number; aiReview: string[] }> {
    const basic = this.analyzeGrant(application);
    try {
      const result = await llm.chat({
        system: `你是一位基金申报评审助手。评估课题申报书的逻辑完整性、创新点清晰度和技术路线可行性。
返回 JSON：{"completeness": 0.0-1.0, "review": ["具体修改建议1", "..."], "strengths": ["优点1", "..."]}`,
        messages: [{ role: "user", content: application.sections.map(s => `【${s.title}】\n${s.content}`).join("\n\n") }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, completeness: parsed.completeness ?? basic.completeness, aiReview: parsed.review ?? [] };
    } catch {
      return { ...basic, aiReview: [] };
    }
  }
```

- [ ] **Step 6: Add analyzeGapsEnhanced to ResearchGapAnalyzer**

In `packages/grad/src/research-gap.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to ResearchGapAnalyzer class:
  async analyzeGapsEnhanced(
    papers: string[],
    llm: LLMCallable
  ): Promise<{ gaps: ResearchGap[]; aiDirections: Array<{ direction: string; rationale: string; feasibility: number }> }> {
    const gaps = this.analyzeGaps(papers);
    try {
      const result = await llm.chat({
        system: `你是一位科研方向规划助手。综合多篇论文的局限性和未来工作，推荐 3-5 个可行的研究方向。
返回 JSON：{"directions": [{"direction": "研究方向描述", "rationale": "基于哪些论文的什么空白", "feasibility": 0.0-1.0}]}`,
        messages: [{ role: "user", content: `论文摘要和局限性：\n${papers.slice(0, 5).map((p, i) => `论文${i + 1}：${p.slice(0, 500)}`).join("\n\n")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { gaps, aiDirections: parsed.directions ?? [] };
    } catch {
      return { gaps, aiDirections: [] };
    }
  }
```

- [ ] **Step 7: Add fixCitationsEnhanced to CitationFixer**

In `packages/grad/src/citation-fixer.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to CitationFixer class:
  async fixCitationsEnhanced(
    citations: string[],
    llm: LLMCallable
  ): Promise<Array<{ original: string; fixed: string; style: string; confidence: number }>> {
    const fixed = this.formatCitations(citations, "APA");
    const anomalies = this.detectAnomalies(citations);

    if (anomalies.length === 0) return fixed.map((f, i) => ({ original: citations[i] ?? "", fixed: f, style: "APA", confidence: 0.95 }));

    try {
      const result = await llm.chat({
        system: `你是一位参考文献修复助手。根据不完整的引用信息，补全缺失的元数据（title, authors, year, venue, DOI）。
返回 JSON 数组：[{"original": "原始文本", "fixed": "修复后的完整引用", "missing": ["缺失字段"]}]`,
        messages: [{ role: "user", content: anomalies.map(a => a.citation).join("\n---\n") }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return (Array.isArray(parsed) ? parsed : parsed.citations ?? []).map((c: any) => ({
        original: c.original ?? "",
        fixed: c.fixed ?? c.original ?? "",
        style: "AI补全",
        confidence: 0.7,
      }));
    } catch {
      return fixed.map((f, i) => ({ original: citations[i] ?? "", fixed: f, style: "APA", confidence: 0.8 }));
    }
  }
```

- [ ] **Step 8: Add tests for LLM-enhanced grad methods**

Append to `packages/grad/src/grad.test.ts` similar mock-LLM tests as coaching (mock returning JSON, test fallback behavior).

- [ ] **Step 9: Run grad tests**

Run: `pnpm --filter @zhixu/grad test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/grad/src/
git commit -m "feat(grad): add LLM-enhanced methods for submission, review, experiment, grant, gaps, citations"
```

---

## Task 6: Grad Package — API Routes

**Files:**
- Modify: `apps/server/src/routes/grad.ts` (replace stub)

**Agent:** Same grad agent, after Task 5.

- [ ] **Step 1: Implement grad routes**

Replace `apps/server/src/routes/grad.ts` with a module registering 7 routes:

- `POST /api/projects/:id/grad/submission-check` — calls `SubmissionChecker.checkSubmissionEnhanced` with LLM or `checkSubmission` without
- `POST /api/projects/:id/grad/review-response` — calls `ReviewResponseEngine.createReviewResponseEnhanced`; creates HumanGate L3
- `POST /api/projects/:id/grad/experiment-log` — calls `ExperimentLogManager.analyzeAnomalyEnhanced`; creates HumanGate L2
- `POST /api/projects/:id/grad/grant-analysis` — calls `GrantApplicationHelper.analyzeGrantEnhanced`; creates HumanGate L3
- `POST /api/projects/:id/grad/research-gaps` — calls `ResearchGapAnalyzer.analyzeGapsEnhanced`; creates HumanGate L2
- `POST /api/projects/:id/grad/citation-fix` — calls `CitationFixer.fixCitationsEnhanced`
- `POST /api/projects/:id/grad/academic-tracker` — calls `AcademicTrackerManager.generateDigest` (no LLM)

Follow the same pattern as Task 3 coaching routes: use `asLLMCallable(gateway)` to get LLM or null, fallback to heuristic.

- [ ] **Step 2: Run server typecheck**

Run: `pnpm --filter @zhixu/server typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/grad.ts
git commit -m "feat(server): add grad domain API routes"
```

---

## Task 7: Grad Package — UI Integration

**Files:**
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/projects/[id]/page.tsx`
- Modify: `apps/web/app/studio/[id]/page.tsx`

**Agent:** Same grad agent, after Task 6.

- [ ] **Step 1: Add grad API functions to api-client.ts**

Append 7 functions:

```typescript
// --- Grad ---
export async function gradSubmissionCheck(projectId: string, input: { venue: string; content?: string }) {
  return request<{ items: Array<{ name: string; met: boolean; detail: string }>; readiness: number; aiAnalysis: string[] }>(
    `/api/projects/${projectId}/grad/submission-check`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradReviewResponse(projectId: string, input: { rawReview: string; paperContent?: string }) {
  return request<{ comments: any[]; actionItems: any[]; responseLetter: any[]; overallStrategy: string; aiDraftSections: any[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/review-response`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradExperimentLog(projectId: string, input: { log: any }) {
  return request<{ hasAnomaly: boolean; priority: number; issues: string[]; hypotheses: string[]; nextSteps: string[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/experiment-log`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradGrantAnalysis(projectId: string, input: { application: any }) {
  return request<{ logicGaps: string[]; evidenceGaps: string[]; completeness: number; aiReview: string[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/grant-analysis`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradResearchGaps(projectId: string) {
  return request<{ gaps: Array<{ description: string; score: number }>; aiDirections: Array<{ direction: string; rationale: string; feasibility: number }>; gateId?: string }>(
    `/api/projects/${projectId}/grad/research-gaps`, { method: "POST", body: JSON.stringify({}) }
  );
}

export async function gradCitationFix(projectId: string, input: { citations: string[]; style?: string }) {
  return request<{ results: Array<{ original: string; fixed: string; style: string; confidence: number }> }>(
    `/api/projects/${projectId}/grad/citation-fix`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradAcademicTracker(projectId: string, input: { keywords: string[]; authors: string[]; venues: string[]; papers: Array<{ title: string; authors: string[]; year: number; venue: string; abstract?: string }> }) {
  return request<{ digest: Array<{ title: string; relevance: number; summary: string }>; trends: string[] }>(
    `/api/projects/${projectId}/grad/academic-tracker`, { method: "POST", body: JSON.stringify(input) }
  );
}
```

- [ ] **Step 2: Add Review Response panel to project page**

Add "审稿意见整改" Quick Action button. On click, show textarea for raw review input, then display parsed comments + AI draft response letter.

- [ ] **Step 3: Add Citation Fix button to Studio Inspector**

In `apps/web/app/studio/[id]/page.tsx`, add a "引用修复" button in the right inspector panel that calls `fixCitations()` for the current block's content.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api-client.ts apps/web/app/projects/\[id\]/page.tsx apps/web/app/studio/\[id\]/page.tsx
git commit -m "feat(web): add grad UI — review response panel and citation fix"
```

---

## Task 8: Research Package — LLM-Enhanced Methods

**Files:**
- Modify: `packages/research/src/types.ts`
- Modify: `packages/research/src/paper-reader.ts`
- Modify: `packages/research/src/paper-reader.test.ts`

**Agent:** Research agent.

- [ ] **Step 1: Add LLMCallable to types.ts**

Same pattern as coaching/grad.

- [ ] **Step 2: Add readPaperEnhanced to PaperReader**

```typescript
async readPaperEnhanced(content: string, llm: LLMCallable): Promise<PaperEntry> {
  const basic = this.readPaper(content);
  try {
    const result = await llm.chat({
      system: `你是一位学术论文精读助手。从论文内容中提取结构化信息。
返回 JSON：{"title": "...", "authors": ["..."], "year": 2024, "venue": "...", "problem": "...", "method": "...", "dataset": "...", "metrics": ["..."], "mainResults": "...", "limitations": ["..."], "futureWork": ["..."], "contributions": ["..."], "reproducibility": "..."}`,
      messages: [{ role: "user", content: content.slice(0, 6000) }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { ...basic, ...parsed, authors: parsed.authors ?? basic.authors, year: parsed.year ?? basic.year };
  } catch {
    return basic;
  }
}
```

- [ ] **Step 3: Add comparePapersEnhanced**

```typescript
async comparePapersEnhanced(entries: PaperEntry[], llm: LLMCallable): Promise<PaperMatrix & { methodClassification: Array<{ category: string; papers: string[] }>; controversies: Array<{ topic: string; positions: string[] }>; researchGaps: string[]; suggestedOutline: string[] }> {
  const basic = this.comparePapers(entries);
  try {
    const result = await llm.chat({
      system: `你是一位文献综述助手。对比分析多篇论文，识别方法分类、争议点和研究空白。
返回 JSON：{"methodClassification": [{"category": "...", "papers": ["..."]}], "controversies": [{"topic": "...", "positions": ["..."]}], "researchGaps": ["..."], "suggestedOutline": ["..."]}`,
      messages: [{ role: "user", content: entries.map((e, i) => `论文${i + 1}: ${e.title}\n方法: ${e.method}\n结果: ${e.mainResults}\n局限: ${e.limitations?.join("、")}`).join("\n\n") }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { ...basic, methodClassification: parsed.methodClassification ?? [], controversies: parsed.controversies ?? [], researchGaps: parsed.researchGaps ?? basic.researchGaps.map(g => g.description), suggestedOutline: parsed.suggestedOutline ?? basic.suggestedOutline };
  } catch {
    return { ...basic, methodClassification: [], controversies: [], researchGaps: basic.researchGaps.map(g => g.description), suggestedOutline: basic.suggestedOutline };
  }
}
```

- [ ] **Step 4: Add tests**

Test `readPaperEnhanced` and `comparePapersEnhanced` with mock LLM and fallback behavior.

- [ ] **Step 5: Run research tests**

Run: `pnpm --filter @zhixu/research test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/research/src/
git commit -m "feat(research): add LLM-enhanced paper reading and comparison"
```

---

## Task 9: Research Package — API Routes

**Files:**
- Modify: `apps/server/src/routes/research.ts` (replace stub)

- [ ] **Step 1: Implement research routes**

Replace `apps/server/src/routes/research.ts` with:

```typescript
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { PaperReader } from "@zhixu/research";
import { LLMClient } from "@zhixu/model-gateway";

function asLLMCallable(gateway: ModelGateway): import("@zhixu/research").LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [{ role: "system", content: params.system }, ...params.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content, toolCalls: undefined, toolCallId: undefined }))],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

export async function registerResearchRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const reader = new PaperReader();
  const llm = asLLMCallable(gateway);

  // Enhanced paper reading — uses @zhixu/research package + LLM
  fastify.post("/api/projects/:projectId/research/paper-read-enhanced", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { sourceId: string; content: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    let result;
    if (llm) {
      result = await reader.readPaperEnhanced(body.content, llm);
    } else {
      result = reader.readPaper(body.content);
    }

    // Store as artifact with evidence
    const artifact = await store.createArtifact({ projectId, type: "report", title: `论文精读: ${result.title}` });
    await store.addEvidence(projectId, {
      sourceId: body.sourceId, artifactId: artifact.id,
      evidenceType: "citation", quoteText: result.mainResults ?? "",
      confidence: llm ? 0.7 : 0.5,
      responsibilityColor: llm ? "yellow" : "green",
      verificationStatus: "unverified",
    });

    return result;
  });

  // Enhanced paper comparison
  fastify.post("/api/projects/:projectId/research/paper-compare-enhanced", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { papers: Array<{ title: string; content: string }> };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const entries = body.papers.map(p => reader.readPaper(p.content));
    if (llm) return reader.comparePapersEnhanced(entries, llm);
    return reader.comparePapers(entries);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/routes/research.ts
git commit -m "feat(server): add research domain API routes"
```

---

## Task 10: Research Package — UI Integration

**Files:**
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/knowledge/page.tsx`

- [ ] **Step 1: Add enhanced paper API functions**

```typescript
export async function paperReadEnhanced(projectId: string, input: { sourceId: string; content: string }) {
  return request<PaperEntry & { contributions?: string[]; reproducibility?: string }>(
    `/api/projects/${projectId}/research/paper-read-enhanced`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function paperCompareEnhanced(projectId: string, input: { papers: Array<{ title: string; content: string }> }) {
  return request<{
    fields: Array<{ field: string; values: string[] }>;
    timeline: Array<{ year: number; title: string; contribution: string }>;
    researchGaps: string[];
    methodClassification: Array<{ category: string; papers: string[] }>;
    controversies: Array<{ topic: string; positions: string[] }>;
    suggestedOutline: string[];
  }>(
    `/api/projects/${projectId}/research/paper-compare-enhanced`, { method: "POST", body: JSON.stringify(input) }
  );
}
```

- [ ] **Step 2: Update Knowledge page to use enhanced endpoints**

In the paper reading section of `knowledge/page.tsx`, change the API call from `paperRead()` to `paperReadEnhanced()`. Display the new `methodClassification`, `controversies`, and `researchGaps` fields in the result panel.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api-client.ts apps/web/app/knowledge/page.tsx
git commit -m "feat(web): connect enhanced paper reading to knowledge page"
```

---

## Task 11: Undergrad Package — LLM-Enhanced Methods

**Files:**
- Modify: `packages/undergrad/src/types.ts`
- Modify: `packages/undergrad/src/semester-planner.ts`
- Modify: `packages/undergrad/src/class-notes-processor.ts`
- Modify: `packages/undergrad/src/self-checker.ts`
- Modify: `packages/undergrad/src/exam-crash.ts`
- Modify: `packages/undergrad/src/undergrad.test.ts`

**Agent:** Undergrad agent.

- [ ] **Step 1: Add LLMCallable to types.ts**

Same pattern.

- [ ] **Step 2: Add createPlanEnhanced to SemesterPlanner**

In `packages/undergrad/src/semester-planner.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to SemesterPlanner class:
async createPlanEnhanced(
  courses: CourseEntry[],
  semesterStart: string,
  semesterEnd: string,
  llm: LLMCallable
): Promise<SemesterPlan & { aiStrategy: string; aiTips: string[] }> {
  const basic = this.createPlan(courses, semesterStart, semesterEnd);
  try {
    const result = await llm.chat({
      system: `你是一位大学学业规划助手。根据课程信息生成个性化学期学习策略。
返回 JSON：{"strategy": "总体策略描述", "tips": ["第1周建议：...", "第2周建议：...", ...]}`,
      messages: [{ role: "user", content: `课程列表：\n${courses.map(c => `${c.name}（${c.credits}学分，难度${c.difficulty}/5，考核：${c.examType}）`).join("\n")}\n学期：${semesterStart} ~ ${semesterEnd}` }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { ...basic, aiStrategy: parsed.strategy ?? "", aiTips: parsed.tips ?? [] };
  } catch {
    return { ...basic, aiStrategy: "", aiTips: [] };
  }
}
```

- [ ] **Step 3: Add processTranscriptEnhanced to ClassNotesProcessor**

In `packages/undergrad/src/class-notes-processor.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to ClassNotesProcessor class:
async processTranscriptEnhanced(
  rawTranscript: string,
  courseInfo: { name: string; type: string; topics: string[] },
  llm: LLMCallable
): Promise<ClassNotes & { aiSummary: string; examHints: string[]; keyConcepts: string[] }> {
  const basic = this.processTranscript(rawTranscript);
  try {
    const result = await llm.chat({
      system: `你是一位课堂笔记助手。从录音转写文本中提取课程摘要、考试重点和关键概念。
返回 JSON：{"summary": "课程内容摘要", "examHints": ["考点1：...", "..."], "keyConcepts": ["概念1：...", "..."]}`,
      messages: [{ role: "user", content: `课程：${courseInfo.name}（${courseInfo.type}）\n主题：${courseInfo.topics.join("、")}\n\n转写文本：\n${rawTranscript.slice(0, 4000)}` }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { ...basic, aiSummary: parsed.summary ?? "", examHints: parsed.examHints ?? [], keyConcepts: parsed.keyConcepts ?? [] };
  } catch {
    return { ...basic, aiSummary: "", examHints: [], keyConcepts: [] };
  }
}
```

- [ ] **Step 4: Add checkArtifactEnhanced to SelfChecker**

In `packages/undergrad/src/self-checker.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to SelfChecker class:
async checkArtifactEnhanced(
  content: string,
  options: { minWords?: number; maxWords?: number; requiredSections?: string[] },
  llm: LLMCallable
): Promise<SelfCheckResult & { aiFeedback: Array<{ section: string; issue: string; suggestion: string }> }> {
  const basic = this.checkArtifact(content, options);
  try {
    const result = await llm.chat({
      system: `你是一位学术写作质量检查助手。检查文档的逻辑连贯性、论证充分性和主题匹配度。
返回 JSON：{"feedback": [{"section": "段落/章节名", "issue": "问题描述", "suggestion": "改进建议"}]}`,
      messages: [{ role: "user", content: `请检查以下文档：\n\n${content.slice(0, 4000)}` }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { ...basic, aiFeedback: parsed.feedback ?? [] };
  } catch {
    return { ...basic, aiFeedback: [] };
  }
}
```

- [ ] **Step 5: Add extractTopicsEnhanced to ExamCrashPlanner**

In `packages/undergrad/src/exam-crash.ts`, add:

```typescript
import type { LLMCallable } from "./types.js";

// Add to ExamCrashPlanner class:
async extractTopicsEnhanced(
  sources: string[],
  pastExams: string[],
  llm: LLMCallable
): Promise<HighFrequencyTopic[]> {
  const basic = this.extractHighFrequencyTopics(sources);
  try {
    const combined = [...sources, ...pastExams].join("\n---\n").slice(0, 6000);
    const result = await llm.chat({
      system: `你是一位考试辅导助手。从课程资料和往年题中提取高频考点（知识单元，不是单词）。
返回 JSON 数组：[{"term": "考点名称", "frequency": 出现次数, "weight": 0.0-1.0, "relatedTopics": ["关联考点"]}]`,
      messages: [{ role: "user", content: combined }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    const topics: HighFrequencyTopic[] = (Array.isArray(parsed) ? parsed : parsed.topics ?? []).map((t: any) => ({
      term: t.term ?? "",
      frequency: t.frequency ?? 1,
      weight: t.weight ?? 0.5,
      sources: 1,
    }));
    return topics.length > 0 ? topics : basic;
  } catch {
    return basic;
  }
}
```

- [ ] **Step 6: Add tests and run**

Run: `pnpm --filter @zhixu/undergrad test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/undergrad/src/
git commit -m "feat(undergrad): add LLM-enhanced methods for semester plan, notes, self-check, exam"
```

---

## Task 12: Undergrad Package — API Routes + UI

**Files:**
- Modify: `apps/server/src/routes/undergrad.ts` (replace stub)
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/projects/[id]/page.tsx`
- Modify: `apps/web/app/studio/[id]/page.tsx`

**Agent:** Same undergrad agent.

- [ ] **Step 1: Implement 6 undergrad routes**

Replace `apps/server/src/routes/undergrad.ts` with:

```typescript
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { SemesterPlanner, ClassNotesProcessor, SelfChecker, ExamCrashPlanner, PPTBeautifier, GroupDivider } from "@zhixu/undergrad";

function asLLMCallable(gateway: ModelGateway): import("@zhixu/undergrad").LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [{ role: "system", content: params.system }, ...params.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content, toolCalls: undefined, toolCallId: undefined }))],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

export async function registerUndergradRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const semesterPlanner = new SemesterPlanner();
  const notesProcessor = new ClassNotesProcessor();
  const selfChecker = new SelfChecker();
  const examPlanner = new ExamCrashPlanner();
  const pptBeautifier = new PPTBeautifier();
  const groupDivider = new GroupDivider();
  const llm = asLLMCallable(gateway);

  fastify.post("/api/projects/:projectId/undergrad/semester-plan", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { courses: any[]; semesterStart: string; semesterEnd: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });
    if (llm) return semesterPlanner.createPlanEnhanced(body.courses, body.semesterStart, body.semesterEnd, llm);
    return semesterPlanner.createPlan(body.courses, body.semesterStart, body.semesterEnd);
  });

  fastify.post("/api/projects/:projectId/undergrad/class-notes", async (req, reply) => {
    const body = req.body as { rawTranscript: string; courseInfo?: { name: string; type: string; topics: string[] } };
    if (body.courseInfo && llm) return notesProcessor.processTranscriptEnhanced(body.rawTranscript, body.courseInfo, llm);
    const notes = notesProcessor.processTranscript(body.rawTranscript);
    return { ...notes, actionItems: notesProcessor.extractActionItems(notes) };
  });

  fastify.post("/api/projects/:projectId/undergrad/self-check", async (req, reply) => {
    const body = req.body as { content: string; options?: { minWords?: number; maxWords?: number; requiredSections?: string[] } };
    if (llm) return selfChecker.checkArtifactEnhanced(body.content, body.options ?? {}, llm);
    return selfChecker.checkArtifact(body.content, body.options ?? {});
  });

  fastify.post("/api/projects/:projectId/undergrad/exam-crash", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { sources: string[]; pastExams?: string[]; examDate: string; dailyHours: number };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, { gateType: "skill_invocation", reason: "期末速成计划生成需确认", riskLevel: "L2" });
    let topics;
    if (body.pastExams && llm) { topics = await examPlanner.extractTopicsEnhanced(body.sources, body.pastExams, llm); }
    else { topics = examPlanner.extractHighFrequencyTopics(body.sources); }
    const plan = examPlanner.createCrashPlan(topics, body.examDate, body.dailyHours);
    return { ...plan, gateId: gate.id };
  });

  fastify.post("/api/projects/:projectId/undergrad/ppt-beautify", async (req, reply) => {
    const body = req.body as { slides: string[] };
    return pptBeautifier.beautify(body.slides);
  });

  fastify.post("/api/projects/:projectId/undergrad/group-divide", async (req, reply) => {
    const body = req.body as { members: any[]; taskDescriptions: string[]; totalHours: number };
    const division = groupDivider.divideTask(body.members, body.taskDescriptions, body.totalHours);
    return division;
  });
}
```

- [ ] **Step 2: Add API client functions**

Append 6 functions to `apps/web/app/api-client.ts`:

```typescript
// --- Undergrad ---
export async function undergradSemesterPlan(projectId: string, input: { courses: Array<{ name: string; credits: number; difficulty: number; examDate?: string; assignments?: string[] }>; semesterStart: string; semesterEnd: string }) {
  return request<{ weeklyPlans: any[]; overallStrategy: string; aiStrategy?: string; aiTips?: string[] }>(
    `/api/projects/${projectId}/undergrad/semester-plan`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradClassNotes(projectId: string, input: { rawTranscript: string; courseInfo?: { name: string; type: string; topics: string[] } }) {
  return request<{ keyPoints: string[]; homeworkMentions: string[]; examHints: string[]; actionItems: string[]; aiSummary?: string; keyConcepts?: string[] }>(
    `/api/projects/${projectId}/undergrad/class-notes`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradSelfCheck(projectId: string, input: { content: string; options?: { minWords?: number; maxWords?: number; requiredSections?: string[] } }) {
  return request<{ overallScore: number; issues: Array<{ type: string; severity: string; detail: string; suggestion: string }>; aiFeedback?: Array<{ section: string; issue: string; suggestion: string }> }>(
    `/api/projects/${projectId}/undergrad/self-check`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradExamCrash(projectId: string, input: { sources: string[]; pastExams?: string[]; examDate: string; dailyHours: number }) {
  return request<{ topics: Array<{ term: string; frequency: number; weight: number }>; dailyPlan: Array<{ date: string; activities: string[] }>; strategy: string; gateId?: string }>(
    `/api/projects/${projectId}/undergrad/exam-crash`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradPPTBeautify(projectId: string, input: { slides: string[] }) {
  return request<{ issues: Array<{ slideIndex: number; type: string; detail: string; fixable: boolean }>; beforeScore: number; afterScore: number; fixes: string[] }>(
    `/api/projects/${projectId}/undergrad/ppt-beautify`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradGroupDivide(projectId: string, input: { members: Array<{ name: string; weight: number }>; taskDescriptions: string[]; totalHours: number }) {
  return request<{ assignments: Array<{ memberId: string; memberName: string; taskDescription: string; estimatedHours: number }>; contributions?: any[] }>(
    `/api/projects/${projectId}/undergrad/group-divide`, { method: "POST", body: JSON.stringify(input) }
  );
}
```

- [ ] **Step 3: Add Self-Check button to Studio Inspector**

In studio/[id] page, add "自查预检" button that calls self-check on current artifact content.

- [ ] **Step 4: Add Exam Crash button to project page**

In projects/[id] page, add "期末速成" Quick Action with HumanGate confirmation.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/undergrad.ts apps/web/app/api-client.ts apps/web/app/projects/\[id\]/page.tsx apps/web/app/studio/\[id\]/page.tsx
git commit -m "feat(server+web): add undergrad routes and UI integration"
```

---

## Task 13: Efficiency Package — LLM-Enhanced Methods + Routes + UI

**Files:**
- Modify: `packages/efficiency/src/types.ts`
- Modify: `packages/efficiency/src/style-unifier.ts`
- Modify: `packages/efficiency/src/cross-project.ts`
- Modify: `packages/efficiency/src/termbase.ts`
- Modify: `packages/efficiency/src/efficiency.test.ts`
- Modify: `apps/server/src/routes/efficiency.ts` (replace stub)
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/studio/[id]/page.tsx`

**Agent:** Efficiency agent. This is a single combined task because efficiency has simpler LLM enhancements.

- [ ] **Step 1: Add LLMCallable + LLM enhancements**

Add `LLMCallable` interface to `packages/efficiency/src/types.ts` (same pattern as other packages).

Then add enhanced methods to 3 classes:

**style-unifier.ts — `unifyStyleEnhanced`:**

```typescript
import type { LLMCallable } from "./types.js";

// Add to StyleUnifier class:
async unifyStyleEnhanced(
  text: string,
  profile: StyleProfile,
  llm: LLMCallable
): Promise<{ unified: string; changes: Array<{ original: string; replacement: string; reason: string }> }> {
  const basic = this.unifyStyle(text, profile);
  try {
    const result = await llm.chat({
      system: `你是一位学术写作助手。将文本统一为正式学术风格（${profile.person === "first" ? "第一人称" : "第三人称"}，${profile.tense === "present" ? "现在时" : "过去时"}，正式度${profile.formality}/5）。
返回 JSON：{"unified": "统一后的文本", "changes": [{"original": "原文片段", "replacement": "修改后", "reason": "修改原因"}]}`,
      messages: [{ role: "user", content: text }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return { unified: parsed.unified ?? basic, changes: parsed.changes ?? [] };
  } catch {
    return { unified: basic, changes: [] };
  }
}
```

**cross-project.ts — `suggestLinksEnhanced`:**

```typescript
// Add to CrossProjectLinker class:
async suggestLinksEnhanced(
  projects: Array<{ id: string; title: string; type: string; summary: string }>,
  llm: LLMCallable
): Promise<Array<CrossProjectLink & { rationale: string; sharedKnowledge: string[] }>> {
  const basicLinks = this.suggestLinks(projects);
  try {
    const result = await llm.chat({
      system: `你是一位跨项目知识关联助手。分析多个项目之间的知识关联。
返回 JSON：{"links": [{"source": "项目ID1", "target": "项目ID2", "type": "shared_methodology|shared_knowledge|shared_data", "rationale": "关联原因", "sharedKnowledge": ["共享知识点1", "..."]}]}`,
      messages: [{ role: "user", content: projects.map(p => `ID:${p.id} | ${p.title}（${p.type}）：${p.summary}`).join("\n") }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return (parsed.links ?? []).map((l: any) => ({
      id: crypto.randomUUID(),
      sourceProjectId: l.source ?? "",
      targetProjectId: l.target ?? "",
      linkType: l.type ?? "shared_knowledge",
      createdAt: new Date(),
      rationale: l.rationale ?? "",
      sharedKnowledge: l.sharedKnowledge ?? [],
    }));
  } catch {
    return basicLinks.map(l => ({ ...l, rationale: "", sharedKnowledge: [] }));
  }
}
```

**termbase.ts — `extractTerms`:**

```typescript
// Add to TermbaseManager class:
async extractTerms(
  content: string,
  llm: LLMCallable
): Promise<Array<{ term: string; aliases: string[]; definition: string; context: string }>> {
  try {
    const result = await llm.chat({
      system: `你是一位学术术语提取助手。从文档中提取学术术语，包括中英文对照、缩写和同义词。
返回 JSON 数组：[{"term": "术语", "aliases": ["别名1", "缩写1"], "definition": "定义", "context": "出现的上下文"}]`,
      messages: [{ role: "user", content: content.slice(0, 4000) }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.content);
    return Array.isArray(parsed) ? parsed : parsed.terms ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Implement 6 efficiency routes**

Replace `apps/server/src/routes/efficiency.ts` with:

```typescript
import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { TermbaseManager, FragmentCollector, CrossProjectLinker, StyleUnifier, FormatConverter, ContentDeduplicator } from "@zhixu/efficiency";

function asLLMCallable(gateway: ModelGateway): import("@zhixu/efficiency").LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [{ role: "system", content: params.system }, ...params.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content, toolCalls: undefined, toolCallId: undefined }))],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

// In-memory termbase store (per-project)
const termbaseStore = new Map<string, import("@zhixu/efficiency").Termbase>();
const fragmentStore = new Map<string, import("@zhixu/efficiency").FragmentNote[]>();

export async function registerEfficiencyRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const termbaseManager = new TermbaseManager();
  const fragmentCollector = new FragmentCollector();
  const crossProjectLinker = new CrossProjectLinker();
  const styleUnifier = new StyleUnifier();
  const formatConverter = new FormatConverter();
  const deduplicator = new ContentDeduplicator();
  const llm = asLLMCallable(gateway);

  fastify.post("/api/projects/:projectId/efficiency/termbase", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "create": {
        const tb = termbaseManager.createTermbase(body.name ?? "默认术语库");
        termbaseStore.set(projectId, tb);
        return tb;
      }
      case "add": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return termbaseManager.addEntry(tb, { term: body.term, aliases: body.aliases ?? [], definition: body.definition ?? "", domain: body.domain ?? "" });
      }
      case "lookup": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return termbaseManager.lookup(tb, body.query ?? "") ?? null;
      }
      case "unify": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return { result: termbaseManager.unifyTerms(body.text ?? "", tb) };
      }
      case "export": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return { csv: termbaseManager.exportTermbase(tb) };
      }
      case "extract": {
        if (!llm) return { terms: [] };
        const terms = await termbaseManager.extractTerms(body.content ?? "", llm);
        return { terms };
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/fragments", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "collect": {
        const fragment = fragmentCollector.collect(body.content ?? "", body.tags);
        const existing = fragmentStore.get(projectId) ?? [];
        existing.push(fragment);
        fragmentStore.set(projectId, existing);
        return fragment;
      }
      case "organize": {
        const existing = fragmentStore.get(projectId) ?? [];
        const organized: Record<string, any[]> = {};
        for (const [tag, frags] of fragmentCollector.organizeByTag(existing)) {
          organized[tag || "(untagged)"] = frags;
        }
        return organized;
      }
      case "link": {
        const existing = fragmentStore.get(projectId) ?? [];
        const linked = existing.map(f => fragmentCollector.linkToProject(f, projectId));
        fragmentStore.set(projectId, linked);
        return linked;
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/cross-project", async (req, reply) => {
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "suggest": {
        if (llm && body.projects) return crossProjectLinker.suggestLinksEnhanced(body.projects, llm);
        return crossProjectLinker.suggestLinks(body.projects ?? []);
      }
      case "create": {
        return crossProjectLinker.createLink(body.source ?? "", body.target ?? "", body.linkType ?? "shared_knowledge");
      }
      case "find-related": {
        return crossProjectLinker.findRelatedProjects(body.targetId ?? "", body.links ?? []);
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/style-unify", async (req, reply) => {
    const body = req.body as { text: string; profile?: any };
    const profile = styleUnifier.createProfile(body.profile ?? {});
    if (llm) return styleUnifier.unifyStyleEnhanced(body.text, profile, llm);
    const unified = styleUnifier.unifyStyle(body.text, profile);
    const issues = styleUnifier.checkConsistency(body.text, profile);
    return { unified, changes: [], issues };
  });

  fastify.post("/api/projects/:projectId/efficiency/deduplicate", async (req, reply) => {
    const body = req.body as { items: Array<{ id: string; content: string }>; threshold?: number };
    return deduplicator.deduplicate(body.items, body.threshold ?? 0.8);
  });

  fastify.post("/api/projects/:projectId/efficiency/format-convert", async (req, reply) => {
    const body = req.body as { content: string; from: string; to: string };
    return formatConverter.convert(body.content, body.from as any, body.to as any);
  });
}
```

- [ ] **Step 3: Add API client functions**

Append 6 functions to `apps/web/app/api-client.ts`:

```typescript
// --- Efficiency ---
export async function efficiencyTermbase(projectId: string, input: { action: "create" | "add" | "lookup" | "unify" | "export" | "extract"; termbaseId?: string; term?: string; aliases?: string[]; definition?: string; content?: string; query?: string; text?: string }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/termbase`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyFragments(projectId: string, input: { action: "collect" | "organize" | "link"; content?: string; tags?: string[]; fragmentIds?: string[]; projectId?: string }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/fragments`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyCrossProject(projectId: string, input: { action: "suggest" | "create" | "find-related"; targetProjectId?: string; linkType?: string; projects?: Array<{ id: string; title: string; type: string; summary?: string }> }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/cross-project`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyStyleUnify(projectId: string, input: { text: string; profile?: { formality: number; person: "first" | "third"; tense: "past" | "present" } }) {
  return request<{ unified: string; changes: Array<{ original: string; replacement: string; reason: string }> }>(
    `/api/projects/${projectId}/efficiency/style-unify`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyDeduplicate(projectId: string, input: { items: Array<{ id: string; content: string }>; threshold?: number }) {
  return request<{ unique: Array<{ id: string; content: string }>; duplicates: Array<{ items: string[]; similarity: number }> }>(
    `/api/projects/${projectId}/efficiency/deduplicate`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyFormatConvert(projectId: string, input: { content: string; from: "markdown" | "html" | "latex"; to: "markdown" | "html" | "latex" }) {
  return request<{ result: string; fidelity: number; warnings: string[] }>(
    `/api/projects/${projectId}/efficiency/format-convert`, { method: "POST", body: JSON.stringify(input) }
  );
}
```

- [ ] **Step 4: Add Style Unify button to Studio Inspector**

In studio/[id] page, add "风格统一" button.

- [ ] **Step 5: Add tests and commit**

Run: `pnpm --filter @zhixu/efficiency test`
Expected: PASS

```bash
git add packages/efficiency/src/ apps/server/src/routes/efficiency.ts apps/web/app/api-client.ts apps/web/app/studio/\[id\]/page.tsx
git commit -m "feat(efficiency+server+web): add efficiency LLM enhancements, routes, and UI"
```

---

## Task 14: Integration — Skill Registration + Final Verification

**Files:**
- Modify: `apps/server/src/skill-registry.ts`
- Modify: `apps/web/app/api-client.ts` (final check)

**Agent:** Integration agent, after all 5 package agents complete.

- [ ] **Step 1: Register 25 domain skills in skill-registry.ts**

In `apps/server/src/skill-registry.ts`, add skill manifests for all domain features. Each skill follows the existing pattern:

```typescript
{
  id: "skill_defense_sim",
  name: "答辩模拟",
  description: "基于论文内容生成答辩问题并评估回答质量",
  provider: "zhixu-coaching",
  version: "1.0.0",
  riskLevel: "L2",
  permissions: [{ scope: "project.read", description: "读取项目资料", riskLevel: "L1", required: true }],
  requiresHumanGate: true,
  handler: async (input, ctx) => { /* delegate to coaching route logic */ },
}
```

Register all 25 skills listed in the spec (Section 3.3).

- [ ] **Step 2: Full build verification**

Run:
```bash
pnpm install
pnpm --filter @zhixu/coaching test
pnpm --filter @zhixu/grad test
pnpm --filter @zhixu/research test
pnpm --filter @zhixu/undergrad test
pnpm --filter @zhixu/efficiency test
pnpm typecheck
pnpm build
```

Expected: All tests PASS, typecheck PASS, build PASS.

- [ ] **Step 3: Fix any type errors or build failures**

If build fails due to cross-package type issues, fix the relevant import paths or type definitions.

- [ ] **Step 4: Final commit**

```bash
git add apps/server/src/skill-registry.ts
git commit -m "feat(server): register 25 domain skills in skill registry"
```

- [ ] **Step 5: Verify api-client.ts completeness**

Confirm all 27 API functions are present in api-client.ts:
- coaching: 6 functions
- grad: 7 functions
- research: 2 functions (enhanced)
- undergrad: 6 functions
- efficiency: 6 functions

Total: 27 functions. Verify they match the route definitions.

---

## Execution Summary

| Task | Agent | Dependencies | Files Modified | Files Created |
|------|-------|-------------|----------------|---------------|
| 1 | Sequential | None | 3 | 7 (5 stubs + domain-routes + routes dir) |
| 2 | Coaching | Task 1 | 5 (packages) | 0 |
| 3 | Coaching | Task 2 | 1 (route) | 0 |
| 4 | Coaching | Task 3 | 2 (web) | 0 |
| 5 | Grad | Task 1 | 7 (packages) | 0 |
| 6 | Grad | Task 5 | 1 (route) | 0 |
| 7 | Grad | Task 6 | 3 (web) | 0 |
| 8 | Research | Task 1 | 3 (packages) | 0 |
| 9 | Research | Task 8 | 1 (route) | 0 |
| 10 | Research | Task 9 | 2 (web) | 0 |
| 11 | Undergrad | Task 1 | 5 (packages) | 0 |
| 12 | Undergrad | Task 11 | 4 (route + web) | 0 |
| 13 | Efficiency | Task 1 | 8 (packages + route + web) | 0 |
| 14 | Integration | Tasks 4,7,10,12,13 | 2 (registry + api-client) | 0 |

**Parallelism:** After Task 1, agents for Tasks 2/5/8/11/13 can start simultaneously. Each agent works through its package's tasks sequentially. Task 14 starts after all agents complete.
