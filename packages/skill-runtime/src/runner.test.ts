import { describe, expect, it } from "vitest";
import { PermissionChecker, type PermissionGrant } from "./permission.js";
import { SandboxPolicy, DENIED_BY_DEFAULT, HIGH_RISK_BLACKLIST } from "./sandbox.js";
import { SkillInvocationRunner, HumanGateRequiredError, type SkillHandler } from "./runner.js";
import type { SkillManifest, SkillPermission } from "./definition.js";
import type { AgentOutput } from "@zhixu/core";

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: "skill_test",
    name: "test.skill",
    provider: "zhixu",
    version: "1.0.0",
    description: "A test skill",
    permissions: [
      { scope: "read_project_source", description: "Read sources", riskLevel: "L1" as const, defaultGranted: true }
    ],
    riskLevel: "L1" as const,
    runtimeType: "native",
    inputSchema: {},
    outputSchema: {},
    ...overrides
  };
}

function makeAgentOutput(overrides: Partial<AgentOutput> = {}): AgentOutput {
  return {
    outputType: "test",
    structuredResult: {},
    confidence: 0.9,
    requiredConfirmations: [],
    evidenceRefs: [],
    riskFlags: [],
    nextActions: [],
    costEstimate: {
      provider: "test",
      model: "test-model",
      inputTokens: 100,
      outputTokens: 50,
      estimatedUsd: 0.001
    },
    ...overrides
  };
}

describe("PermissionChecker", () => {
  it("grants and checks permission", () => {
    const checker = new PermissionChecker();
    const grant: PermissionGrant = {
      skillId: "skill_test",
      userId: "user1",
      projectId: "proj1",
      grantedScopes: ["read_project_source"],
      riskLevel: "L1"
    };
    checker.grantPermission(grant);
    expect(checker.hasPermission("skill_test", "user1", "proj1", "read_project_source")).toBe(true);
    expect(checker.hasPermission("skill_test", "user1", "proj1", "write_project_index")).toBe(false);
  });

  it("revokes permission", () => {
    const checker = new PermissionChecker();
    const grant: PermissionGrant = {
      skillId: "skill_test",
      userId: "user1",
      projectId: "proj1",
      grantedScopes: ["read_project_source"],
      riskLevel: "L1"
    };
    checker.grantPermission(grant);
    expect(checker.hasPermission("skill_test", "user1", "proj1", "read_project_source")).toBe(true);
    checker.revokePermission("skill_test", "user1", "proj1");
    expect(checker.hasPermission("skill_test", "user1", "proj1", "read_project_source")).toBe(false);
  });

  it("returns false for expired grants", () => {
    const checker = new PermissionChecker();
    const grant: PermissionGrant = {
      skillId: "skill_test",
      userId: "user1",
      projectId: "proj1",
      grantedScopes: ["read_project_source"],
      riskLevel: "L1",
      expiresAt: new Date(Date.now() - 1000)
    };
    checker.grantPermission(grant);
    expect(checker.hasPermission("skill_test", "user1", "proj1", "read_project_source")).toBe(false);
  });

  it("returns false for non-existent grant", () => {
    const checker = new PermissionChecker();
    expect(checker.hasPermission("skill_test", "user1", "proj1", "read_project_source")).toBe(false);
  });

  it("checkSkillPermissions allows when all non-default permissions are granted", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true },
        { scope: "write_project_index", description: "Write", riskLevel: "L1" as const, defaultGranted: false }
      ]
    });
    checker.grantPermission({
      skillId: "skill_test",
      userId: "user1",
      projectId: "proj1",
      grantedScopes: ["write_project_index"],
      riskLevel: "L1"
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.allowed).toBe(true);
    expect(result.missingScopes).toEqual([]);
  });

  it("checkSkillPermissions reports missing scopes", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true },
        { scope: "write_project_index", description: "Write", riskLevel: "L2" as const, defaultGranted: false }
      ]
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.allowed).toBe(false);
    expect(result.missingScopes).toEqual(["write_project_index"]);
  });

  it("checkSkillPermissions sets requiresHumanGate for L2 permissions", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true },
        { scope: "write_project_index", description: "Write", riskLevel: "L2" as const, defaultGranted: false }
      ]
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.requiresHumanGate).toBe(true);
  });

  it("checkSkillPermissions sets requiresHumanGate for L3 permissions", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L3" as const, defaultGranted: false }
      ]
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.requiresHumanGate).toBe(true);
  });

  it("checkSkillPermissions does not require human gate for L1-only permissions", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true }
      ],
      riskLevel: "L1" as const
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.requiresHumanGate).toBe(false);
  });

  it("skips defaultGranted permissions in missing scopes", () => {
    const checker = new PermissionChecker();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true },
        { scope: "write_project_index", description: "Write", riskLevel: "L1" as const, defaultGranted: true }
      ]
    });
    const result = checker.checkSkillPermissions(manifest, "user1", "proj1");
    expect(result.allowed).toBe(true);
    expect(result.missingScopes).toEqual([]);
  });
});

