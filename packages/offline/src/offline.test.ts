import { describe, expect, it } from "vitest";
import { OfflineCacheManager } from "./offline-cache.js";
import { OperationQueue } from "./operation-queue.js";
import { ConflictResolver } from "./conflict-resolver.js";
import { SyncEngine } from "./sync-engine.js";
import type { OfflineCacheEntry, PendingOperation } from "./types.js";

describe("OfflineCacheManager", () => {
  it("sets and gets a cache entry", async () => {
    const cache = new OfflineCacheManager();
    const entry = await cache.set("user:1", { name: "Alice" });

    expect(entry.key).toBe("user:1");
    expect(entry.version).toBe(1);
    expect(entry.encrypted).toBe(false);

    const retrieved = await cache.get("user:1");
    expect(retrieved).not.toBeNull();
    expect((retrieved!.data as Record<string, string>).name).toBe("Alice");
  });

  it("returns null for missing key", async () => {
    const cache = new OfflineCacheManager();
    expect(await cache.get("missing")).toBeNull();
  });

  it("increments version on subsequent sets", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("key", "v1");
    const entry = await cache.set("key", "v2");
    expect(entry.version).toBe(2);
  });

  it("deletes a cache entry", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("key", "data");
    expect(await cache.delete("key")).toBe(true);
    expect(await cache.get("key")).toBeNull();
    expect(await cache.delete("key")).toBe(false);
  });

  it("lists all keys", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.set("c", 3);
    expect(cache.listKeys().sort()).toEqual(["a", "b", "c"]);
  });

  it("cleans up expired entries", async () => {
    const cache = new OfflineCacheManager();
    const past = new Date(Date.now() - 10000).toISOString();
    await cache.set("expired", "old", { expiresAt: past });
    await cache.set("valid", "new", { expiresAt: new Date(Date.now() + 100000).toISOString() });

    const removed = cache.cleanup();
    expect(removed).toBe(1);
    expect(await cache.get("expired")).toBeNull();
    expect(await cache.get("valid")).not.toBeNull();
  });

  it("exports all entries", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("a", 1);
    await cache.set("b", 2);
    const exported = cache.exportAll();
    expect(exported).toHaveLength(2);
  });

  it("imports entries keeping newer versions", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("key", "local", { encrypted: false });

    const remoteEntry: OfflineCacheEntry = {
      key: "key",
      data: "remote",
      version: 999,
      deviceId: "other-device",
      updatedAt: new Date().toISOString(),
      expiresAt: null,
      encrypted: false,
    };

    const imported = cache.importAll([remoteEntry]);
    expect(imported).toBe(1);
    expect((await cache.get("key"))!.data as string).toBe("remote");
  });

  it("skips importing older versions", async () => {
    const cache = new OfflineCacheManager();
    await cache.set("key", "local");
    const localEntry = (await cache.get("key"))!;

    const olderEntry: OfflineCacheEntry = {
      key: "key",
      data: "old",
      version: 0,
      deviceId: "other",
      updatedAt: "2020-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };

    const imported = cache.importAll([olderEntry]);
    expect(imported).toBe(0);
    expect((await cache.get("key"))!.version).toBe(localEntry.version);
  });
});

