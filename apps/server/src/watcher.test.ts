import { describe, expect, it } from "vitest";
import type { ProjectDetail } from "@zhixu/core";
import { WatcherService } from "./watcher.js";
import type { ProjectStore } from "./project-store.js";

function makeProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "proj_1",
    workspaceId: "ws_1",
    ownerId: "user_1",
    title: "Test Project",
    type: "presentation",
    description: null,
    dueDate: null,
    priority: 3,
    status: "planned",
    riskLevel: "L1",
    privacyMode: "cloud",
    nextAction: "Continue",
    sources: [],
    tasks: [],
    artifacts: [],
    humanGates: [],
    agentJobs: [],
    auditLogs: [],
    ...overrides
  };
}

describe("WatcherService", () => {
  const store = {
    listProjects: async () => [],
    getProject: async () => null
  } as unknown as ProjectStore;

  const watcher = new WatcherService(store);

  it("returns no issues for a normal project", () => {
    const project = makeProject();
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual([]);
    expect(result.projectId).toBe("proj_1");
    expect(result.projectTitle).toBe("Test Project");
  });

  it("flags due_soon when dueDate is within 3 days", () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const project = makeProject({ dueDate });
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "due_soon",
          severity: "warning",
          targetId: "proj_1",
          targetType: "project"
        })
      ])
    );
  });

  it("flags overdue when dueDate is in the past", () => {
    const dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const project = makeProject({ dueDate });
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "overdue",
          severity: "critical",
          targetId: "proj_1",
          targetType: "project"
        })
      ])
    );
  });

  it("does not flag due_soon when dueDate is more than 3 days away", () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const project = makeProject({ dueDate });
    const result = watcher.checkProject(project);

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "due_soon" })
      ])
    );
  });

  it("flags stalled when project status is waiting_user", () => {
    const project = makeProject({ status: "waiting_user" });
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stalled",
          severity: "warning",
          targetId: "proj_1",
          targetType: "project"
        })
      ])
    );
  });

  it("flags missing_evidence when artifact evidenceCoverage < 0.5", () => {
    const project = makeProject({
      artifacts: [
        {
          id: "art_1",
          projectId: "proj_1",
          type: "report",
          title: "Low Evidence Report",
          status: "draft",
          exportStatus: "not_started",
          evidenceCoverage: 0.3,
          blocks: [],
          createdAt: new Date().toISOString()
        }
      ]
    });
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing_evidence",
          severity: "info",
          targetId: "art_1",
          targetType: "artifact"
        })
      ])
    );
  });

  it("does not flag missing_evidence when artifact evidenceCoverage >= 0.5", () => {
    const project = makeProject({
      artifacts: [
        {
          id: "art_2",
          projectId: "proj_1",
          type: "report",
          title: "Good Evidence Report",
          status: "draft",
          exportStatus: "not_started",
          evidenceCoverage: 0.7,
          blocks: [],
          createdAt: new Date().toISOString()
        }
      ]
    });
    const result = watcher.checkProject(project);

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "missing_evidence" })
      ])
    );
  });

  it("flags pending_human_gate when gate status is pending", () => {
    const project = makeProject({
      humanGates: [
        {
          id: "gate_1",
          projectId: "proj_1",
          gateType: "sensitive_cloud_processing",
          reason: "Needs approval",
          riskLevel: "L2",
          status: "pending",
          confirmedBy: null,
          confirmedAt: null,
          createdAt: new Date().toISOString()
        }
      ]
    });
    const result = watcher.checkProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pending_human_gate",
          severity: "warning",
          targetId: "gate_1",
          targetType: "human_gate"
        })
      ])
    );
  });

  it("does not flag confirmed human gates", () => {
    const project = makeProject({
      humanGates: [
        {
          id: "gate_2",
          projectId: "proj_1",
          gateType: "sensitive_cloud_processing",
          reason: "Needs approval",
          riskLevel: "L2",
          status: "confirmed",
          confirmedBy: "user_1",
          confirmedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]
    });
    const result = watcher.checkProject(project);

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pending_human_gate" })
      ])
    );
  });

  it("returns multiple issues when several conditions are met", () => {
    const dueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const project = makeProject({
      dueDate,
      status: "waiting_user",
      artifacts: [
        {
          id: "art_3",
          projectId: "proj_1",
          type: "report",
          title: "Low Evidence",
          status: "draft",
          exportStatus: "not_started",
          evidenceCoverage: 0.1,
          blocks: [],
          createdAt: new Date().toISOString()
        }
      ],
      humanGates: [
        {
          id: "gate_3",
          projectId: "proj_1",
          gateType: "review",
          reason: "Review needed",
          riskLevel: "L2",
          status: "pending",
          confirmedBy: null,
          confirmedAt: null,
          createdAt: new Date().toISOString()
        }
      ]
    });
    const result = watcher.checkProject(project);

    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    const types = result.issues.map((i) => i.type);
    expect(types).toContain("due_soon");
    expect(types).toContain("stalled");
    expect(types).toContain("missing_evidence");
    expect(types).toContain("pending_human_gate");
  });

  it("checkAllProjects scans all projects from the store", async () => {
    const project1 = makeProject({ id: "p1", title: "P1", status: "waiting_user" });
    const project2 = makeProject({ id: "p2", title: "P2" });

    const mockStore = {
      listProjects: async () => [
        { id: "p1", title: "P1" },
        { id: "p2", title: "P2" }
      ],
      getProject: async (id: string) => {
        if (id === "p1") return project1;
        if (id === "p2") return project2;
        return null;
      }
    } as unknown as ProjectStore;

    const svc = new WatcherService(mockStore);
    const results = await svc.checkAllProjects();

    expect(results).toHaveLength(2);
    expect(results[0]!.projectId).toBe("p1");
    expect(results[0]!.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "stalled" })
      ])
    );
    expect(results[1]!.projectId).toBe("p2");
    expect(results[1]!.issues).toEqual([]);
  });
});
