import type { UnderstandingResult } from "./types.js";

const GOAL_KEYWORDS = [
  "我需要",
  "我要",
  "帮我",
  "请帮我",
  "我想要",
  "需要",
  "goal",
  "task",
  "objective"
];

const DELIVERABLE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /PPT|幻灯片|汇报|presentation/ui, label: "PPT" },
  { pattern: /论文|paper|thesis/ui, label: "论文" },
  { pattern: /报告|report/ui, label: "报告" },
  { pattern: /综述|literature.?review/ui, label: "文献综述" },
  { pattern: /复习资料|笔记|exam.?notes/ui, label: "复习资料" },
  { pattern: /实验报告|lab.?report/ui, label: "实验报告" },
  { pattern: /计划|plan/ui, label: "计划书" }
];

const SENSITIVE_KEYWORDS = [
  "未发表",
  "unpublished",
  "实验数据",
  "experiment.?data",
  "导师反馈",
  "mentor.?feedback",
  "保密",
  "confidential",
  "内部",
  "internal"
];

const RISK_URGENT_KEYWORDS = [
  "紧急",
  "今天",
  "明天",
  "urgent",
  "asap",
  "tonight",
  "马上"
];

export class UnderstandingAgent {
  analyze(input: {
    rawInput: string;
    sources: Array<{ id: string; fileName: string; summary?: string }>;
    dueDate?: string;
  }): UnderstandingResult {
    const goals = this.extractGoals(input.rawInput);
    const deliverables = this.extractDeliverables(input.rawInput);
    const sourceScope = input.sources.map((s) => s.fileName);
    const missingInfo = this.detectMissingInfo(input);
    const sensitiveInfo = this.detectSensitiveInfo(input.sources, input.rawInput);
    const riskFlags = this.detectRiskFlags(input.rawInput, missingInfo, sensitiveInfo);
    const confidence = this.computeConfidence(goals, deliverables, missingInfo);

    return {
      goals,
      deliverables,
      dueDate: input.dueDate ?? null,
      sourceScope,
      riskFlags,
      missingInfo,
      sensitiveInfo,
      confidence
    };
  }

  private extractGoals(raw: string): string[] {
    const goals: string[] = [];

    for (const keyword of GOAL_KEYWORDS) {
      const idx = raw.indexOf(keyword);
      if (idx !== -1) {
        const after = raw.slice(idx + keyword.length).trim();
        const endMatch = after.match(/^[，。,.\n]/u);
        if (endMatch && endMatch.index !== undefined) {
          const segment = after.slice(0, endMatch.index).trim();
          if (segment.length >= 2) {
            goals.push(segment);
          }
        } else {
          const segment = after.slice(0, 80).trim();
          if (segment.length >= 2) {
            goals.push(segment);
          }
        }
      }
    }

    if (goals.length === 0) {
      const firstSentence = raw.split(/[。.!\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 0) {
        goals.push(firstSentence.slice(0, 120));
      }
    }

    return goals;
  }

  private extractDeliverables(raw: string): string[] {
    const deliverables: string[] = [];

    for (const { pattern, label } of DELIVERABLE_PATTERNS) {
      if (pattern.test(raw)) {
        deliverables.push(label);
      }
    }

    if (deliverables.length === 0) {
      deliverables.push("项目成果");
    }

    return deliverables;
  }

  private detectMissingInfo(
    input: {
      rawInput: string;
      sources: Array<{ id: string; fileName: string; summary?: string }>;
      dueDate?: string;
    }
  ): string[] {
    const missing: string[] = [];

    if (!input.dueDate) {
      missing.push("截止日期未指定");
    }

    if (input.sources.length === 0) {
      missing.push("未提供参考资料");
    }

    return missing;
  }

  private detectSensitiveInfo(
    sources: Array<{ id: string; fileName: string; summary?: string }>,
    rawInput: string
  ): string[] {
    const sensitive: string[] = [];

    for (const source of sources) {
      for (const keyword of SENSITIVE_KEYWORDS) {
        const re = new RegExp(keyword, "ui");
        if (re.test(source.fileName) || (source.summary && re.test(source.summary))) {
          sensitive.push(source.fileName);
          break;
        }
      }
    }

    for (const keyword of SENSITIVE_KEYWORDS) {
      const re = new RegExp(keyword, "ui");
      if (re.test(rawInput)) {
        sensitive.push(`输入中包含敏感关键词: ${rawInput.match(re)![0]}`);
        break;
      }
    }

    return [...new Set(sensitive)];
  }

  private detectRiskFlags(
    raw: string,
    missingInfo: string[],
    sensitiveInfo: string[]
  ): string[] {
    const flags: string[] = [];

    if (missingInfo.length > 0) {
      flags.push("信息不完整: " + missingInfo.join(", "));
    }

    if (sensitiveInfo.length > 0) {
      flags.push("包含敏感资料");
    }

    const lowerRaw = raw.toLowerCase();
    for (const keyword of RISK_URGENT_KEYWORDS) {
      if (lowerRaw.includes(keyword.toLowerCase())) {
        flags.push("时间紧迫");
        break;
      }
    }

    if (missingInfo.length === 0 && sensitiveInfo.length === 0) {
      flags.push("无明显风险");
    }

    return flags;
  }

  private computeConfidence(
    goals: string[],
    deliverables: string[],
    missingInfo: string[]
  ): number {
    let confidence = 0.5;

    if (goals.length > 0) confidence += 0.2;
    if (deliverables.length > 0 && !deliverables.includes("项目成果")) confidence += 0.15;
    if (missingInfo.length === 0) confidence += 0.15;
    if (missingInfo.length >= 2) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }
}
