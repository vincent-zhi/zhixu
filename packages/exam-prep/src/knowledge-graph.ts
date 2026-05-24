import type { CourseKnowledgeGraph, KnowledgeNode, KnowledgeEdge, MistakeRecord } from "./types.js";

function extractHeadings(content: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim()
      });
    }
  }

  return headings;
}

export class KnowledgeGraphBuilder {
  buildFromSources(projectId: string, sources: Array<{id: string; fileName: string; content?: string}>): CourseKnowledgeGraph {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    let nodeIndex = 0;
    const chapterIds: string[] = [];

    for (const source of sources) {
      const content = source.content ?? "";
      const headings = extractHeadings(content);

      const sourceNodeId = `node-${nodeIndex++}`;
      nodes.push({
        id: sourceNodeId,
        type: "chapter",
        label: source.fileName.replace(/\.[^.]+$/, ""),
        description: `Source: ${source.fileName}`,
        responsibilityColor: "gray",
        mastery: 0
      });
      chapterIds.push(sourceNodeId);

      let lastChapterId = sourceNodeId;

      for (const heading of headings) {
        const nodeId = `node-${nodeIndex++}`;
        const nodeType = heading.level <= 2 ? "concept" : "example";

        nodes.push({
          id: nodeId,
          type: nodeType,
          label: heading.text,
          responsibilityColor: "gray",
          mastery: 0
        });

        edges.push({
          from: lastChapterId,
          to: nodeId,
          type: "appears_in"
        });

        if (heading.level <= 2) {
          lastChapterId = nodeId;
        }
      }
    }

    for (let i = 1; i < chapterIds.length; i++) {
      edges.push({
        from: chapterIds[i - 1],
        to: chapterIds[i],
        type: "prerequisite"
      });
    }

    return {
      projectId,
      nodes,
      edges
    };
  }

  addMistakeNode(graph: CourseKnowledgeGraph, mistake: MistakeRecord): CourseKnowledgeGraph {
    const mistakeNodeId = `node-mistake-${mistake.id}`;
    const mistakeNode: KnowledgeNode = {
      id: mistakeNodeId,
      type: "mistake",
      label: `Mistake: ${mistake.attribution}`,
      description: `Wrong answer: ${mistake.userAnswer}, Correct: ${mistake.correctAnswer}`,
      responsibilityColor: "yellow",
      mastery: mistake.mastered ? 1 : 0
    };

    const newEdge: KnowledgeEdge = {
      from: mistakeNodeId,
      to: mistake.nodeId,
      type: "often_confused"
    };

    return {
      ...graph,
      nodes: [...graph.nodes, mistakeNode],
      edges: [...graph.edges, newEdge]
    };
  }
}
