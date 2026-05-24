import type { SharedKnowledgebase, KnowledgebaseEntry } from "./types.js";

export class SharedKnowledgebaseManager {
  createKnowledgebase(input: {
    workspaceId: string;
    name: string;
    accessPolicy: SharedKnowledgebase["accessPolicy"];
  }): SharedKnowledgebase {
    return {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      entries: [],
      accessPolicy: input.accessPolicy,
      createdAt: new Date().toISOString(),
    };
  }

  addEntry(
    kb: SharedKnowledgebase,
    entry: Omit<KnowledgebaseEntry, "id" | "createdAt">
  ): KnowledgebaseEntry {
    const newEntry: KnowledgebaseEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    kb.entries.push(newEntry);
    return newEntry;
  }

  searchEntries(kb: SharedKnowledgebase, query: string): KnowledgebaseEntry[] {
    const lower = query.toLowerCase();
    const terms = lower.split(/\s+/).filter((t) => t.length > 0);

    return kb.entries.filter((entry) => {
      const searchable = `${entry.title} ${entry.content} ${entry.category}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }

  filterSensitive(kb: SharedKnowledgebase): KnowledgebaseEntry[] {
    return kb.entries.filter((entry) => !entry.sensitive);
  }
}
