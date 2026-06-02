# Agent Harness Design Work Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Design and then implement a ZhiXu Agent Harness that turns the existing hard-coded `AgentPipeline` workflows into typed, observable, resumable graph workflows without moving domain agents into a monolithic package.

**Architecture:** `@zhixu/agent-harness` is the control plane: workflow runtime, checkpointing, event streaming, policy enforcement, registries, and observability. Existing packages such as `@zhixu/agent-os`, `@zhixu/skill-runtime`, `@zhixu/model-gateway`, `@zhixu/db`, and artifact packages remain execution modules connected through adapters. The first production migration keeps existing workflow routes and SSE event names compatible while moving course PPT and lab meeting orchestration behind the harness.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Fastify SSE, Zod-style runtime validation, Prisma-backed `AgentSession`, existing `@zhixu/core` schemas, existing `@zhixu/agent-os` agents.

**Current Context:** The main hard-coded orchestration lives in `packages/agent-os/src/pipeline.ts`. Existing workflow routes are in `apps/server/src/routes/workflow.ts`. `AgentSession` persistence is exposed through `apps/server/src/routes/agent-session.ts` and helper functions in `apps/server/src/routes/agent-session-helpers.ts`. Existing tool registration lives in `packages/model-gateway/src/tool-registry.ts`.

---

## Design Principles

1. Harness owns orchestration, not domain logic.
2. Workflow definitions are typed TypeScript first, serializable later.
3. DAG is the visual/planning shape; runtime is a controlled state graph with retries, interrupts, rollback, and resume.
4. Every node has typed input/output, timeout, retry, risk, and event behavior.
5. Every run is checkpointed by session id and trace id.
6. Existing SSE events remain compatible during migration.
7. P0 proves value by migrating exactly two workflows: `course_presentation` and `lab_meeting`.
8. Parallelism is introduced first where it is obvious and safe: lab meeting paper reading.

---

## File Structure

### New package

| File | Responsibility |
|------|----------------|
| `packages/agent-harness/package.json` | Workspace package metadata and dependencies |
| `packages/agent-harness/tsconfig.json` | TypeScript build config |
| `packages/agent-harness/src/index.ts` | Public exports |
| `packages/agent-harness/src/types.ts` | Core workflow, node, edge, state, event, policy types |
| `packages/agent-harness/src/workflow/definition.ts` | Workflow definition helpers and validation |
| `packages/agent-harness/src/workflow/executor.ts` | State graph execution loop |
| `packages/agent-harness/src/workflow/scheduler.ts` | Ready-node resolution and parallel superstep planning |
| `packages/agent-harness/src/runtime/context.ts` | Runtime context passed into every node |
| `packages/agent-harness/src/runtime/events.ts` | Harness event emitter and event mapping |
| `packages/agent-harness/src/runtime/interrupts.ts` | Human gate / pause / resume primitives |
| `packages/agent-harness/src/checkpoint/checkpoint-store.ts` | Checkpoint store interface and memory implementation |
| `packages/agent-harness/src/policy/retry.ts` | Retry and fallback policy helpers |
| `packages/agent-harness/src/registry/agent-registry.ts` | Agent node handler registry |
| `packages/agent-harness/src/registry/tool-registry-adapter.ts` | Adapter interface for existing model-gateway tools |
| `packages/agent-harness/src/observability/trace.ts` | Trace ids, node spans, timings, error summaries |
| `packages/agent-harness/src/workflow/executor.test.ts` | Runtime tests |
| `packages/agent-harness/src/workflow/scheduler.test.ts` | Parallel scheduling tests |
| `packages/agent-harness/src/checkpoint/checkpoint-store.test.ts` | Checkpoint behavior tests |

### Existing files to modify in P0

