import type { UnderstandingResult, PlanOption, PlanTask, PlanDependency, SkillCandidate, ThreePlanResult, DecisionCardSet, DecisionCardOption } from "./types.js";

interface PlanConfig {
  id: string;
  label: string;
  planType: PlanOption["planType"];
  aiInvolvementRatio: number;
  timeMultiplier: number;
  completionProbability: number;
  overtimeRisk: number;
  contentErrorRisk: number;
  sourceGapRiskBase: number;
  userEffortHours: number;
  qualityCeiling: number;
  applicableScenario: string;
}

const TASK_TEMPLATES: Record<string, Array<{ title: string; baseDuration: number; assigneeType: PlanTask["assigneeType"]; responsibilityLabel: string; riskLevel: PlanTask["riskLevel"] }>> = {
  PPT: [
    { title: "选题与目标确认", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" },
    { title: "大纲生成", baseDuration: 20, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "内容生成", baseDuration: 40, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "风格选择与排版", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "collaborative", riskLevel: "L1" },
    { title: "导出与检查", baseDuration: 10, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" }
  ],
  论文: [
    { title: "文献检索与筛选", baseDuration: 30, assigneeType: "ai_human", responsibilityLabel: "collaborative", riskLevel: "L1" },
    { title: "阅读笔记生成", baseDuration: 40, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "综述大纲", baseDuration: 20, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L1" },
    { title: "综述撰写", baseDuration: 50, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L2" },
    { title: "引用校验与导出", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L1" }
  ],
  报告: [
    { title: "需求分析", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" },
    { title: "大纲生成", baseDuration: 25, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "内容撰写", baseDuration: 50, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "引用与校验", baseDuration: 20, assigneeType: "ai_human", responsibilityLabel: "collaborative", riskLevel: "L1" },
    { title: "格式化与导出", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" }
  ],
  复习资料: [
    { title: "知识点梳理", baseDuration: 20, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "重点标记", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "collaborative", riskLevel: "L0" },
    { title: "复习资料生成", baseDuration: 30, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "练习题生成", baseDuration: 25, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "自测与反馈", baseDuration: 20, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" }
  ],
  实验报告: [
    { title: "实验设计确认", baseDuration: 15, assigneeType: "human", responsibilityLabel: "human_gate", riskLevel: "L0" },
    { title: "数据整理", baseDuration: 25, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "分析与计算", baseDuration: 35, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L2" },
    { title: "报告撰写", baseDuration: 30, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "结果校验", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L1" }
  ],
  default: [
    { title: "目标确认", baseDuration: 15, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" },
    { title: "方案设计", baseDuration: 20, assigneeType: "ai_human", responsibilityLabel: "collaborative", riskLevel: "L1" },
    { title: "内容生成", baseDuration: 35, assigneeType: "ai", responsibilityLabel: "ai_draft", riskLevel: "L1" },
    { title: "审核与修正", baseDuration: 20, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L1" },
    { title: "导出", baseDuration: 10, assigneeType: "ai_human", responsibilityLabel: "human_gate", riskLevel: "L0" }
  ]
};

const SKILL_MAP: Record<string, SkillCandidate> = {
  "大纲生成": { skillId: "skill_source_parse", reason: "解析源资料生成结构化大纲", riskLevel: "L1" },
  "内容生成": { skillId: "skill_source_parse", reason: "基于源资料生成内容", riskLevel: "L1" },
  "综述撰写": { skillId: "skill_source_parse", reason: "综合多源撰写综述", riskLevel: "L2" },
  "复习资料生成": { skillId: "skill_source_parse", reason: "整理知识点生成复习资料", riskLevel: "L1" },
  "练习题生成": { skillId: "skill_source_parse", reason: "基于知识点生成练习题", riskLevel: "L1" },
  "报告撰写": { skillId: "skill_source_parse", reason: "撰写结构化报告", riskLevel: "L1" },
  "数据整理": { skillId: "skill_source_parse", reason: "整理和结构化数据", riskLevel: "L1" },
  "阅读笔记生成": { skillId: "skill_source_parse", reason: "提取关键信息生成笔记", riskLevel: "L1" },
  "导出与检查": { skillId: "skill_ppt_generate", reason: "导出最终成果", riskLevel: "L2" },
  "格式化与导出": { skillId: "skill_docx_generate", reason: "格式化并导出文档", riskLevel: "L2" },
  "引用校验与导出": { skillId: "skill_artifact_verify", reason: "校验引用完整性", riskLevel: "L2" },
  "结果校验": { skillId: "skill_artifact_verify", reason: "验证结果准确性", riskLevel: "L2" }
};

function resolveTemplate(understanding: UnderstandingResult): string {
  for (const d of understanding.deliverables) {
    if (TASK_TEMPLATES[d]) return d;
  }
  return "default";
}

function buildPlanOption(
  understanding: UnderstandingResult,
  config: PlanConfig
): PlanOption {
  const templateKey = resolveTemplate(understanding);
  const template = TASK_TEMPLATES[templateKey] ?? TASK_TEMPLATES["default"]!;

  const tasks: PlanTask[] = template.map((t, i) => {
    const adjustedAssignee = config.planType === "expedited"
      ? (t.assigneeType === "human" ? "ai_human" as const : t.assigneeType)
      : config.planType === "conservative"
        ? (t.assigneeType === "ai" ? "ai_human" as const : t.assigneeType)
        : t.assigneeType;

    const adjustedRisk = config.planType === "expedited" && t.riskLevel === "L2"
      ? "L3" as const
      : t.riskLevel;

    return {
      id: `${config.id}-t${i + 1}`,
      title: t.title,
      assigneeType: adjustedAssignee,
      responsibilityLabel: t.responsibilityLabel,
      estimatedDuration: Math.round(t.baseDuration * config.timeMultiplier),
      dependencies: i === 0 ? [] : [`${config.id}-t${i}`],
      riskLevel: adjustedRisk
    };
  });

  const dependencies: PlanDependency[] = [];
  for (let i = 1; i < tasks.length; i++) {
    dependencies.push({
      from: tasks[i - 1]!.id,
      to: tasks[i]!.id,
      type: "finish_to_start"
    });
  }

  const humanGateNodes = tasks
    .filter((t) => t.responsibilityLabel === "human_gate" || t.riskLevel === "L2" || t.riskLevel === "L3")
    .map((t) => t.id);

  const skillCandidates: SkillCandidate[] = [];
  for (const task of tasks) {
    const candidate = SKILL_MAP[task.title];
    if (candidate) {
      skillCandidates.push(candidate);
    }
  }

  const sourceGapRisk = understanding.sourceScope.length === 0
    ? config.sourceGapRiskBase + 0.3
    : config.sourceGapRiskBase;

  return {
    id: config.id,
    label: config.label,
    planType: config.planType,
    taskTree: tasks,
    dependencies,
    estimatedCompletionProbability: config.completionProbability,
    overtimeRisk: config.overtimeRisk,
    contentErrorRisk: config.contentErrorRisk,
    sourceGapRisk,
    aiInvolvementRatio: config.aiInvolvementRatio,
    userEffortHours: config.userEffortHours,
    qualityCeiling: config.qualityCeiling,
    applicableScenario: config.applicableScenario,
    humanGateNodes,
    skillCandidates
  };
}

export class PlannerAgent {
  generateThreePlans(understanding: UnderstandingResult): ThreePlanResult & { decisionCards: DecisionCardSet } {
    const recommended = buildPlanOption(understanding, {
      id: "recommended",
      label: "推荐方案",
      planType: "recommended",
      aiInvolvementRatio: 0.4,
      timeMultiplier: 1.0,
      completionProbability: 0.85,
      overtimeRisk: 0.15,
      contentErrorRisk: 0.2,
      sourceGapRiskBase: 0.15,
      userEffortHours: 2.5,
      qualityCeiling: 8.0,
      applicableScenario: "适合大多数场景，兼顾速度与质量"
    });

    const expedited = buildPlanOption(understanding, {
      id: "expedited",
      label: "极速方案",
      planType: "expedited",
      aiInvolvementRatio: 0.6,
      timeMultiplier: 0.6,
      completionProbability: 0.7,
      overtimeRisk: 0.45,
      contentErrorRisk: 0.4,
      sourceGapRiskBase: 0.3,
      userEffortHours: 1.0,
      qualityCeiling: 6.0,
      applicableScenario: "时间紧迫时使用，质量可能受影响"
    });

    const conservative = buildPlanOption(understanding, {
      id: "conservative",
      label: "稳妥方案",
      planType: "conservative",
      aiInvolvementRatio: 0.2,
      timeMultiplier: 1.5,
      completionProbability: 0.95,
      overtimeRisk: 0.05,
      contentErrorRisk: 0.08,
      sourceGapRiskBase: 0.05,
      userEffortHours: 5.0,
      qualityCeiling: 9.5,
      applicableScenario: "时间充裕时使用，追求最高质量"
    });

    const comparisonSummary = `推荐方案平衡效率与质量(AI参与${Math.round(recommended.aiInvolvementRatio * 100)}%)；极速方案快速产出(AI参与${Math.round(expedited.aiInvolvementRatio * 100)}%)但质量上限较低；稳妥方案用户主导(AI参与${Math.round(conservative.aiInvolvementRatio * 100)}%)，质量最高但耗时最长。`;

    const decisionCards = this.generateDecisionCards(recommended, expedited, conservative);

    return { recommended, expedited, conservative, comparisonSummary, decisionCards };
  }

  private generateDecisionCards(
    recommended: PlanOption,
    expedited: PlanOption,
    conservative: PlanOption
  ): DecisionCardSet {
    const options: DecisionCardOption[] = [
      {
        id: "A",
        title: "极速方案",
        description: expedited.applicableScenario,
        tradeoff: `AI参与${Math.round(expedited.aiInvolvementRatio * 100)}%，质量上限${expedited.qualityCeiling}/10，超时风险${Math.round(expedited.overtimeRisk * 100)}%`,
        estimatedUserTime: `${expedited.userEffortHours}小时`,
        riskLevel: expedited.overtimeRisk > 0.3 ? "L2" : "L1",
        qualityCeiling: expedited.qualityCeiling,
        isRecommended: false
      },
      {
        id: "B",
        title: "推荐方案",
        description: recommended.applicableScenario,
        tradeoff: `AI参与${Math.round(recommended.aiInvolvementRatio * 100)}%，质量上限${recommended.qualityCeiling}/10，超时风险${Math.round(recommended.overtimeRisk * 100)}%`,
        estimatedUserTime: `${recommended.userEffortHours}小时`,
        riskLevel: "L1",
        qualityCeiling: recommended.qualityCeiling,
        isRecommended: true
      },
      {
        id: "C",
        title: "稳妥方案",
        description: conservative.applicableScenario,
        tradeoff: `AI参与${Math.round(conservative.aiInvolvementRatio * 100)}%，质量上限${conservative.qualityCeiling}/10，超时风险${Math.round(conservative.overtimeRisk * 100)}%`,
        estimatedUserTime: `${conservative.userEffortHours}小时`,
        riskLevel: "L0",
        qualityCeiling: conservative.qualityCeiling,
        isRecommended: false
      }
    ];

    return {
      type: "decision_cards",
      title: "选择执行方案",
      recommendedOptionId: "B",
      options
    };
  }
}
