import type { WorkflowCheckpoint, CheckpointStore } from "../types.js";

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, WorkflowCheckpoint[]>();

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    const existing = this.checkpoints.get(checkpoint.runId) ?? [];
    const next = [...existing, checkpoint].sort((a, b) => a.superstep - b.superstep);
    this.checkpoints.set(checkpoint.runId, next);
  }

  async load(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null> {
    const runCheckpoints = this.checkpoints.get(runId) ?? [];
    return runCheckpoints.find((checkpoint) => checkpoint.checkpointId === checkpointId) ?? null;
  }

  async loadLatest(runId: string): Promise<WorkflowCheckpoint | null> {
    const runCheckpoints = this.checkpoints.get(runId) ?? [];
    return runCheckpoints.at(-1) ?? null;
  }

  async list(runId: string): Promise<WorkflowCheckpoint[]> {
    return [...(this.checkpoints.get(runId) ?? [])];
  }

  async rollback(runId: string, checkpointId: string): Promise<WorkflowCheckpoint | null> {
    const checkpoint = await this.load(runId, checkpointId);
    if (!checkpoint) return null;

    const retained = (this.checkpoints.get(runId) ?? [])
      .filter((candidate) => candidate.superstep <= checkpoint.superstep)
      .sort((a, b) => a.superstep - b.superstep);
    this.checkpoints.set(runId, retained);
    return checkpoint;
  }
}
