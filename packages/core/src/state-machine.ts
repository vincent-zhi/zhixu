import type { ProjectStatus } from "./schemas.js";

const allowedTransitions = {
  captured: ["understanding", "risk", "archived"],
  understanding: ["planned", "waiting_user", "risk", "failed"],
  planned: ["preparing", "waiting_user", "archived"],
  preparing: ["executing", "waiting_user", "failed"],
  waiting_user: ["understanding", "planned", "preparing", "executing", "archived"],
  executing: ["verifying", "waiting_user", "risk", "failed"],
  verifying: ["ready_to_deliver", "executing", "waiting_user", "risk", "failed"],
  ready_to_deliver: ["tracking", "completed", "waiting_user"],
  tracking: ["executing", "completed", "archived"],
  completed: ["archived"],
  archived: [],
  risk: ["waiting_user", "failed", "archived"],
  failed: ["preparing", "archived"]
} satisfies Record<ProjectStatus, ProjectStatus[]>;

export function getAllowedProjectTransitions(status: ProjectStatus): ProjectStatus[] {
  return allowedTransitions[status];
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  const transitions: readonly ProjectStatus[] = allowedTransitions[from];
  return transitions.includes(to);
}

export function requiresHumanGate(status: ProjectStatus): boolean {
  return status === "ready_to_deliver" || status === "risk";
}
