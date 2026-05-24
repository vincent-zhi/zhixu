import type { PlanOption, PlanTask, DispatchResult } from "./types.js";

const COST_MAP: Record<DispatchResult["assignedTo"], number> = {
  model: 0.003,
  skill: 0.001,
  local_service: 0,
  cloud_service: 0.002,
  user: 0
};

export class DispatcherAgent {
  dispatch(plan: PlanOption): DispatchResult[] {
    return plan.taskTree.map((task) => {
      const assignedTo = this.resolveAssignment(task);
      const skillId = this.resolveSkillId(task, assignedTo, plan);
      const estimatedCost = COST_MAP[assignedTo] * task.estimatedDuration;
      const requiresHumanGate = plan.humanGateNodes.includes(task.id);

      const result: DispatchResult = {
        taskId: task.id,
        assignedTo,
        estimatedCost,
        requiresHumanGate
      };

      if (skillId !== undefined) {
        result.skillId = skillId;
      }

      return result;
    });
  }

  private resolveAssignment(task: PlanTask): DispatchResult["assignedTo"] {
    if (task.riskLevel === "L3") {
      return "user";
    }

    if (task.assigneeType === "human") {
      return "user";
    }

    if (task.assigneeType === "ai_human") {
      return "model";
    }

    return "model";
  }

  private resolveSkillId(
    task: PlanTask,
    assignedTo: DispatchResult["assignedTo"],
    plan: PlanOption
  ): string | undefined {
    if (assignedTo === "user" || assignedTo === "local_service") {
      return undefined;
    }

    const candidate = plan.skillCandidates.find((sc) => {
      const candidateTask = plan.taskTree.find((t) => t.title.includes(sc.reason.slice(0, 4)));
      return candidateTask?.id === task.id;
    });

    if (candidate) {
      return candidate.skillId;
    }

    if (assignedTo === "skill") {
      return "skill_source_parse";
    }

    return undefined;
  }
}
