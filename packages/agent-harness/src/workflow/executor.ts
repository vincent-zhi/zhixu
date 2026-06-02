import type {
  WorkflowDefinition,
  WorkflowState,
  WorkflowInterrupt,
  CheckpointStore,
  NodeHandler,
  HarnessEvent
} from "../types.js";
import { getReadyNodeIds } from "./scheduler.js";
import { AgentRegistry } from "../registry/agent-registry.js";
import { runWithRetry } from "../policy/retry.js";
import { HarnessEventEmitter } from "../runtime/events.js";
import { createRuntimeContext } from "../runtime/context.js";
import { TraceRecorder } from "../observability/trace.js";

export interface ExecutorConfig {
  maxSupersteps?: number;
}

export interface ExecutorResult {
  state: WorkflowState;
  interrupt?: WorkflowInterrupt;
}

export class WorkflowExecutor {
  private readonly maxSupersteps: number;

  constructor(
    private readonly registry: AgentRegistry,
    private readonly checkpointStore: CheckpointStore,
    private readonly eventEmitter: HarnessEventEmitter,
    config?: ExecutorConfig
  ) {
    this.maxSupersteps = config?.maxSupersteps ?? 100;
  }

  async run(
    workflow: WorkflowDefinition,
    input: Record<string, unknown>,
    options?: {
      runId?: string;
      traceId?: string;
      resumeFrom?: WorkflowState;
    }
  ): Promise<ExecutorResult> {
    const runId = options?.runId ?? crypto.randomUUID();
    const traceId = options?.traceId ?? crypto.randomUUID();
    const trace = new TraceRecorder(runId, traceId);

    let state: WorkflowState = options?.resumeFrom ?? {
      workflowId: workflow.id,
      runId,
      traceId,
      status: "running",
      values: { ...input },
      completedNodeIds: [],
      failedNodeIds: [],
      pendingNodeIds: workflow.nodes.map((n) => n.id)
    };

    if (state.status !== "running") {
      state = { ...state, status: "running" };
    }

    for (let superstep = 0; superstep < this.maxSupersteps; superstep++) {
      const readyNodeIds = getReadyNodeIds(
        workflow,
        state.completedNodeIds,
        state.failedNodeIds
      );

      if (readyNodeIds.length === 0) {
        const finalState: WorkflowState = {
          ...state,
          status: "completed",
          pendingNodeIds: []
        };
        await this.saveCheckpoint(finalState, superstep);
        this.emitEvent("workflow_completed", finalState, { superstep });
        return { state: finalState };
      }

      const readyNodes = readyNodeIds
        .map((id) => workflow.nodes.find((n) => n.id === id))
        .filter((n): n is NonNullable<typeof n> => n !== undefined);

      const humanGateNode = readyNodes.find((n) => n.type === "human_gate");
      if (humanGateNode) {
        const interrupt: WorkflowInterrupt = {
          type: "human_gate",
          nodeId: humanGateNode.id,
          ref: humanGateNode.ref,
          input: this.resolveInput(state.values, humanGateNode.inputKeys)
        };

        const interruptedState: WorkflowState = {
          ...state,
          status: "waiting_human",
          currentNodeId: humanGateNode.id,
          pendingNodeIds: workflow.nodes
            .filter((n) => !state.completedNodeIds.includes(n.id))
            .map((n) => n.id)
        };

        await this.saveCheckpoint(interruptedState, superstep);
        this.emitEvent("workflow_interrupted", interruptedState, {
          superstep,
          nodeId: humanGateNode.id,
          nodeRef: humanGateNode.ref
        });

        return { state: interruptedState, interrupt };
      }

      const agentNodes = readyNodes.filter((n) => n.type !== "human_gate");

      const results = await Promise.all(
        agentNodes.map(async (node) => {
          this.emitEvent("node_started", state, {
            superstep,
            nodeId: node.id,
            nodeRef: node.ref
          });
          trace.startNode(node.id, node.ref);

          try {
            const handler = this.registry.get(node.ref);
            const nodeInput = this.resolveInput(state.values, node.inputKeys);
            const context = createRuntimeContext({
              workflowId: workflow.id,
              nodeId: node.id,
              nodeRef: node.ref,
              input: nodeInput,
              state,
              saveCheckpoint: (nextState) => this.saveCheckpoint(nextState, superstep),
              emitEvent: (event) => this.eventEmitter.emit(event)
            });

            const output = await runWithRetry(
              () => handler(nodeInput, context),
              {
                maxAttempts: node.policy.maxAttempts,
                timeoutMs: node.policy.timeoutMs
              }
            );
            trace.completeNode(node.id);

            this.emitEvent("node_completed", state, {
              superstep,
              nodeId: node.id,
              nodeRef: node.ref,
              outputKey: node.outputKey
            });

            return { nodeId: node.id, outputKey: node.outputKey, output, failed: false };
          } catch (error) {
            this.emitEvent("node_failed", state, {
              superstep,
              nodeId: node.id,
              nodeRef: node.ref,
              error: error instanceof Error ? error.message : String(error)
            });
            trace.failNode(node.id, error);

            return {
              nodeId: node.id,
              outputKey: node.outputKey,
              output: undefined,
              failed: true
            };
          }
        })
      );

      const newValues = { ...state.values };
      const newCompleted = [...state.completedNodeIds];
      const newFailed = [...state.failedNodeIds];

      for (const result of results) {
        if (result.failed) {
          newFailed.push(result.nodeId);
        } else {
          newValues[result.outputKey] = result.output;
          newCompleted.push(result.nodeId);
        }
      }

      const allFailed = results.length > 0 && results.every((r) => r.failed);

      if (allFailed || results.some((r) => r.failed)) {
        const failedState: WorkflowState = {
          ...state,
          status: "failed",
          values: newValues,
          completedNodeIds: newCompleted,
          failedNodeIds: newFailed,
          pendingNodeIds: workflow.nodes
            .filter((n) => !newCompleted.includes(n.id) && !newFailed.includes(n.id))
            .map((n) => n.id)
        };
        await this.saveCheckpoint(failedState, superstep);
        this.emitEvent("workflow_failed", failedState, { superstep, trace: trace.summary() });
        return { state: failedState };
      }

      state = {
        ...state,
        values: newValues,
        completedNodeIds: newCompleted,
        failedNodeIds: newFailed,
        pendingNodeIds: workflow.nodes
          .filter((n) => !newCompleted.includes(n.id) && !newFailed.includes(n.id))
          .map((n) => n.id)
      };

      await this.saveCheckpoint(state, superstep);
      this.emitEvent("superstep_completed", state, { superstep });
    }

    const exhaustedState: WorkflowState = {
      ...state,
      status: "failed"
    };
    this.emitEvent("workflow_failed", exhaustedState, { reason: "max_supersteps_exceeded" });
    return { state: exhaustedState };
  }

  private resolveInput(
    values: Record<string, unknown>,
    inputKeys: string[]
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {};
    for (const key of inputKeys) {
      if (key in values) {
        input[key] = values[key];
      }
    }
    return input;
  }

  private async saveCheckpoint(state: WorkflowState, superstep: number): Promise<void> {
    await this.checkpointStore.save({
      runId: state.runId,
      traceId: state.traceId,
      checkpointId: crypto.randomUUID(),
      superstep,
      state: { values: state.values, completedNodeIds: state.completedNodeIds, failedNodeIds: state.failedNodeIds },
      createdAt: new Date().toISOString()
    });
  }

  private emitEvent(
    type: HarnessEvent["type"],
    state: WorkflowState,
    extra: Record<string, unknown>
  ): void {
    this.eventEmitter.emit({
      type,
      runId: state.runId,
      traceId: state.traceId,
      timestamp: new Date().toISOString(),
      ...extra
    });
  }
}
