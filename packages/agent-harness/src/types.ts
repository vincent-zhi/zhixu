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

export type WorkflowRunStatus =
  | "idle"
  | "running"
  | "waiting_human"
  | "completed"
  | "failed";

export interface WorkflowState {
  workflowId: string;
  runId: string;
  traceId: string;
  status: WorkflowRunStatus;
  values: Record<string, unknown>;
  completedNodeIds: string[];
  failedNodeIds: string[];
  pendingNodeIds: string[];
  currentNodeId?: string;
}

export interface WorkflowInterrupt {
  type: "human_gate";
  nodeId: string;
  ref: string;
  input: Record<string, unknown>;
}

export interface WorkflowCheckpoint {
  runId: string;
  traceId?: string;
  checkpointId: string;
  superstep: number;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface CheckpointStore {
  save(checkpoint: WorkflowCheckpoint): Promise<void>;
  load(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null>;
  loadLatest(runId: string): Promise<WorkflowCheckpoint | null>;
  list(runId: string): Promise<WorkflowCheckpoint[]>;
  rollback(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null>;
}

export interface RuntimeNodeContext {
  workflowId: string;
  runId: string;
  traceId: string;
  nodeId: string;
  nodeRef: string;
  input: Record<string, unknown>;
  state: WorkflowState;
  checkpoint(state: WorkflowState): Promise<void>;
  emit(type: HarnessEvent["type"], detail?: Record<string, unknown>): void;
}

export type NodeHandler = (
  input: Record<string, unknown>,
  context?: RuntimeNodeContext
) => Promise<unknown>;

export interface HarnessEvent {
  type:
    | "node_started"
    | "node_completed"
    | "node_failed"
    | "superstep_completed"
    | "workflow_interrupted"
    | "workflow_completed"
    | "workflow_failed";
  runId: string;
  traceId: string;
  nodeId?: string;
  nodeRef?: string;
  superstep?: number;
  timestamp: string;
  detail?: Record<string, unknown>;
}
