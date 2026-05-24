import type { MemoryQuery, MemoryResult, MemoryItem } from "./types.js";

export class MemoryManager {
  private memoryStore: Map<string, MemoryItem> = new Map();
  private nextId = 1;

  query(query: MemoryQuery): MemoryResult {
    const matched: MemoryItem[] = [];
    const queryLower = query.query.toLowerCase();

    for (const item of this.memoryStore.values()) {
      if (item.type !== query.queryType && query.queryType !== "capsule") {
        continue;
      }

      const contentStr = JSON.stringify(item.content).toLowerCase();
      if (contentStr.includes(queryLower) || item.source.toLowerCase().includes(queryLower)) {
        matched.push(item);
      }
    }

    const relevanceScore = matched.length > 0
      ? Math.min(1, matched.length * 0.3 + 0.4)
      : 0;

    return { items: matched, relevanceScore };
  }

  store(item: Omit<MemoryItem, "id" | "createdAt">): MemoryItem {
    const id = `mem_${this.nextId++}`;
    const memoryItem: MemoryItem = {
      id,
      type: item.type,
      content: item.content,
      source: item.source,
      createdAt: new Date().toISOString()
    };

    this.memoryStore.set(id, memoryItem);
    return memoryItem;
  }
}
