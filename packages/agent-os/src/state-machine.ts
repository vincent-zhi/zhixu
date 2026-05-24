export type ProjectStatus =
  | "captured"
  | "understanding"
  | "planned"
  | "preparing"
  | "waiting_user"
  | "executing"
  | "verifying"
  | "ready_to_deliver"
  | "tracking"
  | "completed"
  | "archived"
  | "risk"
  | "failed";

export interface StateDefinition {
  status: ProjectStatus;
  entryCondition: string;
  exitCondition: string;
  owner: "system" | "user" | "ai" | "ai_human";
  allowedActions: string[];
  timeoutPolicy: { timeoutMs: number; action: "auto_advance" | "alert" | "rollback" };
  riskPolicy: { maxRiskLevel: string; escalationAction: string };
}

export interface StateTransition {
  from: ProjectStatus;
  to: ProjectStatus;
  trigger: string;
  requiredConfirmations: string[];
  autoTransition: boolean;
}

const STATE_DEFINITIONS: Map<ProjectStatus, StateDefinition> = new Map([
  [
    "captured",
    {
      status: "captured",
      entryCondition: "Project created",
      exitCondition: "Understanding started",
      owner: "system",
      allowedActions: ["edit_title", "add_sources", "set_due_date"],
      timeoutPolicy: { timeoutMs: 24 * 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L1", escalationAction: "notify_user" }
    }
  ],
  [
    "understanding",
    {
      status: "understanding",
      entryCondition: "Agent analyzing",
      exitCondition: "Understanding complete",
      owner: "ai",
      allowedActions: ["add_sources", "edit_requirements"],
      timeoutPolicy: { timeoutMs: 5 * 60 * 1000, action: "auto_advance" },
      riskPolicy: { maxRiskLevel: "L2", escalationAction: "pause_and_notify" }
    }
  ],
  [
    "planned",
    {
      status: "planned",
      entryCondition: "Three plans generated",
      exitCondition: "User selects plan",
      owner: "user",
      allowedActions: ["select_plan", "request_replan", "edit_plan"],
      timeoutPolicy: { timeoutMs: 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L2", escalationAction: "auto_select_recommended" }
    }
  ],
  [
    "preparing",
    {
      status: "preparing",
      entryCondition: "Plan confirmed",
      exitCondition: "Resources ready",
      owner: "ai_human",
      allowedActions: ["add_sources", "adjust_plan"],
      timeoutPolicy: { timeoutMs: 30 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L2", escalationAction: "notify_user" }
    }
  ],
  [
    "waiting_user",
    {
      status: "waiting_user",
      entryCondition: "Human gate or user action needed",
      exitCondition: "User responds",
      owner: "user",
      allowedActions: ["confirm", "reject", "edit", "provide_input"],
      timeoutPolicy: { timeoutMs: 24 * 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L3", escalationAction: "escalate_to_admin" }
    }
  ],
  [
    "executing",
    {
      status: "executing",
      entryCondition: "Tasks being executed",
      exitCondition: "All tasks complete",
      owner: "ai_human",
      allowedActions: ["pause", "edit_block", "add_comment", "request_revision"],
      timeoutPolicy: { timeoutMs: 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L2", escalationAction: "pause_and_notify" }
    }
  ],
  [
    "verifying",
    {
      status: "verifying",
      entryCondition: "Output being verified",
      exitCondition: "Verification complete",
      owner: "ai",
      allowedActions: [],
      timeoutPolicy: { timeoutMs: 10 * 60 * 1000, action: "auto_advance" },
      riskPolicy: { maxRiskLevel: "L1", escalationAction: "notify_user" }
    }
  ],
  [
    "ready_to_deliver",
    {
      status: "ready_to_deliver",
      entryCondition: "Verification passed",
      exitCondition: "User accepts delivery",
      owner: "user",
      allowedActions: ["accept", "request_revision", "export"],
      timeoutPolicy: { timeoutMs: 48 * 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L2", escalationAction: "notify_user" }
    }
  ],
  [
    "tracking",
    {
      status: "tracking",
      entryCondition: "Delivered, monitoring",
      exitCondition: "Project completed or issue found",
      owner: "system",
      allowedActions: ["add_feedback", "create_revision", "archive"],
      timeoutPolicy: { timeoutMs: 7 * 24 * 60 * 60 * 1000, action: "auto_advance" },
      riskPolicy: { maxRiskLevel: "L1", escalationAction: "notify_user" }
    }
  ],
  [
    "completed",
    {
      status: "completed",
      entryCondition: "All deliverables accepted",
      exitCondition: "Archived",
      owner: "system",
      allowedActions: ["archive", "create_revision", "export_report"],
      timeoutPolicy: { timeoutMs: 30 * 24 * 60 * 60 * 1000, action: "auto_advance" },
      riskPolicy: { maxRiskLevel: "L0", escalationAction: "none" }
    }
  ],
  [
    "archived",
    {
      status: "archived",
      entryCondition: "Project archived",
      exitCondition: "Reopened",
      owner: "system",
      allowedActions: ["reopen", "export_report", "create_capsule"],
      timeoutPolicy: { timeoutMs: Infinity, action: "alert" },
      riskPolicy: { maxRiskLevel: "L0", escalationAction: "none" }
    }
  ],
  [
    "risk",
    {
      status: "risk",
      entryCondition: "Risk detected",
      exitCondition: "Risk resolved",
      owner: "user",
      allowedActions: ["resolve_risk", "escalate", "rollback"],
      timeoutPolicy: { timeoutMs: 4 * 60 * 60 * 1000, action: "alert" },
      riskPolicy: { maxRiskLevel: "L3", escalationAction: "escalate_to_admin" }
    }
  ],
  [
    "failed",
    {
      status: "failed",
      entryCondition: "Unrecoverable error",
      exitCondition: "Retry or abandon",
      owner: "user",
      allowedActions: ["retry", "abandon", "contact_support"],
      timeoutPolicy: { timeoutMs: Infinity, action: "alert" },
      riskPolicy: { maxRiskLevel: "L3", escalationAction: "notify_admin" }
    }
  ]
]);

const TRANSITIONS: StateTransition[] = [
  { from: "captured", to: "understanding", trigger: "start_understanding", requiredConfirmations: [], autoTransition: true },
  { from: "understanding", to: "planned", trigger: "understanding_complete", requiredConfirmations: [], autoTransition: true },
  { from: "planned", to: "preparing", trigger: "plan_selected", requiredConfirmations: ["plan_confirmation"], autoTransition: false },
  { from: "planned", to: "understanding", trigger: "replan_requested", requiredConfirmations: [], autoTransition: false },
  { from: "preparing", to: "waiting_user", trigger: "human_gate_needed", requiredConfirmations: [], autoTransition: true },
  { from: "preparing", to: "executing", trigger: "resources_ready", requiredConfirmations: [], autoTransition: true },
  { from: "waiting_user", to: "executing", trigger: "user_responded", requiredConfirmations: [], autoTransition: false },
  { from: "waiting_user", to: "risk", trigger: "timeout_exceeded", requiredConfirmations: [], autoTransition: true },
  { from: "executing", to: "verifying", trigger: "tasks_complete", requiredConfirmations: [], autoTransition: true },
  { from: "executing", to: "waiting_user", trigger: "human_gate_needed", requiredConfirmations: [], autoTransition: true },
  { from: "executing", to: "risk", trigger: "risk_detected", requiredConfirmations: [], autoTransition: true },
  { from: "verifying", to: "ready_to_deliver", trigger: "verification_passed", requiredConfirmations: [], autoTransition: true },
  { from: "verifying", to: "executing", trigger: "verification_failed", requiredConfirmations: [], autoTransition: true },
  { from: "ready_to_deliver", to: "tracking", trigger: "delivery_accepted", requiredConfirmations: [], autoTransition: false },
  { from: "ready_to_deliver", to: "executing", trigger: "revision_requested", requiredConfirmations: [], autoTransition: false },
  { from: "tracking", to: "completed", trigger: "all_deliverables_accepted", requiredConfirmations: [], autoTransition: true },
  { from: "tracking", to: "risk", trigger: "issue_found", requiredConfirmations: [], autoTransition: true },
  { from: "completed", to: "archived", trigger: "archive", requiredConfirmations: [], autoTransition: false },
  { from: "archived", to: "planned", trigger: "reopen", requiredConfirmations: [], autoTransition: false },
  { from: "risk", to: "executing", trigger: "risk_resolved", requiredConfirmations: [], autoTransition: false },
  { from: "risk", to: "failed", trigger: "risk_unresolvable", requiredConfirmations: [], autoTransition: false },
  { from: "failed", to: "planned", trigger: "retry", requiredConfirmations: [], autoTransition: false }
];

export class TaskStateMachine {
  private static readonly STATES = STATE_DEFINITIONS;
  private static readonly TRANSITIONS = TRANSITIONS;

  static getDefinition(status: ProjectStatus): StateDefinition {
    const definition = this.STATES.get(status);
    if (!definition) {
      throw new Error(`Unknown project status: ${status}`);
    }
    return { ...definition };
  }

  static canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    return this.TRANSITIONS.some((t) => t.from === from && t.to === to);
  }

  static getTransitionsFrom(status: ProjectStatus): StateTransition[] {
    return this.TRANSITIONS.filter((t) => t.from === status).map((t) => ({ ...t }));
  }

  static getNextStatus(current: ProjectStatus, trigger: string): ProjectStatus | null {
    const transition = this.TRANSITIONS.find(
      (t) => t.from === current && t.trigger === trigger
    );
    return transition ? transition.to : null;
  }

  static getAllStatuses(): ProjectStatus[] {
    return Array.from(this.STATES.keys());
  }

  static getAllTransitions(): StateTransition[] {
    return this.TRANSITIONS.map((t) => ({ ...t }));
  }
}
