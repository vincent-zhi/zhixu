import type { CrossProjectLink } from "./types.js";

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
