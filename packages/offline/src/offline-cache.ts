import type { OfflineCacheEntry, CachedItem } from "./types.js";

export interface OfflineStore {
  getCached(key: string): Promise<CachedItem | null>;
  setCached(key: string, item: CachedItem): Promise<void>;
  removeCached(key: string): Promise<void>;
}

export class OfflineCacheManager {
  private cache = new Map<string, OfflineCacheEntry>();
  private deviceId = crypto.randomUUID();

  constructor(private store?: OfflineStore) {}

  async get(key: string): Promise<OfflineCacheEntry | null> {
    if (this.store) {
      return this.store.getCached(key);
    }
    return this.cache.get(key) ?? null;
  }

  async set(key: string, data: unknown, options?: { expiresAt?: string; encrypted?: boolean }): Promise<OfflineCacheEntry> {
    const existing = this.cache.get(key);
    const version = existing ? existing.version + 1 : 1;
    const entry: OfflineCacheEntry = {
      key,
      data,
      version,
      deviceId: this.deviceId,
      updatedAt: new Date().toISOString(),
      expiresAt: options?.expiresAt ?? null,
      encrypted: options?.encrypted ?? false,
    };

    if (this.store) {
      await this.store.setCached(key, entry);
    } else {
      this.cache.set(key, entry);
    }

    return entry;
  }

  async delete(key: string): Promise<boolean> {
    if (this.store) {
      const exists = this.cache.has(key);
      await this.store.removeCached(key);
      this.cache.delete(key);
      return exists;
    }
    return this.cache.delete(key);
  }

  listKeys(): string[] {
    return [...this.cache.keys()];
  }

  cleanup(): number {
    const now = new Date();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  exportAll(): OfflineCacheEntry[] {
    return [...this.cache.values()];
  }

  importAll(entries: OfflineCacheEntry[]): number {
    let imported = 0;
    for (const entry of entries) {
      const existing = this.cache.get(entry.key);
      if (!existing || entry.version > existing.version) {
        this.cache.set(entry.key, entry);
        imported++;
      }
    }
    return imported;
  }
}
