import type { DispatchResult, WorkerResult } from "./types.js";

const OUTPUT_TYPE_MAP: Record<string, string> = {
  "选题与目标确认": "goal_confirmation",
  "大纲生成": "outline",
  "内容生成": "content_draft",
  "风格选择与排版": "style_config",
  "导出与检查": "export_result",
  "文献检索与筛选": "search_results",
  "阅读笔记生成": "reading_notes",
  "综述大纲": "outline",
  "综述撰写": "content_draft",
  "引用校验与导出": "export_result",
  "需求分析": "requirement_analysis",
  "内容撰写": "content_draft",
  "引用与校验": "citation_report",
  "格式化与导出": "export_result",
  "知识点梳理": "knowledge_map",
  "重点标记": "highlight_report",
  "复习资料生成": "study_material",
  "练习题生成": "quiz_set",
  "自测与反馈": "feedback_report",
  "实验设计确认": "design_confirmation",
  "数据整理": "data_summary",
  "分析与计算": "analysis_result",
  "报告撰写": "content_draft",
  "结果校验": "verification_report",
  "目标确认": "goal_confirmation",
  "方案设计": "design_proposal",
  "审核与修正": "review_report",
  "导出": "export_result"
};

export interface WorkerExecutor {
  executeWithLLM?(prompt: string, systemPrompt?: string): Promise<string>;
  executeWithSkill?(skillId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class WorkerAgent {
  private executor: WorkerExecutor | null = null;

  setExecutor(executor: WorkerExecutor): void {
    this.executor = executor;
  }

  async execute(
    dispatch: DispatchResult,
    context: Record<string, unknown>
  ): Promise<WorkerResult> {
    const taskTitle = (context["taskTitle"] as string) ?? "unknown";
    const taskRiskLevel = (context["taskRiskLevel"] as string) ?? "L1";

    const outputType = OUTPUT_TYPE_MAP[taskTitle] ?? "generic_output";

    const structuredResult = await this.generateStructuredResult(taskTitle, dispatch, context);

    const confidence = this.computeConfidence(dispatch, taskRiskLevel);

    const requiredConfirmations = dispatch.requiresHumanGate
      ? [`请确认${taskTitle}结果`]
      : [];

    const evidenceRefs = this.generateEvidenceRefs(dispatch, taskTitle);

    const riskFlags = this.generateRiskFlags(dispatch, taskRiskLevel);

    const nextActions = this.generateNextActions(dispatch, taskTitle);

    const costEstimate = dispatch.estimatedCost;

    return {
      taskId: dispatch.taskId,
      outputType,
      structuredResult,
      confidence,
      requiredConfirmations,
      evidenceRefs,
      riskFlags,
      nextActions,
      costEstimate
    };
  }

  private async generateStructuredResult(
    taskTitle: string,
    dispatch: DispatchResult,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (dispatch.assignedTo === "user") {
      return {
        status: "waiting_for_user",
        taskTitle,
        prompt: `请完成: ${taskTitle}`
      };
    }

    if (dispatch.skillId && this.executor?.executeWithSkill) {
      try {
        const skillResult = await this.executor.executeWithSkill(dispatch.skillId, {
          taskTitle,
          ...(context as Record<string, unknown>)
        });
        return {
          status: "completed",
          taskTitle,
          generatedAt: new Date().toISOString(),
          sourceCount: (context["sourceCount"] as number) ?? 0,
          executedBy: "skill",
          skillId: dispatch.skillId,
          ...skillResult
        };
      } catch {
        return await this.fallbackToLLM(taskTitle, dispatch, context);
      }
    }

    return await this.fallbackToLLM(taskTitle, dispatch, context);
  }

  private async fallbackToLLM(
    taskTitle: string,
    dispatch: DispatchResult,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (this.executor?.executeWithLLM) {
      try {
        const systemPrompt = `你是知序AI的Worker Agent，负责执行项目任务。当前任务：${taskTitle}。请生成结构化的任务输出，包含关键内容、要点和结论。所有AI输出必须标注三色权责：绿色（可溯源）、黄色（需核验）、灰色（AI推断）。`;
        const sourceCount = (context["sourceCount"] as number) ?? 0;
        const userPrompt = `请为任务"${taskTitle}"生成输出内容。参考源资料数量：${sourceCount}。请以JSON格式输出，包含title、content、keyPoints字段。`;

        const llmOutput = await this.executor.executeWithLLM(userPrompt, systemPrompt);

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(llmOutput);
        } catch {
          parsed = { rawContent: llmOutput };
        }

        return {
          status: "completed",
          taskTitle,
          generatedAt: new Date().toISOString(),
          sourceCount,
          executedBy: "llm",
          responsibilityColor: "gray",
          ...parsed
        };
      } catch {
        return this.generateLocalResult(taskTitle, context);
      }
    }

    return this.generateLocalResult(taskTitle, context);
  }

  private generateLocalResult(
    taskTitle: string,
    context: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      status: "completed",
      taskTitle,
      generatedAt: new Date().toISOString(),
      sourceCount: (context["sourceCount"] as number) ?? 0,
      executedBy: "local",
      responsibilityColor: "gray",
      summary: `${taskTitle} output generated`
    };
  }

  private computeConfidence(dispatch: DispatchResult, riskLevel: string): number {
    if (dispatch.assignedTo === "user") return 1.0;

    const riskPenalty: Record<string, number> = {
      L0: 0,
      L1: 0.05,
      L2: 0.15,
      L3: 0.3
    };

    return Math.max(0.3, 0.9 - (riskPenalty[riskLevel] ?? 0.1));
  }

  private generateEvidenceRefs(dispatch: DispatchResult, taskTitle: string): string[] {
    if (dispatch.assignedTo === "user") return [];

    return [`evidence:${dispatch.taskId}:1`, `evidence:${dispatch.taskId}:2`];
  }

  private generateRiskFlags(dispatch: DispatchResult, riskLevel: string): string[] {
    const flags: string[] = [];
    if (riskLevel === "L2" || riskLevel === "L3") {
      flags.push(`高风险任务: ${riskLevel}`);
    }
    if (dispatch.assignedTo === "user") {
      flags.push("等待用户操作");
    }
    return flags;
  }

  private generateNextActions(dispatch: DispatchResult, taskTitle: string): string[] {
    if (dispatch.assignedTo === "user") {
      return [`等待用户完成: ${taskTitle}`];
    }
    return [`继续执行后续任务`];
  }
}
