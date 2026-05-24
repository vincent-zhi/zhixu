import type { SkillManifest, SkillPermission } from "./definition.js";
import type { RiskLevel } from "@zhixu/core";

export interface PermissionGrant {
  skillId: string;
  userId: string;
  projectId: string;
  grantedScopes: string[];
  riskLevel: RiskLevel;
  expiresAt?: Date;
}

export class PermissionChecker {
  private readonly grants = new Map<string, PermissionGrant>();

  grantPermission(grant: PermissionGrant): void {
    this.grants.set(`${grant.skillId}:${grant.userId}:${grant.projectId}`, grant);
  }

  revokePermission(skillId: string, userId: string, projectId: string): void {
    this.grants.delete(`${skillId}:${userId}:${projectId}`);
  }

  hasPermission(skillId: string, userId: string, projectId: string, scope: string): boolean {
    const grant = this.grants.get(`${skillId}:${userId}:${projectId}`);
    if (!grant) return false;
    if (grant.expiresAt && grant.expiresAt < new Date()) return false;
    return grant.grantedScopes.includes(scope);
  }

  checkSkillPermissions(manifest: SkillManifest, userId: string, projectId: string): {
    allowed: boolean;
    missingScopes: string[];
    requiresHumanGate: boolean;
  } {
    const missingScopes: string[] = [];
    let requiresHumanGate = false;

    for (const permission of manifest.permissions) {
      if (permission.defaultGranted) continue;
      if (!this.hasPermission(manifest.id, userId, projectId, permission.scope)) {
        missingScopes.push(permission.scope);
      }
      if (permission.riskLevel === "L2" || permission.riskLevel === "L3") {
        requiresHumanGate = true;
      }
    }

    return {
      allowed: missingScopes.length === 0,
      missingScopes,
      requiresHumanGate
    };
  }
}
