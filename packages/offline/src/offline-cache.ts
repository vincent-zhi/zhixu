import type { OfflineCacheEntry } from "./types.js";

export class OfflineCacheManager {
  private cache = new Map<string, OfflineCacheEntry>();
  private deviceId = crypto.randomUUID();

  get(key: string): OfflineCacheEntry | null {
    return this.cache.get(key) ?? null;
  }

  set(key: string, data: unknown, options?: { expiresAt?: string; encrypted?: boolean }): OfflineCacheEntry {
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
    this.cache.set(key, entry);
    return entry;
  }

  delete(key: string): boolean {
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
