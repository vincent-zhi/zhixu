import type { WorkflowDefinition } from "../types.js";

export function defineWorkflow<T extends WorkflowDefinition>(workflow: T): T {
  const errors = validateWorkflowDefinition(workflow);
  if (errors.length > 0) {
    throw new Error(`Invalid workflow definition:\n${errors.join("\n")}`);
  }
  return workflow;
}

export function validateWorkflowDefinition(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      duplicateIds.add(node.id);
    }
    nodeIds.add(node.id);

    if (node.policy.timeoutMs <= 0) {
      errors.push(`node ${node.id} policy.timeoutMs must be greater than 0`);
    }
    if (node.policy.maxAttempts <= 0) {
      errors.push(`node ${node.id} policy.maxAttempts must be greater than 0`);
    }
  }

  if (!nodeIds.has(workflow.startNodeId)) {
    errors.push(`startNodeId must reference an existing node: ${workflow.startNodeId}`);
  }

  for (const duplicateId of duplicateIds) {
    errors.push(`duplicate node id: ${duplicateId}`);
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`edge source does not reference an existing node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`edge target does not reference an existing node: ${edge.to}`);
    }
  }

  return errors;
}