| File | Responsibility |
|------|----------------|
| `pnpm-workspace.yaml` | Include the new package automatically through `packages/*` |
| `package.json` | Add harness to build/test/typecheck filter chain if needed |
| `packages/agent-os/package.json` | Depend on `@zhixu/agent-harness` during adapter migration |
| `packages/agent-os/src/pipeline.ts` | Keep public API, delegate course/lab workflows to harness |
| `packages/agent-os/src/index.ts` | Export compatibility types |
| `apps/server/src/routes/workflow.ts` | Keep route shape and SSE names; optionally inject checkpoint-backed store |
| `apps/server/src/routes/agent-session-helpers.ts` | Add checkpoint adapter helpers only if needed |

### Workflow definitions

| File | Responsibility |
|------|----------------|
| `packages/agent-os/src/workflows/course-presentation.workflow.ts` | Typed workflow definition for course PPT |
| `packages/agent-os/src/workflows/lab-meeting.workflow.ts` | Typed workflow definition for lab meeting |
| `packages/agent-os/src/workflows/agent-handlers.ts` | Binds existing agents to harness node refs |

---

## Phase 0: Design Approval Package

### Task 1: Write the Architecture Decision Record

**Files:**
- Create: `docs/architecture/agent-harness-adr.md`

- [x] **Step 1: Write ADR content**

Create `docs/architecture/agent-harness-adr.md` with:

```markdown
# ADR: ZhiXu Agent Harness

## Status

Proposed

## Context

ZhiXu already has concrete agent capabilities in `@zhixu/agent-os`, tool execution in `@zhixu/model-gateway` and `@zhixu/skill-runtime`, session persistence through `AgentSession`, and Fastify SSE workflow routes. The current orchestration for course PPT and lab meeting workflows is hard-coded in `AgentPipeline`, making checkpointing, replay, parallel execution, and consistent error policy difficult.

## Decision

Create `@zhixu/agent-harness` as a control-plane package. It owns workflow definitions, graph execution, checkpointing, event emission, retries, interrupts, policy enforcement, and trace collection. It does not own domain agent logic. Existing agents and tools are connected through registries and adapters.

## Consequences

Course PPT and lab meeting workflows become declarative TypeScript workflow definitions. The server keeps existing SSE event names during migration. Future workflows can reuse checkpoint, policy, and observability behavior without duplicating pipeline code.
```

- [x] **Step 2: Review scope**

Confirm the ADR explicitly rejects a monolithic harness that absorbs `agent-os`, `skill-runtime`, `model-gateway`, or artifact rendering packages.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/architecture/agent-harness-adr.md
git commit -m "docs: add agent harness architecture decision"
```

Expected: commit contains only the ADR file.

---

## Phase 1: Harness Kernel

### Task 2: Create Core Types

**Files:**
- Create: `packages/agent-harness/package.json`
- Create: `packages/agent-harness/tsconfig.json`
- Create: `packages/agent-harness/src/types.ts`
- Create: `packages/agent-harness/src/index.ts`
- Test: `packages/agent-harness/src/types.test.ts`

- [x] **Step 1: Write failing type/runtime test**

Create `packages/agent-harness/src/types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "./types.js";

