import type { ExperimentLog, ExperimentVariable, ExperimentStep, ExperimentAnomaly, LLMCallable } from "./types.js";

export class ExperimentLogManager {
  createLog(input: {
    purpose: string;
    variables?: ExperimentVariable[];
    steps?: ExperimentStep[];
    environment?: Record<string, string>;
  }): ExperimentLog {
    return {
      id: crypto.randomUUID(),
      projectId: "",
      purpose: input.purpose,
      variables: input.variables ?? [],
      steps: input.steps ?? [],
      environment: input.environment ?? {},
      rawData: {},
      results: "",
      analysis: "",
      issues: [],
      conclusion: "",
      createdAt: new Date().toISOString(),
    };
  }

  analyzeAnomaly(log: ExperimentLog): ExperimentAnomaly {
    const possibleCauses: string[] = [];
    const suggestedActions: string[] = [];
    let description = "No anomaly detected";

    if (log.issues.length > 0) {
      description = `${log.issues.length} issue(s) detected in experiment`;
      possibleCauses.push("Environmental factors may have affected results");
      possibleCauses.push("Variable control may be insufficient");
      suggestedActions.push("Review experimental conditions");
      suggestedActions.push("Re-run experiment with controlled variables");
    }

    if (log.results && log.analysis) {
      const resultWords = log.results.toLowerCase().split(/\s+/);
      const analysisWords = log.analysis.toLowerCase().split(/\s+/);
      const negativeTerms = ["fail", "error", "unexpected", "anomaly", "outlier", "discrepancy"];
      const hasNegative = negativeTerms.some(
        (term) => resultWords.includes(term) || analysisWords.includes(term),
      );
      if (hasNegative) {
        description = "Negative indicators found in results or analysis";
        possibleCauses.push("Measurement error");
        possibleCauses.push("Hypothesis may be incorrect");
        suggestedActions.push("Verify measurement instruments");
        suggestedActions.push("Consider alternative hypotheses");
      }
    }

    if (log.variables.length === 0) {
      possibleCauses.push("No variables defined, experiment may lack structure");
      suggestedActions.push("Define independent, dependent, and controlled variables");
    }

    if (log.steps.length === 0) {
      possibleCauses.push("No steps defined, experiment may not be reproducible");
      suggestedActions.push("Document experimental steps in detail");
    }

    const priority = possibleCauses.length > 2 ? 3 : possibleCauses.length > 0 ? 2 : 1;

    return {
      id: crypto.randomUUID(),
      experimentLogId: log.id,
      description,
      possibleCauses,
      priority,
      suggestedActions,
    };
  }

  standardizeLog(log: ExperimentLog): ExperimentLog {
    const standardized = { ...log };

    if (!standardized.variables) {
      standardized.variables = [];
    }
    if (!standardized.steps) {
      standardized.steps = [];
    }
    if (!standardized.environment) {
      standardized.environment = {};
    }
    if (!standardized.rawData) {
      standardized.rawData = {};
    }
    if (!standardized.results) {
      standardized.results = "";
    }
    if (!standardized.analysis) {
      standardized.analysis = "";
    }
    if (!standardized.issues) {
      standardized.issues = [];
    }
    if (!standardized.conclusion) {
      standardized.conclusion = "";
    }
    if (!standardized.createdAt) {
      standardized.createdAt = new Date().toISOString();
    }

    for (let i = 0; i < standardized.steps.length; i++) {
      if (standardized.steps[i]!.order !== i + 1) {
        standardized.steps[i] = { ...standardized.steps[i]!, order: i + 1 };
      }
    }

    return standardized;
  }

  async analyzeAnomalyEnhanced(
    log: ExperimentLog,
    llm: LLMCallable
  ): Promise<ExperimentAnomaly & { hypotheses: string[]; nextSteps: string[] }> {
    const basic = this.analyzeAnomaly(log);
    try {
      const result = await llm.chat({
        system: `你是一位实验异常分析助手。根据实验记录，生成归因假设和排查步骤。
返回 JSON：{"hypotheses": ["假设1：...", "..."], "nextSteps": ["步骤1：...", "..."]}`,
        messages: [{ role: "user", content: `实验目的：${log.purpose}\n变量：${log.variables.map(v => `${v.name}=${v.value}`).join("、")}\n步骤：${log.steps.map(s => s.description).join("；")}\n结果：${log.results}\n分析：${log.analysis}\n已知问题：${log.issues.join("、")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, hypotheses: parsed.hypotheses ?? [], nextSteps: parsed.nextSteps ?? [] };
    } catch {
      return { ...basic, hypotheses: [], nextSteps: [] };
    }
  }
}
