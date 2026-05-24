import type { ProjectDetail } from "@zhixu/core";
import type { ProjectStore } from "./project-store.js";

export interface WatcherIssue {
  type: "due_soon" | "stalled" | "missing_evidence" | "pending_human_gate" | "overdue";
  severity: "info" | "warning" | "critical";
  message: string;
  targetId: string;
  targetType: "project" | "task" | "artifact" | "human_gate";
}

export interface WatcherCheckResult {
  projectId: string;
  projectTitle: string;
  issues: WatcherIssue[];
}

const DUE_SOON_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export class WatcherService {
  constructor(private readonly projectStore: ProjectStore) {}

  checkProject(project: ProjectDetail): WatcherCheckResult {
    const issues: WatcherIssue[] = [];
    const now = Date.now();

    if (project.dueDate) {
      const dueMs = new Date(project.dueDate).getTime();
      if (dueMs < now) {
        issues.push({
          type: "overdue",
          severity: "critical",
          message: `Project "${project.title}" is past its due date`,
          targetId: project.id,
          targetType: "project"
        });
      } else if (dueMs - now < DUE_SOON_THRESHOLD_MS) {
        issues.push({
          type: "due_soon",
          severity: "warning",
          message: `Project "${project.title}" is due within 3 days`,
          targetId: project.id,
          targetType: "project"
        });
      }
    }

    if (project.status === "waiting_user") {
      issues.push({
        type: "stalled",
        severity: "warning",
        message: `Project "${project.title}" is waiting for user action`,
        targetId: project.id,
        targetType: "project"
      });
    }

    for (const artifact of project.artifacts) {
      if (artifact.evidenceCoverage < 0.5) {
        issues.push({
          type: "missing_evidence",
          severity: "info",
          message: `Artifact "${artifact.title}" has low evidence coverage (${(artifact.evidenceCoverage * 100).toFixed(0)}%)`,
          targetId: artifact.id,
          targetType: "artifact"
        });
      }
    }

    for (const gate of project.humanGates) {
      if (gate.status === "pending") {
        issues.push({
          type: "pending_human_gate",
          severity: "warning",
          message: `Human gate "${gate.gateType}" is pending confirmation`,
          targetId: gate.id,
          targetType: "human_gate"
        });
      }
    }

    return {
      projectId: project.id,
      projectTitle: project.title,
      issues
    };
  }

  async checkAllProjects(): Promise<WatcherCheckResult[]> {
    const summaries = await this.projectStore.listProjects();
    const results: WatcherCheckResult[] = [];

    for (const summary of summaries) {
      const project = await this.projectStore.getProject(summary.id);
      if (project) {
        results.push(this.checkProject(project));
      }
    }

    return results;
  }
}