describe("WorkflowDefinition", () => {
  it("supports typed graph workflows with policies and human gates", () => {
    const workflow: WorkflowDefinition = {
      id: "course_presentation",
      name: "Course Presentation",
      version: 1,
      startNodeId: "understanding",
      nodes: [
        {
          id: "understanding",
          type: "agent",
          ref: "understanding.analyze",
          inputKeys: ["rawInput", "sources"],
          outputKey: "understanding",
          policy: { timeoutMs: 10_000, maxAttempts: 1, riskLevel: "L0" }
        },
        {
          id: "decision",
          type: "human_gate",
          ref: "presentation.selectTopic",
          inputKeys: ["topicCandidates"],
          outputKey: "selectedTopicId",
          policy: { timeoutMs: 86_400_000, maxAttempts: 1, riskLevel: "L1" }
        }
      ],
      edges: [
        { from: "understanding", to: "decision" }
      ],
      stateSchemaVersion: 1
    };

    expect(workflow.nodes[1]?.type).toBe("human_gate");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/types.test.ts
```

Expected: fail because the package and types do not exist yet.

- [x] **Step 3: Create minimal package and types**

Create `packages/agent-harness/package.json`:

```json
{
  "name": "@zhixu/agent-harness",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.14"
  }
}
```

Create `packages/agent-harness/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/agent-harness/src/types.ts`:

```typescript
export type RiskLevel = "L0" | "L1" | "L2" | "L3";

export type WorkflowNodeType =
  | "agent"
  | "tool"
  | "skill"
  | "condition"
  | "parallel"
  | "human_gate"
  | "verifier";

export interface NodePolicy {
  timeoutMs: number;
  maxAttempts: number;
  riskLevel: RiskLevel;
  fallbackRef?: string;
  requiresApproval?: boolean;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  ref: string;
  inputKeys: string[];
  outputKey: string;
  policy: NodePolicy;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  conditionRef?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  startNodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  stateSchemaVersion: number;
}

export interface WorkflowState {
  workflowId: string;
  runId: string;
  traceId: string;
  status: "idle" | "running" | "waiting_human" | "completed" | "failed";
  values: Record<string, unknown>;
  completedNodeIds: string[];
  failedNodeIds: string[];
  pendingNodeIds: string[];
  currentNodeId?: string;
}
```

Create `packages/agent-harness/src/index.ts`:

```typescript
export type {
  NodePolicy,
  RiskLevel,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowState
} from "./types.js";
```

- [x] **Step 4: Run test**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/types.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness
git commit -m "feat(agent-harness): add core workflow types"
```

Expected: commit contains only the new harness package skeleton and type test.

---

### Task 3: Implement Scheduler

**Files:**
- Create: `packages/agent-harness/src/workflow/scheduler.ts`
- Test: `packages/agent-harness/src/workflow/scheduler.test.ts`

- [x] **Step 1: Write failing scheduler tests**

Create `packages/agent-harness/src/workflow/scheduler.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getReadyNodeIds } from "./scheduler.js";
import type { WorkflowDefinition } from "../types.js";

const workflow: WorkflowDefinition = {
  id: "lab_meeting",
  name: "Lab Meeting",
  version: 1,
  startNodeId: "brief",
  stateSchemaVersion: 1,
  nodes: [
    { id: "brief", type: "agent", ref: "brief.create", inputKeys: [], outputKey: "brief", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "paper_a", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperA", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "paper_b", type: "agent", ref: "paper.read", inputKeys: ["brief"], outputKey: "paperB", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L0" } },
    { id: "matrix", type: "agent", ref: "paper.matrix", inputKeys: ["paperA", "paperB"], outputKey: "matrix", policy: { timeoutMs: 1000, maxAttempts: 1, riskLevel: "L1" } }
  ],
  edges: [
    { from: "brief", to: "paper_a" },
    { from: "brief", to: "paper_b" },
    { from: "paper_a", to: "matrix" },
    { from: "paper_b", to: "matrix" }
  ]
};

describe("getReadyNodeIds", () => {
  it("starts with the workflow start node", () => {
    expect(getReadyNodeIds(workflow, [])).toEqual(["brief"]);
  });

  it("returns parallel nodes after their shared dependency completes", () => {
    expect(getReadyNodeIds(workflow, ["brief"]).sort()).toEqual(["paper_a", "paper_b"]);
  });

  it("waits until all dependencies complete", () => {
    expect(getReadyNodeIds(workflow, ["brief", "paper_a"])).toEqual(["paper_b"]);
    expect(getReadyNodeIds(workflow, ["brief", "paper_a", "paper_b"])).toEqual(["matrix"]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/workflow/scheduler.test.ts
```

Expected: fail because `scheduler.ts` does not exist.

- [x] **Step 3: Implement scheduler**

Create `packages/agent-harness/src/workflow/scheduler.ts`:

```typescript
import type { WorkflowDefinition } from "../types.js";

export function getReadyNodeIds(
  workflow: WorkflowDefinition,
  completedNodeIds: string[]
): string[] {
  const completed = new Set(completedNodeIds);
  if (completed.size === 0) return [workflow.startNodeId];

  return workflow.nodes
    .filter((node) => !completed.has(node.id))
    .filter((node) => {
      const incoming = workflow.edges.filter((edge) => edge.to === node.id);
      if (incoming.length === 0) return node.id === workflow.startNodeId;
      return incoming.every((edge) => completed.has(edge.from));
    })
    .map((node) => node.id);
}
```

- [x] **Step 4: Run test**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/workflow/scheduler.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness/src/workflow/scheduler.ts packages/agent-harness/src/workflow/scheduler.test.ts
git commit -m "feat(agent-harness): schedule ready workflow nodes"
```

Expected: commit contains scheduler and tests only.

---

### Task 4: Implement Checkpoint Store

**Files:**
- Create: `packages/agent-harness/src/checkpoint/checkpoint-store.ts`
- Test: `packages/agent-harness/src/checkpoint/checkpoint-store.test.ts`

- [x] **Step 1: Write failing checkpoint tests**

Create `packages/agent-harness/src/checkpoint/checkpoint-store.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { InMemoryCheckpointStore } from "./checkpoint-store.js";

describe("InMemoryCheckpointStore", () => {
  it("saves and loads the latest checkpoint for a run", async () => {
    const store = new InMemoryCheckpointStore();
    await store.save({
      runId: "run-1",
      checkpointId: "cp-1",
      superstep: 1,
      state: { values: { brief: { id: "brief-1" } } },
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    const latest = await store.loadLatest("run-1");
    expect(latest?.checkpointId).toBe("cp-1");
    expect(latest?.state).toEqual({ values: { brief: { id: "brief-1" } } });
  });

  it("keeps checkpoint history ordered by superstep", async () => {
    const store = new InMemoryCheckpointStore();
    await store.save({ runId: "run-1", checkpointId: "cp-1", superstep: 1, state: {}, createdAt: "2026-06-01T00:00:00.000Z" });
    await store.save({ runId: "run-1", checkpointId: "cp-2", superstep: 2, state: {}, createdAt: "2026-06-01T00:00:01.000Z" });

    const history = await store.list("run-1");
    expect(history.map((cp) => cp.checkpointId)).toEqual(["cp-1", "cp-2"]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/checkpoint/checkpoint-store.test.ts
```

Expected: fail because checkpoint store does not exist.

- [x] **Step 3: Implement checkpoint store**

Create `packages/agent-harness/src/checkpoint/checkpoint-store.ts`:

```typescript
export interface WorkflowCheckpoint {
  runId: string;
  checkpointId: string;
  superstep: number;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface CheckpointStore {
  save(checkpoint: WorkflowCheckpoint): Promise<void>;
  loadLatest(runId: string): Promise<WorkflowCheckpoint | null>;
  list(runId: string): Promise<WorkflowCheckpoint[]>;
}

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, WorkflowCheckpoint[]>();

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    const existing = this.checkpoints.get(checkpoint.runId) ?? [];
    const next = [...existing, checkpoint].sort((a, b) => a.superstep - b.superstep);
    this.checkpoints.set(checkpoint.runId, next);
  }

  async loadLatest(runId: string): Promise<WorkflowCheckpoint | null> {
    const runCheckpoints = this.checkpoints.get(runId) ?? [];
    return runCheckpoints.at(-1) ?? null;
  }

  async list(runId: string): Promise<WorkflowCheckpoint[]> {
    return [...(this.checkpoints.get(runId) ?? [])];
  }
}
```

- [x] **Step 4: Run test**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/checkpoint/checkpoint-store.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness/src/checkpoint
git commit -m "feat(agent-harness): add checkpoint store"
```

Expected: commit contains checkpoint store and tests only.

---

## Phase 2: Runtime, Events, and Policies

### Task 5: Implement Agent Registry and Executor

**Files:**
- Create: `packages/agent-harness/src/registry/agent-registry.ts`
- Create: `packages/agent-harness/src/workflow/executor.ts`
- Test: `packages/agent-harness/src/workflow/executor.test.ts`

- [x] **Step 1: Write failing executor test**

Create a test where two registered handlers run in sequence, the first writes `brief`, the second reads `brief` and writes `outline`, and the final state contains both outputs.

- [x] **Step 2: Implement `AgentRegistry`**

Implement a small registry with:

```typescript
export type NodeHandler = (input: Record<string, unknown>) => Promise<unknown>;

export class AgentRegistry {
  private readonly handlers = new Map<string, NodeHandler>();

  register(ref: string, handler: NodeHandler): void {
    this.handlers.set(ref, handler);
  }

  get(ref: string): NodeHandler {
    const handler = this.handlers.get(ref);
    if (!handler) throw new Error(`Agent handler not found: ${ref}`);
    return handler;
  }
}
```

- [x] **Step 3: Implement minimal executor**

Executor behavior:

1. Create initial state with `runId`, `traceId`, and input values.
2. Resolve ready nodes through `getReadyNodeIds`.
3. Execute all ready nodes in a superstep with `Promise.all`.
4. Store each node output under `outputKey`.
5. Save checkpoint after each superstep.
6. Stop when all nodes complete.

- [x] **Step 4: Run executor tests**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/workflow/executor.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness/src/registry/agent-registry.ts packages/agent-harness/src/workflow/executor.ts packages/agent-harness/src/workflow/executor.test.ts
git commit -m "feat(agent-harness): execute registered workflow nodes"
```

---

### Task 6: Add Interrupts and Human Gates

**Files:**
- Create: `packages/agent-harness/src/runtime/interrupts.ts`
- Modify: `packages/agent-harness/src/workflow/executor.ts`
- Test: `packages/agent-harness/src/workflow/executor.test.ts`

- [x] **Step 1: Add failing human gate test**

Test a workflow with `agent -> human_gate -> agent`. Expected behavior:

1. First invoke returns state `status: "waiting_human"`.
2. Checkpoint contains pending human gate node.
3. Resume with `{ selectedTopicId: "topic-1" }` completes the workflow.

- [x] **Step 2: Implement interrupt result**

Create:

```typescript
export interface WorkflowInterrupt {
  type: "human_gate";
  nodeId: string;
  ref: string;
  input: Record<string, unknown>;
}
```

- [x] **Step 3: Update executor**

When a ready node has `type: "human_gate"`, do not execute a handler. Save checkpoint and return `status: "waiting_human"` with an interrupt payload.

- [x] **Step 4: Run executor tests**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/workflow/executor.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness/src/runtime/interrupts.ts packages/agent-harness/src/workflow/executor.ts packages/agent-harness/src/workflow/executor.test.ts
git commit -m "feat(agent-harness): support human gate interrupts"
```

---

### Task 7: Add Retry, Timeout, and Error Classification

**Files:**
- Create: `packages/agent-harness/src/policy/retry.ts`
- Modify: `packages/agent-harness/src/workflow/executor.ts`
- Test: `packages/agent-harness/src/policy/retry.test.ts`
- Test: `packages/agent-harness/src/workflow/executor.test.ts`

- [x] **Step 1: Add failing retry tests**

Test that a node with `maxAttempts: 2` retries once after a thrown error and succeeds on the second attempt.

- [x] **Step 2: Add failing timeout test**

Test that a node whose handler never resolves is marked failed after its `timeoutMs`.

- [x] **Step 3: Implement `runWithRetry`**

Implement:

```typescript
export async function runWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts: number; timeoutMs: number }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await runWithTimeout(operation, options.timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm --filter @zhixu/agent-harness test -- --run src/policy/retry.test.ts src/workflow/executor.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-harness/src/policy packages/agent-harness/src/workflow/executor.ts packages/agent-harness/src/workflow/executor.test.ts
git commit -m "feat(agent-harness): enforce retry and timeout policies"
```

---

## Phase 3: Migrate Existing Workflows

### Task 8: Bind Existing Agents to Harness

**Files:**
- Create: `packages/agent-os/src/workflows/agent-handlers.ts`
- Modify: `packages/agent-os/package.json`
- Test: `packages/agent-os/src/workflows/agent-handlers.test.ts`

- [x] **Step 1: Add harness dependency**

Modify `packages/agent-os/package.json` to include:

```json
"@zhixu/agent-harness": "workspace:*"
```

- [x] **Step 2: Create agent handler registration**

Create handlers for these refs:

```text
understanding.analyze
presentation.generateTopicCandidates
presentation.generateSlideOutline
presentation.generateSpeakerNotes
paper.readPaper
paper.generateComparisonMatrix
paper.generatePresentationPaths
paper.generateAdvisorQuestions
```

Each handler should call the existing class methods in `packages/agent-os/src`.

- [x] **Step 3: Test registry coverage**

Test that all refs used by course and lab workflows are registered.

- [x] **Step 4: Run tests**

Run:

```bash
pnpm --filter @zhixu/agent-os test -- --run src/workflows/agent-handlers.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-os/package.json packages/agent-os/src/workflows
git commit -m "feat(agent-os): register harness agent handlers"
```

---

### Task 9: Define Course Presentation Workflow

**Files:**
- Create: `packages/agent-os/src/workflows/course-presentation.workflow.ts`
- Test: `packages/agent-os/src/workflows/course-presentation.workflow.test.ts`

- [x] **Step 1: Add failing workflow definition test**

Assert the workflow contains:

```text
understanding -> topic_candidates -> select_topic -> slide_outline -> speaker_notes -> verification
```

Assert `select_topic` has type `human_gate`.

- [x] **Step 2: Create workflow definition**

Create a typed workflow with node refs:

```text
understanding.analyze
presentation.generateTopicCandidates
presentation.selectTopic
presentation.generateSlideOutline
presentation.generateSpeakerNotes
presentation.verifyEvidence
```

Use existing behavior for progress percentages:

```text
task_capture 5
understanding 10
decision 25
outline_generation 50
speaker_notes 70
verification 85
export_ready 95
completed 100
```

- [x] **Step 3: Run tests**

Run:

```bash
pnpm --filter @zhixu/agent-os test -- --run src/workflows/course-presentation.workflow.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/agent-os/src/workflows/course-presentation.workflow.ts packages/agent-os/src/workflows/course-presentation.workflow.test.ts
git commit -m "feat(agent-os): define course presentation workflow"
```

---

### Task 10: Define Lab Meeting Workflow with Parallel Paper Reading

**Files:**
- Create: `packages/agent-os/src/workflows/lab-meeting.workflow.ts`
- Test: `packages/agent-os/src/workflows/lab-meeting.workflow.test.ts`

- [x] **Step 1: Add failing workflow definition test**

Assert the workflow contains:

```text
understanding -> paper_reading_group -> matrix_generation -> presentation_paths -> select_path -> slide_outline -> speaker_notes -> advisor_questions -> verification
```

Assert `paper_reading_group` is declared as parallel-capable.

- [x] **Step 2: Create workflow definition**

The paper reading node should support fan-out over `sources`, allowing the harness executor to run per-source reads in parallel and collect `paperCards`.

- [x] **Step 3: Run tests**

Run:

```bash
pnpm --filter @zhixu/agent-os test -- --run src/workflows/lab-meeting.workflow.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/agent-os/src/workflows/lab-meeting.workflow.ts packages/agent-os/src/workflows/lab-meeting.workflow.test.ts
git commit -m "feat(agent-os): define lab meeting workflow"
```

---

### Task 11: Convert AgentPipeline to Compatibility Adapter

**Files:**
- Modify: `packages/agent-os/src/pipeline.ts`
- Test: `packages/agent-os/src/pipeline.test.ts`

- [x] **Step 1: Add compatibility tests**

For `runCoursePresentation`, assert the returned result shape remains:

```typescript
{
  type: "course_presentation",
  brief,
  topicCandidates,
  slidePlans,
  speakerNotes
}
```

For `runLabMeeting`, assert the returned result shape remains:

```typescript
{
  type: "lab_meeting",
  brief,
  paperCards,
  comparisonMatrix,
  presentationPaths,
  advisorQuestions,
  slidePlans,
  speakerNotes
}
```

- [x] **Step 2: Replace internal orchestration**

Keep callback methods:

```typescript
onThinking
onProgress
onAgentStatus
onCanvasPatch
onDecision
pauseAtPhase
resume
getPhase
setExecutor
```

Route `runCoursePresentation` and `runLabMeeting` through the harness executor and event bridge.

- [x] **Step 3: Preserve legacy general `run`**

Do not migrate `run(input)` in P0. Leave it as-is unless shared helper extraction is required.

- [x] **Step 4: Run tests**

Run:

```bash
pnpm --filter @zhixu/agent-os test -- --run src/pipeline.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/agent-os/src/pipeline.ts packages/agent-os/src/pipeline.test.ts
git commit -m "refactor(agent-os): delegate presentation workflows to harness"
```

---

## Phase 4: Server Checkpoint and SSE Compatibility

### Task 12: Add AgentSession Checkpoint Adapter

**Files:**
- Modify: `apps/server/src/routes/agent-session-helpers.ts`
- Test: `apps/server/src/routes/agent-session-helpers.test.ts`

- [x] **Step 1: Add checkpoint adapter test**

Test that saving a checkpoint writes:

```text
currentPhase
progressJson
agentsJson
canvasStateJson
```

into the existing `AgentSession` row without requiring a new table.

- [x] **Step 2: Implement adapter**

Expose helper functions:

```typescript
export async function saveWorkflowCheckpoint(input: {
  agentSessionId: string;
  phase: string;
  state: Record<string, unknown>;
  progress: unknown[];
  agents: unknown[];
}): Promise<void>
```

- [x] **Step 3: Run server tests**

Run:

```bash
pnpm --filter @zhixu/server test -- --run src/routes/agent-session-helpers.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/server/src/routes/agent-session-helpers.ts apps/server/src/routes/agent-session-helpers.test.ts
git commit -m "feat(server): persist harness checkpoints in agent sessions"
```

---

### Task 13: Verify Workflow Routes Preserve SSE Events

**Files:**
- Modify: `apps/server/src/routes/workflow.ts`
- Test: `apps/server/src/e2e.test.ts`

- [x] **Step 1: Add SSE event compatibility test**

Assert `/api/workflows/course-presentation` still emits:

```text
agent_thinking
agent_progress
agent_status
canvas_patch
agent_decision
workflow_complete
```

Assert `/api/workflows/lab-meeting` emits the same event family.

- [x] **Step 2: Keep route response contract unchanged**

Do not rename endpoints, request fields, or SSE event names.

- [x] **Step 3: Run tests**

Run:

```bash
pnpm --filter @zhixu/server test -- --run src/e2e.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/server/src/routes/workflow.ts apps/server/src/e2e.test.ts
git commit -m "test(server): preserve workflow SSE compatibility"
```

---

## Phase 5: Quality Gates

### Task 14: Add Harness Regression Suite

**Files:**
- Create: `packages/agent-harness/src/testing/workflow-fixtures.ts`
- Create: `packages/agent-harness/src/testing/regression.test.ts`

- [x] **Step 1: Create fixed workflow fixtures**

Add fixtures for:

```text
course_presentation_minimal
lab_meeting_three_papers
human_gate_resume
parallel_partial_failure
retry_then_success
```

- [x] **Step 2: Add regression tests**

Each fixture should assert:

```text
final status
completed node ids
checkpoint count
event order
no duplicate successful node execution after resume
```

- [x] **Step 3: Run harness tests**

Run:

```bash
pnpm --filter @zhixu/agent-harness test
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/agent-harness/src/testing
git commit -m "test(agent-harness): add workflow regression fixtures"
```

---

### Task 15: Full Verification

**Files:**
- Modify only files required by failing tests discovered in this task.

- [x] **Step 1: Typecheck core packages**

Run:

```bash
pnpm --filter @zhixu/agent-harness --filter @zhixu/agent-os --filter @zhixu/server typecheck
```

Expected: no TypeScript errors.

- [x] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @zhixu/agent-harness test
pnpm --filter @zhixu/agent-os test -- --run src/pipeline.test.ts
pnpm --filter @zhixu/server test -- --run src/e2e.test.ts
```

Expected: all pass.

- [x] **Step 3: Run workspace build if focused tests pass**

Run:

```bash
pnpm --filter @zhixu/agent-harness --filter @zhixu/agent-os --filter @zhixu/server build
```

Expected: all builds pass.

- [x] **Step 4: Write migration notes**

Create `docs/architecture/agent-harness-migration-notes.md` with:

```markdown
# Agent Harness Migration Notes

## Migrated in P0

- Course presentation workflow
- Lab meeting workflow
- AgentPipeline compatibility adapter
- SSE event compatibility
- AgentSession checkpoint adapter

## Not Migrated in P0

- General `AgentPipeline.run`
- Long-term memory store
- YAML/JSON workflow loading
- Visual workflow editor
- Advanced cost scheduler

## Operational Notes

- Existing frontend SSE clients do not need endpoint changes.
- Existing domain agent classes remain in `@zhixu/agent-os`.
- Failed parallel paper reads should not force successful paper reads to rerun after resume.
```

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/architecture/agent-harness-migration-notes.md
git commit -m "docs: add agent harness migration notes"
```

---

## Recommended Implementation Order

1. Task 1: ADR.
2. Tasks 2-4: harness kernel.
3. Tasks 5-7: executor, interrupts, policy.
4. Tasks 8-10: existing agent bindings and workflow definitions.
5. Task 11: compatibility adapter.
6. Tasks 12-13: server checkpoint and SSE.
7. Tasks 14-15: regression and verification.

Do not implement YAML/JSON workflow loading in P0. Use TypeScript workflow definitions first because they are safer with the current monorepo and allow direct type checking against existing agent outputs.

---

## Risks and Controls

| Risk | Control |
|------|---------|
| Harness becomes a god package | Only define interfaces/adapters in harness; keep domain logic in existing packages |
| SSE frontend breaks | Preserve event names and add compatibility tests |
| Resume reruns expensive successful work | Persist node-level writes and test parallel partial failure |
| Agent outputs become inconsistent | Require input/output contract tests for workflow handlers |
| Migration scope explodes | P0 migrates only course PPT and lab meeting |
| Human gate state gets lost | Save interrupt payload into checkpoint before returning |
| Parallelism creates race conditions | Write scheduler tests and checkpoint tests before migration |

---

## Done Criteria

The P0 migration is complete only when:

1. `@zhixu/agent-harness` builds and passes its tests.
2. Course PPT and lab meeting workflows are defined declaratively.
3. `AgentPipeline.runCoursePresentation` and `AgentPipeline.runLabMeeting` still return their legacy result shapes.
4. Existing Fastify workflow routes keep the same request shape and SSE event names.
5. Lab meeting paper reading can execute as a parallel superstep.
6. A human gate can pause and resume from checkpoint.
7. Retry and timeout policies are enforced by the harness executor.
8. Focused typecheck, tests, and builds pass.

