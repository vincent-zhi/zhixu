import type { Termbase, TermEntry } from "./types.js";

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
