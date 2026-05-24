import { describe, expect, it } from "vitest";
import {
  canTransitionProject,
  getAllowedProjectTransitions,
  requiresHumanGate
} from "./state-machine.js";

describe("project state machine", () => {
  it("allows a captured project to enter understanding", () => {
    expect(canTransitionProject("captured", "understanding")).toBe(true);
  });

  it("prevents silently jumping from captured to completed", () => {
    expect(canTransitionProject("captured", "completed")).toBe(false);
  });

  it("requires human gate for delivery and risk states", () => {
    expect(requiresHumanGate("ready_to_deliver")).toBe(true);
    expect(requiresHumanGate("risk")).toBe(true);
    expect(requiresHumanGate("executing")).toBe(false);
  });

  it("treats archived projects as terminal", () => {
    expect(getAllowedProjectTransitions("archived")).toEqual([]);
  });
});
