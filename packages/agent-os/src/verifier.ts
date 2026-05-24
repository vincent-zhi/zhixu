import type { WorkerResult, PlanTask, VerificationResult, CheckResult } from "./types.js";

const PROHIBITED_PATTERNS = [
  /抄袭/u,
  /plagiarize/i,
  /代写/u,
  /ghost.?write/i
];

export class VerifierAgent {
  verify(workerResult: WorkerResult, originalTask: PlanTask): VerificationResult {
    const factCheck = this.checkFact(workerResult, originalTask);
    const citationCheck = this.checkCitation(workerResult);
    const responsibilityCheck = this.checkResponsibility(workerResult, originalTask);
    const formatCheck = this.checkFormat(workerResult);
    const logicCheck = this.checkLogic(workerResult);
    const complianceCheck = this.checkCompliance(workerResult);
    const exportIntegrityCheck = this.checkExportIntegrity(workerResult);

    const checks = [
      factCheck,
      citationCheck,
      responsibilityCheck,
      formatCheck,
      logicCheck,
      complianceCheck,
      exportIntegrityCheck
    ];

    const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
    const overallScore = totalScore / checks.length;
    const passed = checks.every((c) => c.passed);

    return {
      passed,
      factCheck,
      citationCheck,
      responsibilityCheck,
      formatCheck,
      logicCheck,
      complianceCheck,
      exportIntegrityCheck,
      overallScore
    };
  }

  private checkFact(workerResult: WorkerResult, originalTask: PlanTask): CheckResult {
    const issues: string[] = [];

    if (originalTask.assigneeType !== "human" && workerResult.evidenceRefs.length === 0) {
      issues.push("AI生成内容缺少证据引用");
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.4
    };
  }

  private checkCitation(workerResult: WorkerResult): CheckResult {
    const issues: string[] = [];

    const result = workerResult.structuredResult;
    if (result["citations"] && Array.isArray(result["citations"])) {
      const unverified = (result["citations"] as string[]).filter((c: string) => !c.startsWith("verified:"));
      if (unverified.length > 0) {
        issues.push(`存在${unverified.length}条未验证引用`);
      }
    }

    if (workerResult.evidenceRefs.length === 0 && workerResult.outputType === "content_draft") {
      issues.push("内容草稿缺少引用");
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.5
    };
  }

  private checkResponsibility(workerResult: WorkerResult, originalTask: PlanTask): CheckResult {
    const issues: string[] = [];

    if (originalTask.riskLevel === "L2" || originalTask.riskLevel === "L3") {
      if (!workerResult.requiredConfirmations.some((c) => c.includes("确认"))) {
        issues.push("高风险任务缺少人工确认警告");
      }
    }

    if (originalTask.assigneeType === "ai" && workerResult.confidence < 0.5) {
      issues.push("AI生成内容置信度过低，需要人工审核");
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.3
    };
  }

  private checkFormat(workerResult: WorkerResult): CheckResult {
    const issues: string[] = [];

    if (!workerResult.outputType || workerResult.outputType.trim().length === 0) {
      issues.push("缺少输出类型");
    }

    if (!workerResult.structuredResult || Object.keys(workerResult.structuredResult).length === 0) {
      issues.push("结构化结果为空");
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.2
    };
  }

  private checkLogic(workerResult: WorkerResult): CheckResult {
    const issues: string[] = [];

    if (workerResult.riskFlags.length > 0 && workerResult.confidence > 0.9) {
      issues.push("存在风险标记但置信度过高，可能存在矛盾");
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.5
    };
  }

  private checkCompliance(workerResult: WorkerResult): CheckResult {
    const issues: string[] = [];

    const contentStr = JSON.stringify(workerResult.structuredResult);
    for (const pattern of PROHIBITED_PATTERNS) {
      if (pattern.test(contentStr)) {
        issues.push(`检测到违规内容模式: ${pattern.source}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.0
    };
  }

  private checkExportIntegrity(workerResult: WorkerResult): CheckResult {
    const issues: string[] = [];

    if (workerResult.outputType === "export_result") {
      if (!workerResult.structuredResult["status"]) {
        issues.push("导出结果缺少状态字段");
      }
    }

    if (workerResult.structuredResult["status"] === "completed") {
      if (!workerResult.evidenceRefs || workerResult.evidenceRefs.length === 0) {
        issues.push("已完成任务缺少证据引用");
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      score: issues.length === 0 ? 1.0 : 0.4
    };
  }
}
