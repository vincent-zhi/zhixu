import { describe, expect, it } from "vitest";
import { AgentSessionCheckpointStore } from "./agent-session-checkpoint.js";
import type { WorkflowCheckpoint } from "../types.js";

describe("AgentSessionCheckpointStore", () => {
  it("persists checkpoints through injected AgentSession operations", async () => {
    const persisted: WorkflowCheckpoint[] = [];
    const store = new AgentSessionCheckpointStore({
      async save(checkpoint) {
        persisted.push(checkpoint);
      },
      async list(runId) {
        return persisted.filter((checkpoint) => checkpoint.runId === runId);
      }
    });

    await store.save({
      runId: "session-1",
      checkpointId: "cp-1",
      superstep: 1,
      state: { values: { brief: true } },
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(persisted).toHaveLength(1);
    expect(await store.loadLatest("session-1")).toEqual(expect.objectContaining({
      checkpointId: "cp-1",
      state: { values: { brief: true } }
    }));
  });
});
