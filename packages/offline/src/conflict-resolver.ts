import type { OfflineCacheEntry, ConflictRecord } from "./types.js";

export class ConflictResolver {
  detectConflict(local: OfflineCacheEntry, remote: OfflineCacheEntry): ConflictRecord | null {
    if (local.key !== remote.key) return null;
    if (local.version === remote.version && local.deviceId === remote.deviceId) return null;
    if (local.deviceId === remote.deviceId) return null;

    return {
      id: crypto.randomUUID(),
      entityType: "cache_entry",
      entityId: local.key,
      localVersion: {
        version: local.version,
        data: local.data,
        deviceId: local.deviceId,
        updatedAt: local.updatedAt,
      },
      remoteVersion: {
        version: remote.version,
        data: remote.data,
        deviceId: remote.deviceId,
        updatedAt: remote.updatedAt,
      },
      suggestedMerge: this.autoMerge(
        local.data as Record<string, unknown>,
        remote.data as Record<string, unknown>,
      ),
      resolution: "unresolved",
      resolvedAt: null,
      resolvedBy: null,
    };
  }

  resolveConflict(
    conflict: ConflictRecord,
    strategy: "local_wins" | "remote_wins" | "merge",
  ): ConflictRecord {
    const resolved = { ...conflict };

    switch (strategy) {
      case "local_wins":
        resolved.resolution = "local_wins";
        break;
      case "remote_wins":
        resolved.resolution = "remote_wins";
        break;
      case "merge":
        resolved.resolution = "merged";
        break;
    }

    resolved.resolvedAt = new Date().toISOString();
    resolved.resolvedBy = "system";
    return resolved;
  }

  autoMerge(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...local };
    for (const [key, value] of Object.entries(remote)) {
      if (key in merged) {
        merged[key] = value;
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }
}
