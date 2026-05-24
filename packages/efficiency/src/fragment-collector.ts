import type { FragmentNote } from "./types.js";

export class FragmentCollector {
  collect(input: { content: string; source: string; projectId: string; tags?: string[] }): FragmentNote {
    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      content: input.content,
      source: input.source,
      tags: input.tags ?? [],
      linkedProjectIds: [],
      createdAt: new Date().toISOString(),
    };
  }

  organizeByTag(fragments: FragmentNote[]): Map<string, FragmentNote[]> {
    const map = new Map<string, FragmentNote[]>();
    for (const fragment of fragments) {
      for (const tag of fragment.tags) {
        const existing = map.get(tag);
        if (existing) {
          existing.push(fragment);
        } else {
          map.set(tag, [fragment]);
        }
      }
      if (fragment.tags.length === 0) {
        const existing = map.get("");
        if (existing) {
          existing.push(fragment);
        } else {
          map.set("", [fragment]);
        }
      }
    }
    return map;
  }

  linkToProject(fragment: FragmentNote, projectId: string): FragmentNote {
    if (!fragment.linkedProjectIds.includes(projectId)) {
      fragment.linkedProjectIds.push(projectId);
    }
    return fragment;
  }
}
