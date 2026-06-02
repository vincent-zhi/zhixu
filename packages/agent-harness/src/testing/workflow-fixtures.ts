import type { WorkflowDefinition } from "../types.js";

const nodePolicy = { timeoutMs: 5000, maxAttempts: 1, riskLevel: "L0" as const };

export const coursePresentationMinimal: WorkflowDefinition = {
  id: "course_presentation_minimal",
  name: "Course Presentation Minimal",
  version: 1,
  startNodeId: "understanding",
  stateSchemaVersion: 1,
  nodes: [
    { id: "understanding", type: "agent", ref: "understanding.run", inputKeys: ["rawInput"], outputKey: "understanding", policy: nodePolicy },
    { id: "outline", type: "agent", ref: "outline.run", inputKeys: ["understanding"], outputKey: "outline", policy: nodePolicy }
  ],
  edges: [
    { from: "understanding", to: "outline" }
  ]
};

export const labMeetingThreePapers: WorkflowDefinition = {
  id: "lab_meeting_three_papers",
  name: "Lab Meeting Three Papers",
  version: 1,
  startNodeId: "brief",
  stateSchemaVersion: 1,
  nodes: [
    { id: "brief", type: "agent", ref: "brief.run", inputKeys: [], outputKey: "brief", policy: nodePolicy },
    { id: "paper_a", type: "agent", ref: "paper.a", inputKeys: ["brief"], outputKey: "paperA", policy: nodePolicy },
    { id: "paper_b", type: "agent", ref: "paper.b", inputKeys: ["brief"], outputKey: "paperB", policy: nodePolicy },
    { id: "paper_c", type: "agent", ref: "paper.c", inputKeys: ["brief"], outputKey: "paperC", policy: nodePolicy },
    { id: "matrix", type: "agent", ref: "matrix.run", inputKeys: ["paperA", "paperB", "paperC"], outputKey: "matrix", policy: nodePolicy }
  ],
  edges: [
    { from: "brief", to: "paper_a" },
    { from: "brief", to: "paper_b" },
    { from: "brief", to: "paper_c" },
    { from: "paper_a", to: "matrix" },
    { from: "paper_b", to: "matrix" },
    { from: "paper_c", to: "matrix" }
  ]
};

export const humanGateResume: WorkflowDefinition = {
  id: "human_gate_resume",
  name: "Human Gate Resume",
  version: 1,
  startNodeId: "draft",
  stateSchemaVersion: 1,
  nodes: [
    { id: "draft", type: "agent", ref: "draft.run", inputKeys: [], outputKey: "draft", policy: nodePolicy },
    { id: "approve", type: "human_gate", ref: "approval.select", inputKeys: ["draft"], outputKey: "approval", policy: nodePolicy },
    { id: "final", type: "agent", ref: "final.run", inputKeys: ["approval"], outputKey: "final", policy: nodePolicy }
  ],
  edges: [
    { from: "draft", to: "approve" },
    { from: "approve", to: "final" }
  ]
};

export const parallelPartialFailure: WorkflowDefinition = {
  id: "parallel_partial_failure",
  name: "Parallel Partial Failure",
  version: 1,
  startNodeId: "start",
  stateSchemaVersion: 1,
  nodes: [
    { id: "start", type: "agent", ref: "start.run", inputKeys: [], outputKey: "start", policy: nodePolicy },
    { id: "ok_branch", type: "agent", ref: "ok.run", inputKeys: ["start"], outputKey: "ok", policy: nodePolicy },
    { id: "fail_branch", type: "agent", ref: "fail.run", inputKeys: ["start"], outputKey: "failed", policy: nodePolicy }
  ],
  edges: [
    { from: "start", to: "ok_branch" },
    { from: "start", to: "fail_branch" }
  ]
};

export const retryThenSuccess: WorkflowDefinition = {
  id: "retry_then_success",
  name: "Retry Then Success",
  version: 1,
  startNodeId: "flaky",
  stateSchemaVersion: 1,
  nodes: [
    { id: "flaky", type: "agent", ref: "flaky.run", inputKeys: [], outputKey: "result", policy: { ...nodePolicy, maxAttempts: 2 } }
  ],
  edges: []
};
