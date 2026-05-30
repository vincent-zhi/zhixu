import type { CrossProjectLink, LLMCallable } from "./types.js";

export class CrossProjectLinker {
  createLink(input: {
    sourceProjectId: string;
    targetProjectId: string;
    linkType: CrossProjectLink["linkType"];
    description: string;
  }): CrossProjectLink {
    return {
      id: crypto.randomUUID(),
      sourceProjectId: input.sourceProjectId,
      targetProjectId: input.targetProjectId,
      linkType: input.linkType,
      description: input.description,
      createdAt: new Date().toISOString(),
    };
  }

  findRelatedProjects(projectId: string, links: CrossProjectLink[]): string[] {
    const related = new Set<string>();
    for (const link of links) {
      if (link.sourceProjectId === projectId) {
        related.add(link.targetProjectId);
      }
      if (link.targetProjectId === projectId) {
        related.add(link.sourceProjectId);
      }
    }
    return Array.from(related);
  }

  suggestLinks(
    projectId: string,
    projects: Array<{ id: string; title: string; type: string }>
  ): CrossProjectLink[] {
    const source = projects.find((p) => p.id === projectId);
    if (!source) return [];

    const suggestions: CrossProjectLink[] = [];
    const sourceWords = tokenize(source.title);

    for (const project of projects) {
      if (project.id === projectId) continue;

      const targetWords = tokenize(project.title);
      let overlapCount = 0;
      for (const w of sourceWords) {
        if (targetWords.has(w)) {
          overlapCount++;
        }
      }

      let linkType: CrossProjectLink["linkType"] = "shared_knowledge";
      let description = "";

      if (source.type === project.type) {
        if (overlapCount >= 2) {
          linkType = "shared_methodology";
          description = `Similar methodology between "${source.title}" and "${project.title}"`;
        } else if (overlapCount >= 1) {
          linkType = "shared_knowledge";
          description = `Shared knowledge area between "${source.title}" and "${project.title}"`;
        }
      } else {
        if (overlapCount >= 1) {
          linkType = "shared_data";
          description = `Potential shared data between "${source.title}" and "${project.title}"`;
        }
      }

      if (overlapCount >= 1) {
        suggestions.push(
          this.createLink({
            sourceProjectId: projectId,
            targetProjectId: project.id,
            linkType,
            description,
          })
        );
      }
    }

    return suggestions;
  }

  async suggestLinksEnhanced(
    projects: Array<{ id: string; title: string; type: string; summary: string }>,
    llm: LLMCallable
  ): Promise<Array<CrossProjectLink & { rationale: string; sharedKnowledge: string[] }>> {
    // Collect basic links by iterating all projects
    const basicLinks: CrossProjectLink[] = [];
    for (const project of projects) {
      basicLinks.push(...this.suggestLinks(project.id, projects));
    }

    try {
      const result = await llm.chat({
        system: `你是一位跨项目知识关联助手。分析多个项目之间的知识关联。
返回 JSON：{"links": [{"source": "项目ID1", "target": "项目ID2", "type": "shared_methodology|shared_knowledge|shared_data", "rationale": "关联原因", "sharedKnowledge": ["共享知识点1", "..."]}]}`,
        messages: [{ role: "user", content: projects.map(p => `ID:${p.id} | ${p.title}（${p.type}）：${p.summary}`).join("\n") }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return (parsed.links ?? []).map((l: any) => ({
        id: crypto.randomUUID(),
        sourceProjectId: l.source ?? "",
        targetProjectId: l.target ?? "",
        linkType: l.type ?? "shared_knowledge",
        description: l.rationale ?? "",
        createdAt: new Date().toISOString(),
        rationale: l.rationale ?? "",
        sharedKnowledge: l.sharedKnowledge ?? [],
      }));
    } catch {
      return basicLinks.map(l => ({ ...l, rationale: "", sharedKnowledge: [] }));
    }
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}
