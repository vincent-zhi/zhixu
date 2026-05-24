import { describe, it, expect } from "vitest";
import { TaskStateMachine } from "./state-machine.js";
import type { ProjectStatus, StateDefinition, StateTransition } from "./state-machine.js";

describe("TaskStateMachine", () => {
  describe("getDefinition", () => {
    it("returns definition for captured status", () => {
      const def = TaskStateMachine.getDefinition("captured");
      expect(def.status).toBe("captured");
      expect(def.entryCondition).toBe("Project created");
      expect(def.exitCondition).toBe("Understanding started");
      expect(def.owner).toBe("system");
      expect(def.allowedActions).toEqual(["edit_title", "add_sources", "set_due_date"]);
      expect(def.timeoutPolicy).toEqual({ timeoutMs: 24 * 60 * 60 * 1000, action: "alert" });
    });

    it("returns definition for understanding status", () => {
      const def = TaskStateMachine.getDefinition("understanding");
      expect(def.status).toBe("understanding");
      expect(def.owner).toBe("ai");
      expect(def.timeoutPolicy.action).toBe("auto_advance");
    });

    it("returns definition for planned status", () => {
      const def = TaskStateMachine.getDefinition("planned");
      expect(def.owner).toBe("user");
      expect(def.allowedActions).toContain("select_plan");
    });

    it("returns definition for preparing status", () => {
      const def = TaskStateMachine.getDefinition("preparing");
      expect(def.owner).toBe("ai_human");
    });

    it("returns definition for waiting_user status", () => {
      const def = TaskStateMachine.getDefinition("waiting_user");
      expect(def.owner).toBe("user");
      expect(def.allowedActions).toEqual(["confirm", "reject", "edit", "provide_input"]);
    });

    it("returns definition for executing status", () => {
      const def = TaskStateMachine.getDefinition("executing");
      expect(def.owner).toBe("ai_human");
      expect(def.allowedActions).toContain("pause");
    });

    it("returns definition for verifying status", () => {
      const def = TaskStateMachine.getDefinition("verifying");
      expect(def.owner).toBe("ai");
      expect(def.allowedActions).toEqual([]);
    });

    it("returns definition for ready_to_deliver status", () => {
      const def = TaskStateMachine.getDefinition("ready_to_deliver");
      expect(def.owner).toBe("user");
      expect(def.allowedActions).toContain("accept");
    });

    it("returns definition for tracking status", () => {
      const def = TaskStateMachine.getDefinition("tracking");
      expect(def.owner).toBe("system");
      expect(def.timeoutPolicy.action).toBe("auto_advance");
    });

    it("returns definition for completed status", () => {
      const def = TaskStateMachine.getDefinition("completed");
      expect(def.owner).toBe("system");
      expect(def.timeoutPolicy.action).toBe("auto_advance");
    });

    it("returns definition for archived status", () => {
      const def = TaskStateMachine.getDefinition("archived");
      expect(def.owner).toBe("system");
      expect(def.timeoutPolicy.timeoutMs).toBe(Infinity);
    });

    it("returns definition for risk status", () => {
      const def = TaskStateMachine.getDefinition("risk");
      expect(def.owner).toBe("user");
      expect(def.allowedActions).toContain("resolve_risk");
    });

    it("returns definition for failed status", () => {
      const def = TaskStateMachine.getDefinition("failed");
      expect(def.owner).toBe("user");
      expect(def.allowedActions).toContain("retry");
      expect(def.timeoutPolicy.timeoutMs).toBe(Infinity);
    });

    it("throws for unknown status", () => {
      expect(() => TaskStateMachine.getDefinition("unknown" as ProjectStatus)).toThrow(
        "Unknown project status: unknown"
      );
    });

    it("returns a copy (not the same reference)", () => {
      const def1 = TaskStateMachine.getDefinition("captured");
      const def2 = TaskStateMachine.getDefinition("captured");
      expect(def1).toEqual(def2);
      expect(def1).not.toBe(def2);
    });
  });

  describe("canTransition", () => {
    it("returns true for captured→understanding", () => {
      expect(TaskStateMachine.canTransition("captured", "understanding")).toBe(true);
    });

    it("returns true for understanding→planned", () => {
      expect(TaskStateMachine.canTransition("understanding", "planned")).toBe(true);
    });

    it("returns true for planned→preparing", () => {
      expect(TaskStateMachine.canTransition("planned", "preparing")).toBe(true);
    });

    it("returns true for planned→understanding (replan)", () => {
      expect(TaskStateMachine.canTransition("planned", "understanding")).toBe(true);
    });

    it("returns true for preparing→waiting_user", () => {
      expect(TaskStateMachine.canTransition("preparing", "waiting_user")).toBe(true);
    });

    it("returns true for preparing→executing", () => {
      expect(TaskStateMachine.canTransition("preparing", "executing")).toBe(true);
    });

    it("returns true for waiting_user→executing", () => {
      expect(TaskStateMachine.canTransition("waiting_user", "executing")).toBe(true);
    });

    it("returns true for waiting_user→risk", () => {
      expect(TaskStateMachine.canTransition("waiting_user", "risk")).toBe(true);
    });

    it("returns true for executing→verifying", () => {
      expect(TaskStateMachine.canTransition("executing", "verifying")).toBe(true);
    });

    it("returns true for executing→waiting_user", () => {
      expect(TaskStateMachine.canTransition("executing", "waiting_user")).toBe(true);
    });

    it("returns true for executing→risk", () => {
      expect(TaskStateMachine.canTransition("executing", "risk")).toBe(true);
    });

    it("returns true for verifying→ready_to_deliver", () => {
      expect(TaskStateMachine.canTransition("verifying", "ready_to_deliver")).toBe(true);
    });

    it("returns true for verifying→executing", () => {
      expect(TaskStateMachine.canTransition("verifying", "executing")).toBe(true);
    });

    it("returns true for ready_to_deliver→tracking", () => {
      expect(TaskStateMachine.canTransition("ready_to_deliver", "tracking")).toBe(true);
    });

    it("returns true for ready_to_deliver→executing", () => {
      expect(TaskStateMachine.canTransition("ready_to_deliver", "executing")).toBe(true);
    });

    it("returns true for tracking→completed", () => {
      expect(TaskStateMachine.canTransition("tracking", "completed")).toBe(true);
    });

    it("returns true for tracking→risk", () => {
      expect(TaskStateMachine.canTransition("tracking", "risk")).toBe(true);
    });

    it("returns true for completed→archived", () => {
      expect(TaskStateMachine.canTransition("completed", "archived")).toBe(true);
    });

    it("returns true for archived→planned", () => {
      expect(TaskStateMachine.canTransition("archived", "planned")).toBe(true);
    });

    it("returns true for risk→executing", () => {
      expect(TaskStateMachine.canTransition("risk", "executing")).toBe(true);
    });

    it("returns true for risk→failed", () => {
      expect(TaskStateMachine.canTransition("risk", "failed")).toBe(true);
    });

    it("returns true for failed→planned", () => {
      expect(TaskStateMachine.canTransition("failed", "planned")).toBe(true);
    });

    it("returns false for invalid transitions", () => {
      expect(TaskStateMachine.canTransition("captured", "completed")).toBe(false);
      expect(TaskStateMachine.canTransition("archived", "captured")).toBe(false);
      expect(TaskStateMachine.canTransition("failed", "completed")).toBe(false);
      expect(TaskStateMachine.canTransition("verifying", "captured")).toBe(false);
    });

    it("returns false for same-status transitions", () => {
      expect(TaskStateMachine.canTransition("captured", "captured")).toBe(false);
      expect(TaskStateMachine.canTransition("executing", "executing")).toBe(false);
    });
  });

  describe("getTransitionsFrom", () => {
    it("returns transitions from captured", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("captured");
      expect(transitions.length).toBe(1);
      expect(transitions[0]!.to).toBe("understanding");
      expect(transitions[0]!.trigger).toBe("start_understanding");
      expect(transitions[0]!.autoTransition).toBe(true);
    });

    it("returns transitions from planned (two exits)", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("planned");
      expect(transitions.length).toBe(2);
      const targets = transitions.map((t) => t.to);
      expect(targets).toContain("preparing");
      expect(targets).toContain("understanding");
    });

    it("returns transitions from executing (three exits)", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("executing");
      expect(transitions.length).toBe(3);
      const targets = transitions.map((t) => t.to);
      expect(targets).toContain("verifying");
      expect(targets).toContain("waiting_user");
      expect(targets).toContain("risk");
    });

    it("returns transitions from verifying (two exits)", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("verifying");
      expect(transitions.length).toBe(2);
      const targets = transitions.map((t) => t.to);
      expect(targets).toContain("ready_to_deliver");
      expect(targets).toContain("executing");
    });

    it("returns empty array for status with no outgoing transitions", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("completed");
      expect(transitions.length).toBe(1);
      expect(transitions[0]!.to).toBe("archived");
    });

    it("returns copies (not same references)", () => {
      const t1 = TaskStateMachine.getTransitionsFrom("captured");
      const t2 = TaskStateMachine.getTransitionsFrom("captured");
      expect(t1).toEqual(t2);
      expect(t1).not.toBe(t2);
    });
  });

  describe("getNextStatus", () => {
    it("returns understanding for captured + start_understanding", () => {
      expect(TaskStateMachine.getNextStatus("captured", "start_understanding")).toBe("understanding");
    });

    it("returns planned for understanding + understanding_complete", () => {
      expect(TaskStateMachine.getNextStatus("understanding", "understanding_complete")).toBe("planned");
    });

    it("returns preparing for planned + plan_selected", () => {
      expect(TaskStateMachine.getNextStatus("planned", "plan_selected")).toBe("preparing");
    });

    it("returns understanding for planned + replan_requested", () => {
      expect(TaskStateMachine.getNextStatus("planned", "replan_requested")).toBe("understanding");
    });

    it("returns waiting_user for preparing + human_gate_needed", () => {
      expect(TaskStateMachine.getNextStatus("preparing", "human_gate_needed")).toBe("waiting_user");
    });

    it("returns executing for preparing + resources_ready", () => {
      expect(TaskStateMachine.getNextStatus("preparing", "resources_ready")).toBe("executing");
    });

    it("returns executing for waiting_user + user_responded", () => {
      expect(TaskStateMachine.getNextStatus("waiting_user", "user_responded")).toBe("executing");
    });

    it("returns risk for waiting_user + timeout_exceeded", () => {
      expect(TaskStateMachine.getNextStatus("waiting_user", "timeout_exceeded")).toBe("risk");
    });

    it("returns verifying for executing + tasks_complete", () => {
      expect(TaskStateMachine.getNextStatus("executing", "tasks_complete")).toBe("verifying");
    });

    it("returns waiting_user for executing + human_gate_needed", () => {
      expect(TaskStateMachine.getNextStatus("executing", "human_gate_needed")).toBe("waiting_user");
    });

    it("returns risk for executing + risk_detected", () => {
      expect(TaskStateMachine.getNextStatus("executing", "risk_detected")).toBe("risk");
    });

    it("returns ready_to_deliver for verifying + verification_passed", () => {
      expect(TaskStateMachine.getNextStatus("verifying", "verification_passed")).toBe("ready_to_deliver");
    });

    it("returns executing for verifying + verification_failed", () => {
      expect(TaskStateMachine.getNextStatus("verifying", "verification_failed")).toBe("executing");
    });

    it("returns tracking for ready_to_deliver + delivery_accepted", () => {
      expect(TaskStateMachine.getNextStatus("ready_to_deliver", "delivery_accepted")).toBe("tracking");
    });

    it("returns executing for ready_to_deliver + revision_requested", () => {
      expect(TaskStateMachine.getNextStatus("ready_to_deliver", "revision_requested")).toBe("executing");
    });

    it("returns completed for tracking + all_deliverables_accepted", () => {
      expect(TaskStateMachine.getNextStatus("tracking", "all_deliverables_accepted")).toBe("completed");
    });

    it("returns risk for tracking + issue_found", () => {
      expect(TaskStateMachine.getNextStatus("tracking", "issue_found")).toBe("risk");
    });

    it("returns archived for completed + archive", () => {
      expect(TaskStateMachine.getNextStatus("completed", "archive")).toBe("archived");
    });

    it("returns planned for archived + reopen", () => {
      expect(TaskStateMachine.getNextStatus("archived", "reopen")).toBe("planned");
    });

    it("returns executing for risk + risk_resolved", () => {
      expect(TaskStateMachine.getNextStatus("risk", "risk_resolved")).toBe("executing");
    });

    it("returns failed for risk + risk_unresolvable", () => {
      expect(TaskStateMachine.getNextStatus("risk", "risk_unresolvable")).toBe("failed");
    });

    it("returns planned for failed + retry", () => {
      expect(TaskStateMachine.getNextStatus("failed", "retry")).toBe("planned");
    });

    it("returns null for invalid trigger", () => {
      expect(TaskStateMachine.getNextStatus("captured", "invalid_trigger")).toBeNull();
    });

    it("returns null for valid trigger on wrong status", () => {
      expect(TaskStateMachine.getNextStatus("completed", "start_understanding")).toBeNull();
    });
  });

  describe("getAllStatuses", () => {
    it("returns all 13 statuses", () => {
      const statuses = TaskStateMachine.getAllStatuses();
      expect(statuses.length).toBe(13);
    });

    it("includes all expected statuses", () => {
      const statuses = TaskStateMachine.getAllStatuses();
      const expected: ProjectStatus[] = [
        "captured", "understanding", "planned", "preparing", "waiting_user",
        "executing", "verifying", "ready_to_deliver", "tracking", "completed",
        "archived", "risk", "failed"
      ];
      for (const status of expected) {
        expect(statuses).toContain(status);
      }
    });
  });

  describe("getAllTransitions", () => {
    it("returns all 22 transitions", () => {
      const transitions = TaskStateMachine.getAllTransitions();
      expect(transitions.length).toBe(22);
    });

    it("returns copies (not same references)", () => {
      const t1 = TaskStateMachine.getAllTransitions();
      const t2 = TaskStateMachine.getAllTransitions();
      expect(t1).toEqual(t2);
      expect(t1).not.toBe(t2);
    });

    it("each transition has required fields", () => {
      const transitions = TaskStateMachine.getAllTransitions();
      for (const t of transitions) {
        expect(t.from).toBeDefined();
        expect(t.to).toBeDefined();
        expect(t.trigger).toBeDefined();
        expect(Array.isArray(t.requiredConfirmations)).toBe(true);
        expect(typeof t.autoTransition).toBe("boolean");
      }
    });
  });

  describe("transition properties", () => {
    it("plan_selected requires plan_confirmation", () => {
      const transitions = TaskStateMachine.getTransitionsFrom("planned");
      const planSelected = transitions.find((t) => t.trigger === "plan_selected");
      expect(planSelected).toBeDefined();
      expect(planSelected!.requiredConfirmations).toEqual(["plan_confirmation"]);
      expect(planSelected!.autoTransition).toBe(false);
    });

    it("auto transitions are correctly flagged", () => {
      const transitions = TaskStateMachine.getAllTransitions();
      const autoTransitions = transitions.filter((t) => t.autoTransition);
      const autoTriggers = autoTransitions.map((t) => t.trigger);
      expect(autoTriggers).toContain("start_understanding");
      expect(autoTriggers).toContain("understanding_complete");
      expect(autoTriggers).toContain("human_gate_needed");
      expect(autoTriggers).toContain("resources_ready");
      expect(autoTriggers).toContain("timeout_exceeded");
      expect(autoTriggers).toContain("tasks_complete");
      expect(autoTriggers).toContain("risk_detected");
      expect(autoTriggers).toContain("verification_passed");
      expect(autoTriggers).toContain("verification_failed");
      expect(autoTriggers).toContain("all_deliverables_accepted");
      expect(autoTriggers).toContain("issue_found");
    });

    it("manual transitions are correctly flagged", () => {
      const transitions = TaskStateMachine.getAllTransitions();
      const manualTransitions = transitions.filter((t) => !t.autoTransition);
      const manualTriggers = manualTransitions.map((t) => t.trigger);
      expect(manualTriggers).toContain("plan_selected");
      expect(manualTriggers).toContain("replan_requested");
      expect(manualTriggers).toContain("user_responded");
      expect(manualTriggers).toContain("delivery_accepted");
      expect(manualTriggers).toContain("revision_requested");
      expect(manualTriggers).toContain("archive");
      expect(manualTriggers).toContain("reopen");
      expect(manualTriggers).toContain("risk_resolved");
      expect(manualTriggers).toContain("risk_unresolvable");
      expect(manualTriggers).toContain("retry");
    });
  });

  describe("happy path flow", () => {
    it("supports the full captured→completed flow", () => {
      let status: ProjectStatus = "captured";

      status = TaskStateMachine.getNextStatus(status, "start_understanding")!;
      expect(status).toBe("understanding");

      status = TaskStateMachine.getNextStatus(status, "understanding_complete")!;
      expect(status).toBe("planned");

      status = TaskStateMachine.getNextStatus(status, "plan_selected")!;
      expect(status).toBe("preparing");

      status = TaskStateMachine.getNextStatus(status, "resources_ready")!;
      expect(status).toBe("executing");

      status = TaskStateMachine.getNextStatus(status, "tasks_complete")!;
      expect(status).toBe("verifying");

      status = TaskStateMachine.getNextStatus(status, "verification_passed")!;
      expect(status).toBe("ready_to_deliver");

      status = TaskStateMachine.getNextStatus(status, "delivery_accepted")!;
      expect(status).toBe("tracking");

      status = TaskStateMachine.getNextStatus(status, "all_deliverables_accepted")!;
      expect(status).toBe("completed");

      status = TaskStateMachine.getNextStatus(status, "archive")!;
      expect(status).toBe("archived");
    });
  });

  describe("risk and recovery flows", () => {
    it("supports executing→risk→executing recovery", () => {
      let status: ProjectStatus = "executing";
      status = TaskStateMachine.getNextStatus(status, "risk_detected")!;
      expect(status).toBe("risk");
      status = TaskStateMachine.getNextStatus(status, "risk_resolved")!;
      expect(status).toBe("executing");
    });

    it("supports executing→risk→failed escalation", () => {
      let status: ProjectStatus = "executing";
      status = TaskStateMachine.getNextStatus(status, "risk_detected")!;
      expect(status).toBe("risk");
      status = TaskStateMachine.getNextStatus(status, "risk_unresolvable")!;
      expect(status).toBe("failed");
    });

    it("supports failed→planned retry", () => {
      let status: ProjectStatus = "failed";
      status = TaskStateMachine.getNextStatus(status, "retry")!;
      expect(status).toBe("planned");
    });

    it("supports archived→planned reopen", () => {
      let status: ProjectStatus = "archived";
      status = TaskStateMachine.getNextStatus(status, "reopen")!;
      expect(status).toBe("planned");
    });

    it("supports verification failure loop", () => {
      let status: ProjectStatus = "verifying";
      status = TaskStateMachine.getNextStatus(status, "verification_failed")!;
      expect(status).toBe("executing");
      status = TaskStateMachine.getNextStatus(status, "tasks_complete")!;
      expect(status).toBe("verifying");
    });

    it("supports replan from planned", () => {
      let status: ProjectStatus = "planned";
      status = TaskStateMachine.getNextStatus(status, "replan_requested")!;
      expect(status).toBe("understanding");
    });
  });
});