describe("SandboxPolicy", () => {
  const policy = new SandboxPolicy();

  it("identifies denied-by-default scopes", () => {
    for (const scope of DENIED_BY_DEFAULT) {
      expect(policy.isDeniedByDefault(scope)).toBe(true);
    }
    expect(policy.isDeniedByDefault("read_project_source")).toBe(false);
  });

  it("identifies high-risk blacklisted scopes", () => {
    for (const scope of HIGH_RISK_BLACKLIST) {
      expect(policy.isHighRiskBlacklisted(scope)).toBe(true);
    }
    expect(policy.isHighRiskBlacklisted("read_project_source")).toBe(false);
  });

  it("validateScope rejects high-risk blacklisted scopes", () => {
    const result = policy.validateScope("auto_submit_assignment");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("HIGH_RISK_BLACKLISTED");
  });

  it("validateScope rejects denied-by-default scopes", () => {
    const result = policy.validateScope("read_all_files");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("DENIED_BY_DEFAULT");
  });

  it("validateScope allows normal scopes", () => {
    const result = policy.validateScope("read_project_source");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("prioritizes high-risk blacklist over denied-by-default", () => {
    expect(policy.validateScope("auto_submit_assignment").reason).toBe("HIGH_RISK_BLACKLISTED");
  });
});

describe("SkillInvocationRunner", () => {
  function makeRunner() {
    const permissionChecker = new PermissionChecker();
    const sandboxPolicy = new SandboxPolicy();
    const runner = new SkillInvocationRunner(permissionChecker, sandboxPolicy);
    return { runner, permissionChecker, sandboxPolicy };
  }

  it("successfully invokes a skill with all permissions", async () => {
    const { runner, permissionChecker } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true }
      ],
      riskLevel: "L1" as const
    });
    const output = makeAgentOutput();
    const handler: SkillHandler = async () => output;
    runner.registerHandler("skill_test", handler);

    const result = await runner.invoke(manifest, {
      userId: "user1",
      projectId: "proj1",
      input: {}
    });

    expect(result.output).toEqual(output);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.costEstimate).toEqual(output.costEstimate);
  });

  it("throws error for missing permissions without human gate", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: false }
      ],
      riskLevel: "L1" as const
    });
    runner.registerHandler("skill_test", async () => makeAgentOutput());

    await expect(
      runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} })
    ).rejects.toThrow("Missing permissions for skill skill_test: read_project_source");
  });

  it("throws HumanGateRequiredError when L2 permission is missing", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "write_project_index", description: "Write", riskLevel: "L2" as const, defaultGranted: false }
      ],
      riskLevel: "L2" as const
    });
    runner.registerHandler("skill_test", async () => makeAgentOutput());

    await expect(
      runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} })
    ).rejects.toThrow(HumanGateRequiredError);
  });

  it("HumanGateRequiredError contains correct metadata", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "write_project_index", description: "Write", riskLevel: "L2" as const, defaultGranted: false }
      ],
      riskLevel: "L2" as const
    });
    runner.registerHandler("skill_test", async () => makeAgentOutput());

    try {
      await runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(HumanGateRequiredError);
      const gateError = error as HumanGateRequiredError;
      expect(gateError.skillId).toBe("skill_test");
      expect(gateError.missingScopes).toEqual(["write_project_index"]);
      expect(gateError.riskLevel).toBe("L2");
    }
  });

  it("throws sandbox denial for denied-by-default scope", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_all_files", description: "Read all", riskLevel: "L1" as const, defaultGranted: true }
      ],
      riskLevel: "L1" as const
    });
    runner.registerHandler("skill_test", async () => makeAgentOutput());

    await expect(
      runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} })
    ).rejects.toThrow("Sandbox policy denied scope: read_all_files (DENIED_BY_DEFAULT)");
  });

  it("throws sandbox denial for high-risk blacklisted scope", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "auto_submit_assignment", description: "Auto submit", riskLevel: "L3" as const, defaultGranted: false }
      ],
      riskLevel: "L3" as const
    });
    runner.registerHandler("skill_test", async () => makeAgentOutput());

    await expect(
      runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} })
    ).rejects.toThrow("Sandbox policy denied scope: auto_submit_assignment (HIGH_RISK_BLACKLISTED)");
  });

  it("throws error for unregistered handler", async () => {
    const { runner } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true }
      ],
      riskLevel: "L1" as const
    });

    await expect(
      runner.invoke(manifest, { userId: "user1", projectId: "proj1", input: {} })
    ).rejects.toThrow("No handler registered for skill: skill_test");
  });

  it("allows invocation when non-default permissions are explicitly granted", async () => {
    const { runner, permissionChecker } = makeRunner();
    const manifest = makeManifest({
      permissions: [
        { scope: "read_project_source", description: "Read", riskLevel: "L1" as const, defaultGranted: true },
        { scope: "write_project_index", description: "Write", riskLevel: "L1" as const, defaultGranted: false }
      ],
      riskLevel: "L1" as const
    });
    permissionChecker.grantPermission({
      skillId: "skill_test",
      userId: "user1",
      projectId: "proj1",
      grantedScopes: ["write_project_index"],
      riskLevel: "L1"
    });
    const output = makeAgentOutput();
    runner.registerHandler("skill_test", async () => output);

    const result = await runner.invoke(manifest, {
      userId: "user1",
      projectId: "proj1",
      input: {}
    });
    expect(result.output).toEqual(output);
  });
});
