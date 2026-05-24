import { UnderstandingAgent } from "./understanding.js";
import { PlannerAgent } from "./planner.js";
import { DispatcherAgent } from "./dispatcher.js";
import { WorkerAgent, type WorkerExecutor } from "./worker.js";
import { VerifierAgent } from "./verifier.js";
import { ReflectionEngine } from "./reflection.js";
import type { UnderstandingResult, ThreePlanResult, PlanOption, DispatchResult, WorkerResult, VerificationResult, ReflectionResult, PipelineResult } from "./types.js";

const MAX_VERIFY_RETRIES = 2;

export class AgentPipeline {
  private readonly understandingAgent = new UnderstandingAgent();
  private readonly plannerAgent = new PlannerAgent();
  private readonly dispatcherAgent = new DispatcherAgent();
  private readonly workerAgent = new WorkerAgent();
  private readonly verifierAgent = new VerifierAgent();
  private readonly reflectionEngine = new ReflectionEngine();

  setExecutor(executor: WorkerExecutor): void {
    this.workerAgent.setExecutor(executor);
  }

  async run(input: {
    rawInput: string;
    sources: Array<{ id: string; fileName: string; summary?: string }>;
    dueDate?: string;
  }): Promise<PipelineResult> {
    const understanding = this.understandingAgent.analyze(input);

    const plans = this.plannerAgent.generateThreePlans(understanding);

    const selectedPlan = plans.recommended;

    const dispatches = this.dispatcherAgent.dispatch(selectedPlan);

    const workerResults: WorkerResult[] = [];
    const verificationResults: VerificationResult[] = [];

    for (const dispatch of dispatches) {
      const task = selectedPlan.taskTree.find((t) => t.id === dispatch.taskId);
      if (!task) continue;

      const context: Record<string, unknown> = {
        taskTitle: task.title,
        taskRiskLevel: task.riskLevel,
        sourceCount: input.sources.length
      };

      const workerResult = await this.workerAgent.execute(dispatch, context);
      workerResults.push(workerResult);

      const verification = this.verifyWithRetry(workerResult, task);
      verificationResults.push(verification);
    }

    const reflection = this.runReflection(selectedPlan, workerResults, verificationResults);

    return {
      understanding,
      plans,
      selectedPlan,
      dispatches,
      workerResults,
      verificationResults,
      reflection
    };
  }

  private verifyWithRetry(
    workerResult: WorkerResult,
    task: import("./types.js").PlanTask
  ): VerificationResult {
    let verification = this.verifierAgent.verify(workerResult, task);

    let retries = 0;
    while (!verification.passed && retries < MAX_VERIFY_RETRIES) {
      retries++;
      verification = this.verifierAgent.verify(workerResult, task);
    }

    return verification;
  }

  private runReflection(
    selectedPlan: PlanOption,
    workerResults: WorkerResult[],
    verificationResults: VerificationResult[]
  ): ReflectionResult {
    const tasks = selectedPlan.taskTree.map((t, i) => {
      const verification = verificationResults[i];
      return {
        status: verification?.passed ? "completed" : "failed",
        riskLevel: t.riskLevel
      };
    });

    const artifacts = workerResults.map((wr) => ({
      evidenceCoverage: wr.evidenceRefs.length > 0 ? 0.8 : 0.2
    }));

    return this.reflectionEngine.reflect({ tasks, artifacts });
  }
}

export type { PipelineResult };