describe("OperationQueue", () => {
  it("enqueues and dequeues operations", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: { title: "Test" },
      deviceId: "device-1",
      timestamp: new Date().toISOString(),
    });

    expect(op.id).toBeTruthy();
    expect(op.status).toBe("pending");
    expect(op.retryCount).toBe(0);

    const dequeued = queue.dequeue();
    expect(dequeued).not.toBeNull();
    expect(dequeued!.id).toBe(op.id);
    expect(dequeued!.status).toBe("syncing");
  });

  it("peeks without removing", () => {
    const queue = new OperationQueue();
    queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    const peeked = queue.peek();
    expect(peeked).not.toBeNull();
    expect(queue.getPending()).toHaveLength(1);
  });

  it("marks operations as applied", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    expect(queue.markApplied(op.id)).toBe(true);
    expect(queue.getPending()).toHaveLength(0);
  });

  it("marks operations as failed", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    expect(queue.markFailed(op.id)).toBe(true);
    expect(queue.getPending()).toHaveLength(0);
  });

  it("marks operations as conflicted", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    expect(queue.markConflicted(op.id)).toBe(true);
    expect(queue.getConflicted()).toHaveLength(1);
  });

  it("retries failed operations", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    queue.markFailed(op.id);
    const retried = queue.retry(op.id);
    expect(retried).not.toBeNull();
    expect(retried!.status).toBe("pending");
    expect(retried!.retryCount).toBe(1);
  });

  it("does not retry non-failed operations", () => {
    const queue = new OperationQueue();
    const op = queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    expect(queue.retry(op.id)).toBeNull();
  });

  it("clears all operations", () => {
    const queue = new OperationQueue();
    queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });
    queue.enqueue({
      entityType: "note",
      entityId: "2",
      operationType: "update",
      payload: {},
      deviceId: "d1",
      timestamp: new Date().toISOString(),
    });

    queue.clear();
    expect(queue.getPending()).toHaveLength(0);
  });

  it("sorts operations by timestamp", () => {
    const queue = new OperationQueue();
    queue.enqueue({
      entityType: "note",
      entityId: "2",
      operationType: "update",
      payload: {},
      deviceId: "d1",
      timestamp: "2024-01-02T00:00:00Z",
    });
    queue.enqueue({
      entityType: "note",
      entityId: "1",
      operationType: "create",
      payload: {},
      deviceId: "d1",
      timestamp: "2024-01-01T00:00:00Z",
    });

    const pending = queue.getPending();
    expect(pending[0]!.entityId).toBe("1");
    expect(pending[1]!.entityId).toBe("2");
  });
});

