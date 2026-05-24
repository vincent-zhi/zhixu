import { describe, expect, it } from "vitest";
import { VersionManager } from "./version-manager.js";

describe("VersionManager", () => {
  it("creates a snapshot with a generated versionId", () => {
    const manager = new VersionManager();
    const snapshot = manager.createSnapshot(
      "artifact",
      "art1",
      "proj1",
      { title: "Hello" },
      "user1"
    );
    expect(snapshot.versionId).toBeTruthy();
    expect(snapshot.entityType).toBe("artifact");
    expect(snapshot.entityId).toBe("art1");
    expect(snapshot.projectId).toBe("proj1");
    expect(snapshot.snapshotJson).toEqual({ title: "Hello" });
    expect(snapshot.createdBy).toBe("user1");
    expect(snapshot.createdReason).toBe("");
    expect(snapshot.diffFromPrevious).toBeNull();
  });

  it("creates a snapshot with a reason", () => {
    const manager = new VersionManager();
    const snapshot = manager.createSnapshot(
      "artifact",
      "art1",
      "proj1",
      { title: "Hello" },
      "user1",
      "initial draft"
    );
    expect(snapshot.createdReason).toBe("initial draft");
  });

  it("computes diffFromPrevious on second snapshot", () => {
    const manager = new VersionManager();
    manager.createSnapshot("artifact", "art1", "proj1", { title: "v1" }, "user1");
    const snapshot2 = manager.createSnapshot("artifact", "art1", "proj1", { title: "v2" }, "user1");
    expect(snapshot2.diffFromPrevious).not.toBeNull();
  });

  it("returns version history", () => {
    const manager = new VersionManager();
    manager.createSnapshot("artifact", "art1", "proj1", { title: "v1" }, "user1");
    manager.createSnapshot("artifact", "art1", "proj1", { title: "v2" }, "user1");
    const history = manager.getVersionHistory("artifact", "art1");
    expect(history.length).toBe(2);
  });

  it("returns empty history for unknown entity", () => {
    const manager = new VersionManager();
    const history = manager.getVersionHistory("artifact", "unknown");
    expect(history).toEqual([]);
  });

  it("diffs two versions detecting added and removed blocks", () => {
    const manager = new VersionManager();
    const from = manager.createSnapshot("artifact", "art1", "proj1", {
      blocks: [
        { id: "b1", content: "hello" },
        { id: "b2", content: "world" }
      ]
    }, "user1");

    const to = manager.createSnapshot("artifact", "art1", "proj1", {
      blocks: [
        { id: "b1", content: "hello" },
        { id: "b3", content: "new" }
      ]
    }, "user1");

    const diff = manager.diffVersions(from, to);
    expect(diff.fromVersionId).toBe(from.versionId);
    expect(diff.toVersionId).toBe(to.versionId);
    expect(diff.summary.removed).toBe(1);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.unchanged).toBe(1);
  });

  it("diffs two versions detecting modified blocks", () => {
    const manager = new VersionManager();
    const from = manager.createSnapshot("artifact", "art1", "proj1", {
      blocks: [
        { id: "b1", content: "old text" }
      ]
    }, "user1");

    const to = manager.createSnapshot("artifact", "art1", "proj1", {
      blocks: [
        { id: "b1", content: "new text" }
      ]
    }, "user1");

    const diff = manager.diffVersions(from, to);
    expect(diff.summary.modified).toBe(1);
    expect(diff.summary.unchanged).toBe(0);

    const modifiedBlock = diff.blockDiffs.find((b) => b.blockId === "b1");
    expect(modifiedBlock).toBeDefined();
    expect(modifiedBlock!.changes.length).toBe(1);
    expect(modifiedBlock!.changes[0].field).toBe("content");
    expect(modifiedBlock!.changes[0].oldValue).toBe("old text");
    expect(modifiedBlock!.changes[0].newValue).toBe("new text");
  });

  it("diffs flat data when no blocks array present", () => {
    const manager = new VersionManager();
    const from = manager.createSnapshot("artifact", "art1", "proj1", { title: "v1" }, "user1");
    const to = manager.createSnapshot("artifact", "art1", "proj1", { title: "v2" }, "user1");
    const diff = manager.diffVersions(from, to);
    expect(diff.summary.modified).toBe(1);
  });

  it("rolls back to a target version", () => {
    const manager = new VersionManager();
    const v1 = manager.createSnapshot("artifact", "art1", "proj1", { title: "v1" }, "user1");
    manager.createSnapshot("artifact", "art1", "proj1", { title: "v2" }, "user1");
    const data = manager.rollbackToVersion(v1);
    expect(data).toEqual({ title: "v1" });
  });

  it("isolates history per entity", () => {
    const manager = new VersionManager();
    manager.createSnapshot("artifact", "art1", "proj1", { title: "a1" }, "user1");
    manager.createSnapshot("artifact", "art2", "proj1", { title: "a2" }, "user1");
    expect(manager.getVersionHistory("artifact", "art1").length).toBe(1);
    expect(manager.getVersionHistory("artifact", "art2").length).toBe(1);
  });
});
