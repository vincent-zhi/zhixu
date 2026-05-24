import type { DiagnosticReport } from "./types.js";

export class DiagnosticEngine {
  generateReport(input: {
    projectId: string;
    period: { start: string; end: string };
    tasks: Array<{ status: string; dueAt: string | null; completedAt: string | null }>;
    artifacts: Array<{ evidenceCoverage: number }>;
  }): DiagnosticReport {
    const { projectId, period, tasks, artifacts } = input;

    const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "done");
    const taskCompletionRate = tasks.length > 0 ? completedTasks.length / tasks.length : 0;

    let totalDelay = 0;
    let delayedCount = 0;
    for (const task of tasks) {
      if (task.dueAt && task.completedAt) {
        const due = new Date(task.dueAt).getTime();
        const completed = new Date(task.completedAt).getTime();
        const delayDays = (completed - due) / (1000 * 60 * 60 * 24);
        if (delayDays > 0) {
          totalDelay += delayDays;
          delayedCount++;
        }
      }
    }
    const averageDelay = delayedCount > 0 ? totalDelay / delayedCount : 0;

    const riskAreas: string[] = [];
    const strengthAreas: string[] = [];

    if (taskCompletionRate < 0.5) {
      riskAreas.push("Low task completion rate");
    } else if (taskCompletionRate >= 0.8) {
      strengthAreas.push("High task completion rate");
    }

    if (averageDelay > 3) {
      riskAreas.push("Significant average task delay");
    } else if (averageDelay <= 1) {
      strengthAreas.push("Timely task completion");
    }

    const avgEvidenceCoverage = artifacts.length > 0
      ? artifacts.reduce((sum, a) => sum + a.evidenceCoverage, 0) / artifacts.length
      : 0;

    if (avgEvidenceCoverage < 0.5) {
      riskAreas.push("Low evidence coverage in artifacts");
    } else if (avgEvidenceCoverage >= 0.7) {
      strengthAreas.push("Strong evidence coverage");
    }

    const recommendations: string[] = [];
    if (taskCompletionRate < 0.7) {
      recommendations.push("Focus on completing pending tasks before starting new ones");
    }
    if (averageDelay > 2) {
      recommendations.push("Review task estimation and deadline setting practices");
    }
    if (avgEvidenceCoverage < 0.6) {
      recommendations.push("Improve evidence documentation for artifacts");
    }
    if (recommendations.length === 0) {
      recommendations.push("Continue current pace and maintain quality standards");
    }

    const knowledgeRetention = taskCompletionRate * 0.5 + avgEvidenceCoverage * 0.5;

    return {
      id: crypto.randomUUID(),
      projectId,
      period,
      taskCompletionRate,
      averageDelay,
      riskAreas,
      strengthAreas,
      recommendations,
      knowledgeRetention,
    };
  }
}
