import type { HarnessEvent, RuntimeNodeContext, WorkflowState } from "../types.js";

export interface RuntimeContextInput {
  workflowId: string;
  nodeId: string;
  nodeRef: string;
  input: Record<string, unknown>;
  state: WorkflowState;
  saveCheckpoint(state: WorkflowState): Promise<void>;
  emitEvent(event: HarnessEvent): void;
}

export function createRuntimeContext(input: RuntimeContextInput): RuntimeNodeContext {
  return {
    workflowId: input.workflowId,
    runId: input.state.runId,
    traceId: input.state.traceId,
    nodeId: input.nodeId,
    nodeRef: input.nodeRef,
    input: input.input,
    state: input.state,
    checkpoint: input.saveCheckpoint,
    emit: (type, detail) => {
      input.emitEvent({
        type,
        runId: input.state.runId,
        traceId: input.state.traceId,
        nodeId: input.nodeId,
        nodeRef: input.nodeRef,
        timestamp: new Date().toISOString(),
        ...(detail ? { detail } : {})
      });
    }
  };
}
