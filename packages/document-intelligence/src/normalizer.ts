import type { DocumentNode, ParseResult, EvidenceAnchor } from "./provider.js";

export function normalizeParseResult(result: ParseResult): ParseResult {
  const sortedNodes = [...result.document.nodes]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node, index) => ({
      ...node,
      orderIndex: index,
      id: node.id || `node_${result.document.sourceId}_${index}`
    }));

  const normalizedNodes = normalizeNodeTree(sortedNodes);

  const sortedAnchors = result.evidenceAnchors.map((anchor) => ({
    ...anchor,
    responsibilityColor: anchor.responsibilityColor ?? "gray",
    verificationStatus: anchor.verificationStatus ?? "unverified"
  }));

  return {
    document: {
      id: result.document.id || `doc_${result.document.sourceId}`,
      sourceId: result.document.sourceId,
      title: result.document.title || "Untitled",
      nodes: normalizedNodes
    },
    evidenceAnchors: sortedAnchors
  };
}

function normalizeNodeTree(nodes: DocumentNode[]): DocumentNode[] {
  return nodes.map((node) => {
    const normalized: DocumentNode = { ...node };
    if (node.children && node.children.length > 0) {
      const sortedChildren = [...node.children]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((child, index) => ({
          ...child,
          orderIndex: index
        }));
      normalized.children = normalizeNodeTree(sortedChildren);
    } else {
      delete (normalized as unknown as Record<string, unknown>).children;
    }
    return normalized;
  });
}

export function mergeResults(results: ParseResult[]): ParseResult {
  if (results.length === 0) {
    return {
      document: { id: "doc_empty", sourceId: "empty", title: "Untitled", nodes: [] },
      evidenceAnchors: []
    };
  }

  if (results.length === 1) {
    return normalizeParseResult(results[0]!);
  }

  const primary = results[0]!;
  const allNodes: DocumentNode[] = [];
  const allAnchors: EvidenceAnchor[] = [];
  let orderOffset = 0;

  for (const result of results) {
    const normalized = normalizeParseResult(result);
    for (const node of normalized.document.nodes) {
      allNodes.push({
        ...node,
        orderIndex: orderOffset + node.orderIndex,
        id: node.id.includes(primary.document.sourceId)
          ? node.id
          : `node_${primary.document.sourceId}_${orderOffset + node.orderIndex}`
      });
    }
    allAnchors.push(...normalized.evidenceAnchors);
    orderOffset += normalized.document.nodes.length;
  }

  return {
    document: {
      id: primary.document.id,
      sourceId: primary.document.sourceId,
      title: primary.document.title,
      nodes: allNodes
    },
    evidenceAnchors: allAnchors
  };
}
