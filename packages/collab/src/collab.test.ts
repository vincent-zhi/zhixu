import { describe, expect, it } from "vitest";
import { ProjectSharingManager } from "./project-sharing.js";
import { SharedKnowledgebaseManager } from "./knowledgebase.js";
import { ProgressBoardManager } from "./progress-board.js";
import { ContributionTracker } from "./contribution-tracker.js";
import type { SharedKnowledgebase } from "./types.js";

describe("ProjectSharingManager", () => {
  const manager = new ProjectSharingManager();

  it("creates a project share", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2", "user-3"],
    });
    expect(share.id).toBeTruthy();
    expect(share.projectId).toBe("p1");
    expect(share.sharedBy).toBe("user-1");
    expect(share.shareType).toBe("read_only");
    expect(share.recipientIds).toEqual(["user-2", "user-3"]);
    expect(share.expiresAt).toBeNull();
  });

  it("creates a share with expiration", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "edit",
      recipientIds: ["user-2"],
      expiresAt: "2099-12-31",
    });
    expect(share.expiresAt).toBe("2099-12-31");
  });

  it("checks access for valid recipient", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "comment",
      recipientIds: ["user-2"],
    });
    expect(manager.checkAccess(share.id, "user-2")).toBe(true);
  });

  it("denies access for non-recipient", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    expect(manager.checkAccess(share.id, "user-3")).toBe(false);
  });

  it("denies access for expired share", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
      expiresAt: "2020-01-01",
    });
    expect(manager.checkAccess(share.id, "user-2")).toBe(false);
  });

  it("revokes a share", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    expect(manager.revokeShare(share.id)).toBe(true);
    expect(manager.checkAccess(share.id, "user-2")).toBe(false);
  });

  it("returns false for revoking non-existent share", () => {
    expect(manager.revokeShare("nonexistent")).toBe(false);
  });

  it("getShare retrieves a share by id", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    const found = manager.getShare(share.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(share.id);
  });

  it("getShare returns undefined for non-existent id", () => {
    expect(manager.getShare("nonexistent")).toBeUndefined();
  });

  it("listSharesByProject returns shares for a given project", () => {
    const s1 = manager.createShare({
      projectId: "p-list",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    manager.createShare({
      projectId: "other-project",
      sharedBy: "user-1",
      shareType: "edit",
      recipientIds: ["user-3"],
    });
    const results = manager.listSharesByProject("p-list");
    expect(results.some((s) => s.id === s1.id)).toBe(true);
    expect(results.every((s) => s.projectId === "p-list")).toBe(true);
  });

  it("listSharesByUser returns shares where user is recipient or sharer", () => {
    const s1 = manager.createShare({
      projectId: "p-user",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    const results = manager.listSharesByUser("user-2");
    expect(results.some((s) => s.id === s1.id)).toBe(true);
  });

  it("listSharesByUser includes shares created by the user", () => {
    const s1 = manager.createShare({
      projectId: "p-owner",
      sharedBy: "owner-1",
      shareType: "edit",
      recipientIds: ["user-2"],
    });
    const results = manager.listSharesByUser("owner-1");
    expect(results.some((s) => s.id === s1.id)).toBe(true);
  });

  it("checkAccess grants access to the share creator", () => {
    const share = manager.createShare({
      projectId: "p1",
      sharedBy: "creator-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    expect(manager.checkAccess(share.id, "creator-1")).toBe(true);
  });

  it("checkProjectAccess returns the share when user has valid access", () => {
    const share = manager.createShare({
      projectId: "p-check",
      sharedBy: "user-1",
      shareType: "comment",
      recipientIds: ["user-2"],
    });
    const result = manager.checkProjectAccess("p-check", "user-2");
    expect(result).toBeDefined();
    expect(result!.id).toBe(share.id);
  });

  it("checkProjectAccess returns undefined for expired shares", () => {
    manager.createShare({
      projectId: "p-expired",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
      expiresAt: "2020-01-01",
    });
    expect(manager.checkProjectAccess("p-expired", "user-2")).toBeUndefined();
  });

  it("checkProjectAccess returns undefined when user has no access", () => {
    manager.createShare({
      projectId: "p-no-access",
      sharedBy: "user-1",
      shareType: "read_only",
      recipientIds: ["user-2"],
    });
    expect(manager.checkProjectAccess("p-no-access", "user-99")).toBeUndefined();
  });
});

describe("SharedKnowledgebaseManager", () => {
  const kbManager = new SharedKnowledgebaseManager();

  it("creates a knowledgebase", () => {
    const kb = kbManager.createKnowledgebase({
      workspaceId: "ws-1",
      name: "Lab Knowledge",
      accessPolicy: "lab_only",
    });
    expect(kb.id).toBeTruthy();
    expect(kb.workspaceId).toBe("ws-1");
    expect(kb.name).toBe("Lab Knowledge");
    expect(kb.accessPolicy).toBe("lab_only");
    expect(kb.entries).toEqual([]);
  });

  it("adds an entry", () => {
    const kb = kbManager.createKnowledgebase({
      workspaceId: "ws-1",
      name: "Test KB",
      accessPolicy: "team_only",
    });
    const entry = kbManager.addEntry(kb, {
      title: "Machine Learning Basics",
      content: "ML is a subset of AI that learns from data",
      category: "AI",
      contributedBy: "user-1",
      sensitive: false,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.title).toBe("Machine Learning Basics");
    expect(entry.createdAt).toBeTruthy();
    expect(kb.entries).toHaveLength(1);
  });

  it("searches entries by keyword", () => {
    const kb = kbManager.createKnowledgebase({
      workspaceId: "ws-1",
      name: "Test KB",
      accessPolicy: "public",
    });
    kbManager.addEntry(kb, {
      title: "Machine Learning Basics",
      content: "ML is a subset of AI",
      category: "AI",
      contributedBy: "user-1",
      sensitive: false,
    });
    kbManager.addEntry(kb, {
      title: "Data Structures",
      content: "Arrays and linked lists",
      category: "CS",
      contributedBy: "user-2",
      sensitive: false,
    });

    const results = kbManager.searchEntries(kb, "machine learning");
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Machine Learning Basics");
  });

  it("searches with multiple terms (AND logic)", () => {
    const kb = kbManager.createKnowledgebase({
      workspaceId: "ws-1",
      name: "Test KB",
      accessPolicy: "public",
    });
    kbManager.addEntry(kb, {
      title: "Machine Learning in Healthcare",
      content: "Applications of ML in medical diagnosis",
      category: "AI",
      contributedBy: "user-1",
      sensitive: false,
    });
    kbManager.addEntry(kb, {
      title: "Machine Learning Basics",
      content: "Introduction to ML algorithms",
      category: "AI",
      contributedBy: "user-2",
      sensitive: false,
    });

    const results = kbManager.searchEntries(kb, "machine healthcare");
    expect(results).toHaveLength(1);
  });

  it("filters out sensitive entries", () => {
    const kb = kbManager.createKnowledgebase({
      workspaceId: "ws-1",
      name: "Test KB",
      accessPolicy: "lab_only",
    });
    kbManager.addEntry(kb, {
      title: "Public Finding",
      content: "Published result",
      category: "Research",
      contributedBy: "user-1",
      sensitive: false,
    });
    kbManager.addEntry(kb, {
      title: "Internal Data",
      content: "Unpublished data",
      category: "Research",
      contributedBy: "user-1",
      sensitive: true,
    });

    const filtered = kbManager.filterSensitive(kb);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Public Finding");
  });
});

describe("ProgressBoardManager", () => {
  const boardManager = new ProgressBoardManager();

  it("creates a board with default columns", () => {
    const board = boardManager.createBoard("p1");
    expect(board.id).toBeTruthy();
    expect(board.projectId).toBe("p1");
    expect(board.columns).toHaveLength(4);
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "In Progress", "Review", "Done"]);
  });

  it("moves a task between columns", () => {
    const board = boardManager.createBoard("p1");
    const taskId = "task-1";
    board.columns[0]!.taskIds.push(taskId);

    const inProgressCol = board.columns[1]!;
    const updated = boardManager.moveTask(board, taskId, inProgressCol.id);

    expect(updated.columns[0]!.taskIds).not.toContain(taskId);
    expect(updated.columns[1]!.taskIds).toContain(taskId);
  });

  it("adds a new column", () => {
    const board = boardManager.createBoard("p1");
    const column = boardManager.addColumn(board, "Blocked");

    expect(column.title).toBe("Blocked");
    expect(column.orderIndex).toBe(4);
    expect(board.columns).toHaveLength(5);
  });

  it("updates lastUpdated on modifications", () => {
    const board = boardManager.createBoard("p1");

    board.columns[0]!.taskIds.push("task-1");
    boardManager.moveTask(board, "task-1", board.columns[1]!.id);

    expect(board.lastUpdated).toBeTruthy();
    expect(typeof board.lastUpdated).toBe("string");
  });
});

describe("ContributionTracker", () => {
  const tracker = new ContributionTracker();

  it("generates a contribution report", () => {
    const report = tracker.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      members: [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
      activities: [
        { memberId: "u1", type: "task_completed", hoursSpent: 5 },
        { memberId: "u1", type: "artifact_created", hoursSpent: 3 },
        { memberId: "u2", type: "task_completed", hoursSpent: 4 },
        { memberId: "u2", type: "block_edited", hoursSpent: 2 },
      ],
    });

    expect(report.id).toBeTruthy();
    expect(report.projectId).toBe("p1");
    expect(report.members).toHaveLength(2);
  });

  it("calculates contribution percentages", () => {
    const report = tracker.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      members: [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
      activities: [
        { memberId: "u1", type: "task_completed", hoursSpent: 5 },
        { memberId: "u1", type: "task_completed", hoursSpent: 3 },
        { memberId: "u1", type: "artifact_created", hoursSpent: 2 },
        { memberId: "u2", type: "task_completed", hoursSpent: 4 },
      ],
    });

    const alice = report.members.find((m) => m.memberId === "u1")!;
    const bob = report.members.find((m) => m.memberId === "u2")!;

    expect(alice.contributionPercent).toBe(75);
    expect(bob.contributionPercent).toBe(25);
  });

  it("counts tasks and artifacts correctly", () => {
    const report = tracker.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      members: [{ id: "u1", name: "Alice" }],
      activities: [
        { memberId: "u1", type: "task_completed", hoursSpent: 5 },
        { memberId: "u1", type: "task_completed", hoursSpent: 3 },
        { memberId: "u1", type: "artifact_created", hoursSpent: 2 },
        { memberId: "u1", type: "block_edited", hoursSpent: 1 },
      ],
    });

    const alice = report.members[0]!;
    expect(alice.tasksCompleted).toBe(2);
    expect(alice.artifactsContributed).toBe(1);
    expect(alice.blocksEdited).toBe(1);
    expect(alice.hoursEstimated).toBe(11);
  });

  it("generates summary with top contributor", () => {
    const report = tracker.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      members: [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
      activities: [
        { memberId: "u1", type: "task_completed", hoursSpent: 8 },
        { memberId: "u2", type: "task_completed", hoursSpent: 2 },
      ],
    });

    expect(report.summary).toContain("Alice");
    expect(report.summary).toContain("Top contributor");
  });

  it("handles members with no activities", () => {
    const report = tracker.generateReport({
      projectId: "p1",
      period: { start: "2025-01-01", end: "2025-01-31" },
      members: [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
      activities: [
        { memberId: "u1", type: "task_completed", hoursSpent: 5 },
      ],
    });

    const bob = report.members.find((m) => m.memberId === "u2")!;
    expect(bob.contributionPercent).toBe(0);
    expect(bob.tasksCompleted).toBe(0);
  });
});
