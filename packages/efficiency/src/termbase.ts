import type { Termbase, TermEntry, LLMCallable } from "./types.js";

export class TermbaseManager {
  createTermbase(workspaceId: string): Termbase {
    return {
      id: crypto.randomUUID(),
      workspaceId,
      entries: [],
    };
  }

  addEntry(termbase: Termbase, entry: Omit<TermEntry, "id" | "createdAt">): TermEntry {
    const newEntry: TermEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    termbase.entries.push(newEntry);
    return newEntry;
  }

  lookup(termbase: Termbase, term: string): TermEntry | null {
    const lower = term.toLowerCase();
    for (const entry of termbase.entries) {
      if (entry.term.toLowerCase() === lower) {
        return entry;
      }
      if (entry.aliases.some((a) => a.toLowerCase() === lower)) {
        return entry;
      }
    }
    return null;
  }

  unifyTerms(termbase: Termbase, content: string): string {
    let result = content;
    for (const entry of termbase.entries) {
      for (const alias of entry.aliases) {
        const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, "gi");
        result = result.replace(regex, entry.term);
      }
    }
    return result;
  }

  exportTermbase(termbase: Termbase): string {
    const header = "id,term,definition,domain,aliases,sourceProjectId,createdAt";
    const rows = termbase.entries.map((e) =>
      [
        e.id,
        csvEscape(e.term),
        csvEscape(e.definition),
        csvEscape(e.domain),
        csvEscape(e.aliases.join(";")),
        e.sourceProjectId ?? "",
        e.createdAt,
      ].join(",")
    );
    return [header, ...rows].join("\n");
  }

  async extractTerms(
    content: string,
    llm: LLMCallable
  ): Promise<Array<{ term: string; aliases: string[]; definition: string; context: string }>> {
    try {
      const result = await llm.chat({
        system: `你是一位学术术语提取助手。从文档中提取学术术语，包括中英文对照、缩写和同义词。
返回 JSON 数组：[{"term": "术语", "aliases": ["别名1", "缩写1"], "definition": "定义", "context": "出现的上下文"}]`,
        messages: [{ role: "user", content: content.slice(0, 4000) }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return Array.isArray(parsed) ? parsed : parsed.terms ?? [];
    } catch {
      return [];
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvEscape(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
