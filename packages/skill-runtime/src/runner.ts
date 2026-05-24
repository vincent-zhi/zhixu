import type { SkillManifest } from "./definition.js";
import { PermissionChecker } from "./permission.js";
import { SandboxPolicy } from "./sandbox.js";
import type { AgentOutput } from "@zhixu/core";

export class HumanGateRequiredError extends Error {
  readonly skillId: string;
  readonly missingScopes: string[];
  readonly riskLevel: string;

  constructor(skillId: string, missingScopes: string[], riskLevel: string) {
    super(`Skill ${skillId} requires Human Gate confirmation for scopes: ${missingScopes.join(", ")}`);
    this.name = "HumanGateRequiredError";
    this.skillId = skillId;
    this.missingScopes = missingScopes;
    this.riskLevel = riskLevel;
  }
}

export interface SkillExecutionContext {
  userId: string;
  projectId: string;
  input: Record<string, unknown>;
}

export interface SkillExecutionResult {
  output: AgentOutput;
  durationMs: number;
  costEstimate: { provider: string; model: string; inputTokens: number; outputTokens: number; estimatedUsd: number };
}

export type SkillHandler = (context: SkillExecutionContext) => Promise<AgentOutput>;

export class SkillInvocationRunner {
  private readonly handlers = new Map<string, SkillHandler>();

  constructor(
    private readonly permissionChecker: PermissionChecker,
    private readonly sandboxPolicy: SandboxPolicy
  ) {}

  registerHandler(skillId: string, handler: SkillHandler): void {
    this.handlers.set(skillId, handler);
  }

  async invoke(manifest: SkillManifest, context: SkillExecutionContext): Promise<SkillExecutionResult> {
    const start = Date.now();

    for (const permission of manifest.permissions) {
      const validation = this.sandboxPolicy.validateScope(permission.scope);
      if (!validation.allowed) {
        throw new Error(`Sandbox policy denied scope: ${permission.scope} (${validation.reason})`);
      }
    }

    const permCheck = this.permissionChecker.checkSkillPermissions(
      manifest,
      context.userId,
      context.projectId
    );

    if (!permCheck.allowed) {
      if (permCheck.requiresHumanGate) {
        throw new HumanGateRequiredError(manifest.id, permCheck.missingScopes, manifest.riskLevel);
      }
      throw new Error(`Missing permissions for skill ${manifest.id}: ${permCheck.missingScopes.join(", ")}`);
    }

    const handler = this.handlers.get(manifest.id);
    if (!handler) {
      throw new Error(`No handler registered for skill: ${manifest.id}`);
    }

    const output = await handler(context);
    const durationMs = Date.now() - start;

    return {
      output,
      durationMs,
      costEstimate: output.costEstimate
    };
  }
}
