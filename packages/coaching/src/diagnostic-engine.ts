import type { DiagnosticReport, LLMCallable } from "./types.js";

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

  async generateInsightReport(input: {
    tasks: Array<{ title: string; status: string; dueAt?: string; completedAt?: string }>;
    sourceCount: number;
    evidenceCoverage: number;
    llm: LLMCallable;
  }): Promise<{ completionRate: number; averageDelayDays: number; riskAreas: string[]; strengths: string[]; aiInsights: string[]; retentionScore: number }> {
    const basicTasks = input.tasks.map(t => ({
      id: crypto.randomUUID(),
      projectId: "",
      title: t.title,
      status: t.status,
      assigneeType: "user" as const,
      responsibilityLabel: "user_responsible" as const,
      priority: 1,
      riskLevel: "L0" as const,
      ...(t.dueAt ? { dueAt: t.dueAt } : {}),
      ...(t.completedAt ? { completedAt: t.completedAt } : {}),
    }));
    const basicReport = this.generateReport({
      projectId: "",
      period: { start: "", end: "" },
      tasks: basicTasks.map(t => ({
        status: t.status,
        dueAt: t.dueAt ?? null,
        completedAt: t.completedAt ?? null,
      })),
      artifacts: [{ evidenceCoverage: input.evidenceCoverage }],
    });

    try {
      const result = await input.llm.chat({
        system: `你是一位学业导师。根据学生的任务完成数据，给出 3-5 条具体可行的改进建议。
返回 JSON：{"insights": ["..."]}`,
        messages: [{ role: "user", content: `完成率：${(basicReport.taskCompletionRate * 100).toFixed(0)}%\n平均延迟：${basicReport.averageDelay.toFixed(1)} 天\n风险领域：${basicReport.riskAreas.join("、")}\n优势领域：${basicReport.strengthAreas.join("、")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return {
        completionRate: basicReport.taskCompletionRate,
        averageDelayDays: basicReport.averageDelay,
        riskAreas: basicReport.riskAreas,
        strengths: basicReport.strengthAreas,
        aiInsights: parsed.insights ?? [],
        retentionScore: basicReport.knowledgeRetention,
      };
    } catch {
      return {
        completionRate: basicReport.taskCompletionRate,
        averageDelayDays: basicReport.averageDelay,
        riskAreas: basicReport.riskAreas,
        strengths: basicReport.strengthAreas,
        aiInsights: [],
        retentionScore: basicReport.knowledgeRetention,
      };
    }
  }
}
