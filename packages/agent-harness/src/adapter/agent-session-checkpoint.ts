import type { CheckpointStore, WorkflowCheckpoint } from "../types.js";

export interface AgentSessionCheckpointOperations {
  save(checkpoint: WorkflowCheckpoint): Promise<void>;
  list(runId: string): Promise<WorkflowCheckpoint[]>;
  rollback?(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null>;
}

export class AgentSessionCheckpointStore implements CheckpointStore {
  private readonly memoryStore = new Map<string, WorkflowCheckpoint[]>();

  constructor(private readonly operations?: AgentSessionCheckpointOperations) {}

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    if (this.operations) {
      await this.operations.save(checkpoint);
      return;
    }

    const existing = this.memoryStore.get(checkpoint.runId) ?? [];
    const next = [...existing, checkpoint].sort((a, b) => a.superstep - b.superstep);
    this.memoryStore.set(checkpoint.runId, next);
  }

  async loadLatest(runId: string): Promise<WorkflowCheckpoint | null> {
    const runCheckpoints = await this.list(runId);
    return runCheckpoints.at(-1) ?? null;
  }

  async load(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null> {
    const runCheckpoints = await this.list(runId);
    return runCheckpoints.find((checkpoint) => checkpoint.checkpointId === checkpointId) ?? null;
  }

  async list(runId: string): Promise<WorkflowCheckpoint[]> {
    if (this.operations) {
      return [...(await this.operations.list(runId))]
        .sort((a, b) => a.superstep - b.superstep);
    }

    return [...(this.memoryStore.get(runId) ?? [])];
  }

  async rollback(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null> {
    if (this.operations?.rollback) {
      return this.operations.rollback(runId, checkpointId);
    }

    const checkpoint = await this.load(runId, checkpointId);
    if (!checkpoint) return null;

    if (!this.operations) {
      const retained = (this.memoryStore.get(runId) ?? [])
        .filter((candidate) => candidate.superstep <= checkpoint.superstep)
        .sort((a, b) => a.superstep - b.superstep);
      this.memoryStore.set(runId, retained);
    }

    return checkpoint;
  }
}
