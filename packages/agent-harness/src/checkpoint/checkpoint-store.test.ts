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

  it("can roll back history to a named checkpoint", async () => {
    const store = new InMemoryCheckpointStore();
    await store.save({ runId: "run-1", traceId: "trace-1", checkpointId: "cp-1", superstep: 1, state: { step: 1 }, createdAt: "2026-06-01T00:00:00.000Z" });
    await store.save({ runId: "run-1", traceId: "trace-1", checkpointId: "cp-2", superstep: 2, state: { step: 2 }, createdAt: "2026-06-01T00:00:01.000Z" });

    const checkpoint = await store.rollback("run-1", "cp-1");
    const history = await store.list("run-1");

    expect(checkpoint?.checkpointId).toBe("cp-1");
    expect(history.map((cp) => cp.checkpointId)).toEqual(["cp-1"]);
  });

  it("stores trace id with checkpoints created by the executor", async () => {
    const store = new InMemoryCheckpointStore();
    await store.save({ runId: "run-1", traceId: "trace-1", checkpointId: "cp-1", superstep: 1, state: {}, createdAt: "2026-06-01T00:00:00.000Z" });

    expect((await store.loadLatest("run-1"))?.traceId).toBe("trace-1");
  });

  it("returns null for unknown run", async () => {
    const store = new InMemoryCheckpointStore();
    const latest = await store.loadLatest("unknown");
    expect(latest).toBeNull();
  });

  it("returns empty list for unknown run", async () => {
    const store = new InMemoryCheckpointStore();
    const history = await store.list("unknown");
    expect(history).toEqual([]);
  });

  it("isolates checkpoints across different runs", async () => {
    const store = new InMemoryCheckpointStore();
    await store.save({ runId: "run-a", checkpointId: "cp-a1", superstep: 1, state: { a: 1 }, createdAt: "2026-06-01T00:00:00.000Z" });
    await store.save({ runId: "run-b", checkpointId: "cp-b1", superstep: 1, state: { b: 1 }, createdAt: "2026-06-01T00:00:00.000Z" });

    const latestA = await store.loadLatest("run-a");
    const latestB = await store.loadLatest("run-b");
    expect(latestA?.checkpointId).toBe("cp-a1");
    expect(latestB?.checkpointId).toBe("cp-b1");
  });
});
