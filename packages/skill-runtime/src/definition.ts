import { z } from "zod";
import { RiskLevelSchema } from "@zhixu/core";

export const SkillPermissionSchema = z.object({
  scope: z.string(),
  description: z.string(),
  riskLevel: RiskLevelSchema,
  defaultGranted: z.boolean().default(false)
});

export const SkillManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  version: z.string().default("1.0.0"),
  description: z.string(),
  permissions: z.array(SkillPermissionSchema),
  riskLevel: RiskLevelSchema,
  runtimeType: z.enum(["native", "workflow", "sandbox", "external_api", "local_only"]),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
  outputSchema: z.record(z.string(), z.unknown()).default({})
});

export type SkillPermission = z.infer<typeof SkillPermissionSchema>;
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
