import type { VersionSnapshot, ArtifactVersion, BlockDiff, VersionDiffResult } from "./types.js";

let versionCounter = 0;

function nextVersionId(): string {
  versionCounter += 1;
  return `v_${versionCounter}_${Date.now()}`;
}

export interface VersionStore {
  getVersions(artifactId: string): Promise<ArtifactVersion[]>;
  saveVersion(version: ArtifactVersion): Promise<void>;
}

export class VersionManager {
  private history: Map<string, VersionSnapshot[]> = new Map();

  constructor(private store?: VersionStore) {}

  private entityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  async createSnapshot(
    entityType: string,
    entityId: string,
    projectId: string,
    currentData: Record<string, unknown>,
    createdBy: string,
    reason?: string
  ): Promise<VersionSnapshot> {
    const key = this.entityKey(entityType, entityId);

    let previous: VersionSnapshot | null = null;
    if (this.store) {
      const versions = await this.store.getVersions(key);
      previous = versions[versions.length - 1] ?? null;
    } else {
      const existing = this.history.get(key);
      previous = existing?.[existing.length - 1] ?? null;
    }

    let diffFromPrevious: Record<string, unknown> | null = null;
    if (previous) {
      diffFromPrevious = this.computeSimpleDiff(previous.snapshotJson, currentData);
    }

    const snapshot: VersionSnapshot = {
      versionId: nextVersionId(),
      entityType,
      entityId,
      projectId,
      snapshotJson: currentData,
      diffFromPrevious,
      createdBy,
      createdReason: reason ?? "",
      createdAt: new Date().toISOString()
    };

    if (this.store) {
      await this.store.saveVersion(snapshot);
    } else {
      const list = this.history.get(key) ?? [];
      list.push(snapshot);
      this.history.set(key, list);
    }

    return snapshot;
  }

  diffVersions(from: VersionSnapshot, to: VersionSnapshot): VersionDiffResult {
    const fromBlocks = this.extractBlocks(from.snapshotJson);
    const toBlocks = this.extractBlocks(to.snapshotJson);

    const fromMap = new Map(fromBlocks.map((b) => [b.id, b.data]));
    const toMap = new Map(toBlocks.map((b) => [b.id, b.data]));

    const allIds = new Set<string>([...fromMap.keys(), ...toMap.keys()]);

    const blockDiffs: BlockDiff[] = [];
    let added = 0;
    let removed = 0;
    let modified = 0;
    let unchanged = 0;

    for (const id of allIds) {
      const inFrom = fromMap.has(id);
      const inTo = toMap.has(id);

      if (!inFrom && inTo) {
        blockDiffs.push({ blockId: id, blockType: "added", changes: [] });
        added += 1;
      } else if (inFrom && !inTo) {
        blockDiffs.push({ blockId: id, blockType: "removed", changes: [] });
        removed += 1;
      } else {
        const fromData = fromMap.get(id)!;
        const toData = toMap.get(id)!;
        const changes = this.computeFieldChanges(fromData, toData);

        if (changes.length > 0) {
          blockDiffs.push({ blockId: id, blockType: "modified", changes });
          modified += 1;
        } else {
          blockDiffs.push({ blockId: id, blockType: "unchanged", changes: [] });
          unchanged += 1;
        }
      }
    }

    return {
      fromVersionId: from.versionId,
      toVersionId: to.versionId,
      blockDiffs,
      summary: { added, removed, modified, unchanged }
    };
  }

  async getVersionHistory(entityType: string, entityId: string): Promise<VersionSnapshot[]> {
    const key = this.entityKey(entityType, entityId);
    if (this.store) {
      return this.store.getVersions(key);
    }
    return this.history.get(key) ?? [];
  }

  rollbackToVersion(targetVersion: VersionSnapshot): Record<string, unknown> {
    return targetVersion.snapshotJson;
  }

  private extractBlocks(data: Record<string, unknown>): Array<{ id: string; data: Record<string, unknown> }> {
    const blocks: Array<{ id: string; data: Record<string, unknown> }> = [];

    if (Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (block && typeof block === "object" && "id" in block) {
          blocks.push({
            id: String(block.id),
            data: block as Record<string, unknown>
          });
        }
      }
    }

    if (blocks.length === 0) {
      blocks.push({ id: "__root__", data });
    }

    return blocks;
  }

  private computeSimpleDiff(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): Record<string, unknown> {
    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(current)) {
      if (previous[key] !== current[key]) {
        diff[key] = { from: previous[key], to: current[key] };
      }
    }
    for (const key of Object.keys(previous)) {
      if (!(key in current)) {
        diff[key] = { from: previous[key], to: undefined };
      }
    }
    return diff;
  }

  private computeFieldChanges(
    fromData: Record<string, unknown>,
    toData: Record<string, unknown>
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const allFields = new Set<string>([...Object.keys(fromData), ...Object.keys(toData)]);

    for (const field of allFields) {
      const oldVal = fromData[field];
      const newVal = toData[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }

    return changes;
  }
}
