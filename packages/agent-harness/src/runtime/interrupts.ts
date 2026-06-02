import type { WorkflowInterrupt } from "../types.js";

export interface InterruptResult {
  interrupted: true;
  interrupt: WorkflowInterrupt;
}
