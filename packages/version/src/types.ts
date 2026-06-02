import { z } from "zod";

export const VersionSnapshotSchema = z.object({
  versionId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  projectId: z.string(),
  snapshotJson: z.record(z.string(), z.unknown()),
  diffFromPrevious: z.record(z.string(), z.unknown()).nullable(),
  createdBy: z.string(),
  createdReason: z.string().default(""),
  createdAt: z.string()
});

export const BlockDiffSchema = z.object({
  blockId: z.string(),
  blockType: z.enum(["added", "removed", "modified", "unchanged"]),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.unknown(),
    newValue: z.unknown()
  }))
});

export const VersionDiffResultSchema = z.object({
  fromVersionId: z.string(),
  toVersionId: z.string(),
  blockDiffs: z.array(BlockDiffSchema),
  summary: z.object({
    added: z.number(),
    removed: z.number(),
    modified: z.number(),
    unchanged: z.number()
  })
});

export type VersionSnapshot = z.infer<typeof VersionSnapshotSchema>;
export type BlockDiff = z.infer<typeof BlockDiffSchema>;
export type VersionDiffResult = z.infer<typeof VersionDiffResultSchema>;
export type ArtifactVersion = VersionSnapshot;