describe("ConflictResolver", () => {
  const resolver = new ConflictResolver();

  it("detects conflict between entries from different devices", () => {
    const local: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Local" },
      version: 2,
      deviceId: "device-a",
      updatedAt: "2024-01-01T12:00:00Z",
      expiresAt: null,
      encrypted: false,
    };
    const remote: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Remote" },
      version: 3,
      deviceId: "device-b",
      updatedAt: "2024-01-01T12:01:00Z",
      expiresAt: null,
      encrypted: false,
    };

    const conflict = resolver.detectConflict(local, remote);
    expect(conflict).not.toBeNull();
    expect(conflict!.resolution).toBe("unresolved");
    expect(conflict!.localVersion.deviceId).toBe("device-a");
    expect(conflict!.remoteVersion.deviceId).toBe("device-b");
  });

  it("returns null for same device entries", () => {
    const local: OfflineCacheEntry = {
      key: "note:1",
      data: {},
      version: 1,
      deviceId: "device-a",
      updatedAt: "2024-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };
    const remote: OfflineCacheEntry = {
      key: "note:1",
      data: {},
      version: 2,
      deviceId: "device-a",
      updatedAt: "2024-01-01T01:00:00Z",
      expiresAt: null,
      encrypted: false,
    };

    expect(resolver.detectConflict(local, remote)).toBeNull();
  });

  it("returns null for different keys", () => {
    const local: OfflineCacheEntry = {
      key: "note:1",
      data: {},
      version: 1,
      deviceId: "device-a",
      updatedAt: "2024-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };
    const remote: OfflineCacheEntry = {
      key: "note:2",
      data: {},
      version: 1,
      deviceId: "device-b",
      updatedAt: "2024-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };

    expect(resolver.detectConflict(local, remote)).toBeNull();
  });

  it("resolves conflict with local_wins strategy", () => {
    const local: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Local" },
      version: 2,
      deviceId: "device-a",
      updatedAt: "2024-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };
    const remote: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Remote" },
      version: 3,
      deviceId: "device-b",
      updatedAt: "2024-01-01T01:00:00Z",
      expiresAt: null,
      encrypted: false,
    };

    const conflict = resolver.detectConflict(local, remote)!;
    const resolved = resolver.resolveConflict(conflict, "local_wins");
    expect(resolved.resolution).toBe("local_wins");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("resolves conflict with merge strategy", () => {
    const local: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Local" },
      version: 2,
      deviceId: "device-a",
      updatedAt: "2024-01-01T00:00:00Z",
      expiresAt: null,
      encrypted: false,
    };
    const remote: OfflineCacheEntry = {
      key: "note:1",
      data: { title: "Remote" },
      version: 3,
      deviceId: "device-b",
      updatedAt: "2024-01-01T01:00:00Z",
      expiresAt: null,
      encrypted: false,
    };

    const conflict = resolver.detectConflict(local, remote)!;
    const resolved = resolver.resolveConflict(conflict, "merge");
    expect(resolved.resolution).toBe("merged");
  });

  it("auto-merges preferring remote for same keys", () => {
    const merged = resolver.autoMerge(
      { title: "Local", extra: "local-only" },
      { title: "Remote", other: "remote-only" },
    );
    expect(merged.title).toBe("Remote");
    expect(merged.extra).toBe("local-only");
    expect(merged.other).toBe("remote-only");
  });
});

describe("SyncEngine", () => {
  it("syncs operations to local cache", async () => {
    const engine = new SyncEngine();
    const cache = new OfflineCacheManager();
    const operations: PendingOperation[] = [
      {
        id: "op-1",
        entityType: "note",
        entityId: "1",
        operationType: "create",
        payload: { title: "Note 1" },
        deviceId: "d1",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: "pending",
      },
      {
        id: "op-2",
        entityType: "note",
        entityId: "2",
        operationType: "create",
        payload: { title: "Note 2" },
        deviceId: "d1",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: "pending",
      },
    ];

    const result = await engine.syncToLocal(operations, cache);
    expect(result.applied).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.totalOperations).toBe(2);
    expect(await cache.get("note:1")).not.toBeNull();
    expect(await cache.get("note:2")).not.toBeNull();
  });

  it("handles delete operations in syncToLocal", async () => {
    const engine = new SyncEngine();
    const cache = new OfflineCacheManager();
    await cache.set("note:1", { title: "To Delete" });

    const operations: PendingOperation[] = [
      {
        id: "op-1",
        entityType: "note",
        entityId: "1",
        operationType: "delete",
        payload: {},
        deviceId: "d1",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: "pending",
      },
    ];

    const result = await engine.syncToLocal(operations, cache);
    expect(result.applied).toBe(1);
    expect(await cache.get("note:1")).toBeNull();
  });

  it("syncs remote entries to local cache", async () => {
    const engine = new SyncEngine();
    const cache = new OfflineCacheManager();

    const remoteEntries: OfflineCacheEntry[] = [
      {
        key: "note:1",
        data: { title: "Remote Note" },
        version: 1,
        deviceId: "device-remote",
        updatedAt: new Date().toISOString(),
        expiresAt: null,
        encrypted: false,
      },
    ];

    const result = await engine.syncToRemote(cache, remoteEntries);
    expect(result.applied).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(await cache.get("note:1")).not.toBeNull();
  });

  it("detects conflicts during syncToRemote", async () => {
    const engine = new SyncEngine();
    const cache = new OfflineCacheManager();
    await cache.set("note:1", { title: "Local" });

    const remoteEntries: OfflineCacheEntry[] = [
      {
        key: "note:1",
        data: { title: "Remote" },
        version: 5,
        deviceId: "device-remote",
        updatedAt: new Date().toISOString(),
        expiresAt: null,
        encrypted: false,
      },
    ];

    const result = await engine.syncToRemote(cache, remoteEntries);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.applied).toBe(1);
  });
});
