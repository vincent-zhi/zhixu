import type { WorkflowDefinition } from "../types.js";

export function getReadyNodeIds(
  workflow: WorkflowDefinition,
  completedNodeIds: string[],
  failedNodeIds: string[] = []
): string[] {
  const completed = new Set(completedNodeIds);
  const failed = new Set(failedNodeIds);
  if (completed.size === 0) return [workflow.startNodeId];

  return workflow.nodes
    .filter((node) => !completed.has(node.id) && !failed.has(node.id))
    .filter((node) => {
      const incoming = workflow.edges.filter((edge) => edge.to === node.id);
      if (incoming.length === 0) return node.id === workflow.startNodeId;
      return incoming.every((edge) => completed.has(edge.from) && !failed.has(edge.from));
    })
    .map((node) => node.id);
}
