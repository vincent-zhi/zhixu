import type { ReflectionResult } from "./types.js";

export class ReflectionEngine {
  reflect(projectSummary: {
    tasks: Array<{ status: string; riskLevel: string }>;
    artifacts: Array<{ evidenceCoverage: number }>;
  }): ReflectionResult {
    const defectAttribution = this.analyzeDefects(projectSummary);
    const knowledgeCapsuleCandidates = this.extractCapsuleCandidates(projectSummary);
    const nextTaskSuggestions = this.suggestNextTasks(projectSummary);
    const improvementAreas = this.identifyImprovements(projectSummary);

    return {
      defectAttribution,
      knowledgeCapsuleCandidates,
      nextTaskSuggestions,
      improvementAreas
    };
  }

  private analyzeDefects(
    projectSummary: {
      tasks: Array<{ status: string; riskLevel: string }>;
      artifacts: Array<{ evidenceCoverage: number }>;
    }
  ): string[] {
    const defects: string[] = [];

    const failedTasks = projectSummary.tasks.filter((t) => t.status === "failed");
    if (failedTasks.length > 0) {
      defects.push(`${failedTasks.length}个任务失败`);
    }

    const highRiskTasks = projectSummary.tasks.filter(
      (t) => t.riskLevel === "L2" || t.riskLevel === "L3"
    );
    if (highRiskTasks.length > 0) {
      defects.push(`${highRiskTasks.length}个高风险任务需要关注`);
    }

    const lowCoverageArtifacts = projectSummary.artifacts.filter(
      (a) => a.evidenceCoverage < 0.5
    );
    if (lowCoverageArtifacts.length > 0) {
      defects.push(`${lowCoverageArtifacts.length}个成果物证据覆盖率低于50%`);
    }

    if (defects.length === 0) {
      defects.push("未发现明显缺陷");
    }

    return defects;
  }

  private extractCapsuleCandidates(
    projectSummary: {
      tasks: Array<{ status: string; riskLevel: string }>;
      artifacts: Array<{ evidenceCoverage: number }>;
    }
  ): string[] {
    const candidates: string[] = [];

    const completedTasks = projectSummary.tasks.filter((t) => t.status === "completed");
    if (completedTasks.length > 0) {
      candidates.push(`项目完成${completedTasks.length}个任务的工作流模式`);
    }

    const highCoverageArtifacts = projectSummary.artifacts.filter(
      (a) => a.evidenceCoverage >= 0.8
    );
    if (highCoverageArtifacts.length > 0) {
      candidates.push("高证据覆盖率成果物的生成策略");
    }

    if (candidates.length === 0) {
      candidates.push("当前项目无可复用知识胶囊");
    }

    return candidates;
  }

  private suggestNextTasks(
    projectSummary: {
      tasks: Array<{ status: string; riskLevel: string }>;
      artifacts: Array<{ evidenceCoverage: number }>;
    }
  ): string[] {
    const suggestions: string[] = [];

    const pendingTasks = projectSummary.tasks.filter((t) => t.status === "pending" || t.status === "waiting_user");
    if (pendingTasks.length > 0) {
      suggestions.push(`完成${pendingTasks.length}个待处理任务`);
    }

    const lowCoverageArtifacts = projectSummary.artifacts.filter(
      (a) => a.evidenceCoverage < 0.7
    );
    if (lowCoverageArtifacts.length > 0) {
      suggestions.push("补充低覆盖率成果物的证据");
    }

    if (suggestions.length === 0) {
      suggestions.push("项目已完成，可考虑归档");
    }

    return suggestions;
  }

  private identifyImprovements(
    projectSummary: {
      tasks: Array<{ status: string; riskLevel: string }>;
      artifacts: Array<{ evidenceCoverage: number }>;
    }
  ): string[] {
    const improvements: string[] = [];

    const avgCoverage = projectSummary.artifacts.length > 0
      ? projectSummary.artifacts.reduce((sum, a) => sum + a.evidenceCoverage, 0) / projectSummary.artifacts.length
      : 1;

    if (avgCoverage < 0.6) {
      improvements.push("提高证据引用覆盖率");
    }

    const l3Tasks = projectSummary.tasks.filter((t) => t.riskLevel === "L3");
    if (l3Tasks.length > 0) {
      improvements.push("减少L3级别高风险任务数量");
    }

    const failedTasks = projectSummary.tasks.filter((t) => t.status === "failed");
    if (failedTasks.length > 0) {
      improvements.push("分析失败任务原因并优化流程");
    }

    if (improvements.length === 0) {
      improvements.push("当前流程表现良好，保持现有策略");
    }

    return improvements;
  }
}
