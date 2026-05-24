import type { PendingOperation, OfflineCacheEntry, SyncResult } from "./types.js";
import { OfflineCacheManager } from "./offline-cache.js";
import { ConflictResolver } from "./conflict-resolver.js";

export class SyncEngine {
  private resolver = new ConflictResolver();

  syncToLocal(operations: PendingOperation[], cache: OfflineCacheManager): SyncResult {
    let applied = 0;
    let failed = 0;
    const conflicts: SyncResult["conflicts"] = [];

    for (const op of operations) {
      try {
        switch (op.operationType) {
          case "create":
          case "update":
            cache.set(`${op.entityType}:${op.entityId}`, op.payload);
            applied++;
            break;
          case "delete":
            cache.delete(`${op.entityType}:${op.entityId}`);
            applied++;
            break;
        }
      } catch {
        failed++;
      }
    }

    return {
      applied,
      conflicts,
      failed,
      totalOperations: operations.length,
    };
  }

  syncToRemote(cache: OfflineCacheManager, remoteEntries: OfflineCacheEntry[]): SyncResult {
    let applied = 0;
    let failed = 0;
    const conflicts: SyncResult["conflicts"] = [];

    for (const remoteEntry of remoteEntries) {
      const localEntry = cache.get(remoteEntry.key);
      if (localEntry) {
        const conflict = this.resolver.detectConflict(localEntry, remoteEntry);
        if (conflict) {
          const resolved = this.resolver.resolveConflict(conflict, "remote_wins");
          conflicts.push(resolved);
          const options: { expiresAt?: string; encrypted?: boolean } = { encrypted: remoteEntry.encrypted };
          if (remoteEntry.expiresAt) options.expiresAt = remoteEntry.expiresAt;
          cache.set(remoteEntry.key, remoteEntry.data, options);
          applied++;
        } else {
          applied++;
        }
      } else {
        const options: { expiresAt?: string; encrypted?: boolean } = { encrypted: remoteEntry.encrypted };
        if (remoteEntry.expiresAt) options.expiresAt = remoteEntry.expiresAt;
        cache.set(remoteEntry.key, remoteEntry.data, options);
        applied++;
      }
    }

    return {
      applied,
      conflicts,
      failed,
      totalOperations: remoteEntries.length,
    };
  }
}
