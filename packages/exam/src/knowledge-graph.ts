import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from "./types.js";

function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1]!.length,
        text: match[2]!.trim(),
      });
    }
  }

  return headings;
}

export class KnowledgeGraphBuilder {
  buildFromSources(sources: Array<{ id: string; content: string; type: string }>): KnowledgeGraph {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const chapterIds: string[] = [];

    for (const source of sources) {
      const headings = extractHeadings(source.content);

      const chapterId = crypto.randomUUID();
      nodes.push({
        id: chapterId,
        type: "chapter",
        label: source.type,
        content: source.content.slice(0, 200),
        masteryLevel: 0,
        metadata: { sourceId: source.id },
      });
      chapterIds.push(chapterId);

      let lastParentId = chapterId;

      for (const heading of headings) {
        const nodeId = crypto.randomUUID();
        const nodeType = heading.level <= 2 ? "concept" : "example";

        nodes.push({
          id: nodeId,
          type: nodeType,
          label: heading.text,
          content: heading.text,
          masteryLevel: 0,
          metadata: { level: heading.level },
        });

        edges.push({
          id: crypto.randomUUID(),
          fromNodeId: lastParentId,
          toNodeId: nodeId,
          type: "appears_in",
          weight: 1,
        });

        if (heading.level <= 2) {
          lastParentId = nodeId;
        }
      }
    }

    for (let i = 1; i < chapterIds.length; i++) {
      edges.push({
        id: crypto.randomUUID(),
        fromNodeId: chapterIds[i - 1]!,
        toNodeId: chapterIds[i]!,
        type: "prerequisite",
        weight: 1,
      });
    }

    return {
      id: crypto.randomUUID(),
      projectId: "",
      nodes,
      edges,
    };
  }

  addNode(graph: KnowledgeGraph, node: Omit<KnowledgeNode, "id">): KnowledgeNode {
    const newNode: KnowledgeNode = {
      ...node,
      id: crypto.randomUUID(),
    };
    graph.nodes.push(newNode);
    return newNode;
  }

  addEdge(graph: KnowledgeGraph, edge: Omit<KnowledgeEdge, "id">): KnowledgeEdge {
    const newEdge: KnowledgeEdge = {
      ...edge,
      id: crypto.randomUUID(),
    };
    graph.edges.push(newEdge);
    return newEdge;
  }

  findWeakAreas(graph: KnowledgeGraph): KnowledgeNode[] {
    return graph.nodes
      .filter((n) => n.masteryLevel < 0.5)
      .sort((a, b) => a.masteryLevel - b.masteryLevel);
  }

  findRelatedNodes(graph: KnowledgeGraph, nodeId: string, maxDepth: number = 1): KnowledgeNode[] {
    const visited = new Set<string>([nodeId]);
    const result: KnowledgeNode[] = [];
    let currentLevel = [nodeId];

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextLevel: string[] = [];

      for (const currentId of currentLevel) {
        for (const edge of graph.edges) {
          let relatedId: string | null = null;

          if (edge.fromNodeId === currentId && !visited.has(edge.toNodeId)) {
            relatedId = edge.toNodeId;
          } else if (edge.toNodeId === currentId && !visited.has(edge.fromNodeId)) {
            relatedId = edge.fromNodeId;
          }

          if (relatedId) {
            visited.add(relatedId);
            nextLevel.push(relatedId);
            const node = graph.nodes.find((n) => n.id === relatedId);
            if (node) {
              result.push(node);
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    return result;
  }
}
