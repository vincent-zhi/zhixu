export interface OfflineCacheEntry {
  key: string;
  data: unknown;
  version: number;
  deviceId: string;
  updatedAt: string;
  expiresAt: string | null;
  encrypted: boolean;
}

export type CachedItem = OfflineCacheEntry;

export interface PendingOperation {
  id: string;
  entityType: string;
  entityId: string;
  operationType: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  deviceId: string;
  timestamp: string;
  retryCount: number;
  status: "pending" | "syncing" | "conflicted" | "applied" | "failed";
}

export interface ConflictRecord {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: { version: number; data: unknown; deviceId: string; updatedAt: string };
  remoteVersion: { version: number; data: unknown; deviceId: string; updatedAt: string };
  suggestedMerge: unknown | null;
  resolution: "local_wins" | "remote_wins" | "merged" | "unresolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface SyncResult {
  applied: number;
  conflicts: ConflictRecord[];
  failed: number;
  totalOperations: number;
}
