import type { CanvasBlock, CanvasDocument, CanvasOperation } from "./types.js";
import { ResponsibilityColorSchema } from "@zhixu/core";

function updateBlockInList(blocks: CanvasBlock[], blockId: string, updater: (block: CanvasBlock) => CanvasBlock): CanvasBlock[] {
  return blocks.map(block => {
    if (block.id === blockId) {
      return updater(block);
    }
    if (block.children.length > 0) {
      const updatedChildren = updateBlockInList(block.children, blockId, updater);
      if (updatedChildren !== block.children) {
        return { ...block, children: updatedChildren };
      }
    }
    return block;
  });
}

function removeBlockFromList(blocks: CanvasBlock[], blockId: string): CanvasBlock[] {
  return blocks
    .filter(block => block.id !== blockId)
    .map(block => {
      if (block.children.length > 0) {
        const updatedChildren = removeBlockFromList(block.children, blockId);
        if (updatedChildren !== block.children) {
          return { ...block, children: updatedChildren };
        }
      }
      return block;
    });
}

function findBlockInList(blocks: CanvasBlock[], blockId: string): CanvasBlock | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    const found = findBlockInList(block.children, blockId);
    if (found) return found;
  }
  return undefined;
}

function collectAllBlocks(blocks: CanvasBlock[]): CanvasBlock[] {
  const result: CanvasBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children.length > 0) {
      result.push(...collectAllBlocks(block.children));
    }
  }
  return result;
}

function reindexBlocks(blocks: CanvasBlock[]): CanvasBlock[] {
  return blocks.map((block, index) => ({
    ...block,
    orderIndex: index
  }));
}

export function createDocument(projectId: string, artifactId: string, title: string): CanvasDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    artifactId,
    title,
    blocks: [],
    createdAt: now,
    updatedAt: now
  };
}

export function applyOperation(doc: CanvasDocument, op: CanvasOperation): CanvasDocument {
  const now = new Date().toISOString();

  switch (op.type) {
    case "insert_block": {
      let newBlocks: CanvasBlock[];
      if (op.afterBlockId === null) {
        newBlocks = [op.block, ...doc.blocks];
      } else {
        const index = doc.blocks.findIndex(b => b.id === op.afterBlockId);
        if (index === -1) {
          newBlocks = [...doc.blocks, op.block];
        } else {
          newBlocks = [...doc.blocks.slice(0, index + 1), op.block, ...doc.blocks.slice(index + 1)];
        }
      }
      newBlocks = reindexBlocks(newBlocks);
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "update_block": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        ...op.updates as Partial<CanvasBlock>,
        metadata: op.updates["metadata"] !== undefined
          ? op.updates["metadata"] as Record<string, unknown>
          : block.metadata
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "delete_block": {
      const newBlocks = reindexBlocks(removeBlockFromList(doc.blocks, op.blockId));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "move_block": {
      const block = findBlockInList(doc.blocks, op.blockId);
      if (!block) return doc;
      const withoutBlock = removeBlockFromList(doc.blocks, op.blockId);
      let newBlocks: CanvasBlock[];
      if (op.afterBlockId === null) {
        newBlocks = [block, ...withoutBlock];
      } else {
        const index = withoutBlock.findIndex(b => b.id === op.afterBlockId);
        if (index === -1) {
          newBlocks = [...withoutBlock, block];
        } else {
          newBlocks = [...withoutBlock.slice(0, index + 1), block, ...withoutBlock.slice(index + 1)];
        }
      }
      newBlocks = reindexBlocks(newBlocks);
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "bind_evidence": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        evidenceRefs: [...block.evidenceRefs, op.evidenceId]
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "set_responsibility": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        responsibilityColor: op.color
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "add_comment": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        comments: [...block.comments, op.comment]
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "start_streaming": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        isStreaming: true
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "append_streaming": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        content: block.content + op.content
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    case "end_streaming": {
      const newBlocks = updateBlockInList(doc.blocks, op.blockId, block => ({
        ...block,
        isStreaming: false
      }));
      return { ...doc, blocks: newBlocks, updatedAt: now };
    }

    default: {
      const _exhaustive: never = op;
      return doc;
    }
  }
}

export function getBlock(doc: CanvasDocument, blockId: string): CanvasBlock | undefined {
  return findBlockInList(doc.blocks, blockId);
}

export function getBlocksByType(doc: CanvasDocument, type: string): CanvasBlock[] {
  return collectAllBlocks(doc.blocks).filter(block => block.type === type);
}

export function getResponsibilitySummary(doc: CanvasDocument): { green: number; yellow: number; gray: number } {
  const allBlocks = collectAllBlocks(doc.blocks);
  return {
    green: allBlocks.filter(b => b.responsibilityColor === "green").length,
    yellow: allBlocks.filter(b => b.responsibilityColor === "yellow").length,
    gray: allBlocks.filter(b => b.responsibilityColor === "gray").length
  };
}

export function getEvidenceCoverage(doc: CanvasDocument): number {
  const allBlocks = collectAllBlocks(doc.blocks);
  if (allBlocks.length === 0) return 0;
  const withEvidence = allBlocks.filter(b => b.evidenceRefs.length > 0).length;
  return withEvidence / allBlocks.length;
}

export function getCompliancePanel(doc: CanvasDocument): {
  greenRatio: number;
  yellowRatio: number;
  grayRatio: number;
  unverifiedCount: number;
  noSourceCount: number;
  aiInferredCount: number;
} {
  const allBlocks = collectAllBlocks(doc.blocks);
  const total = allBlocks.length;
  if (total === 0) {
    return {
      greenRatio: 0,
      yellowRatio: 0,
      grayRatio: 0,
      unverifiedCount: 0,
      noSourceCount: 0,
      aiInferredCount: 0
    };
  }
  const green = allBlocks.filter(b => b.responsibilityColor === "green").length;
  const yellow = allBlocks.filter(b => b.responsibilityColor === "yellow").length;
  const gray = allBlocks.filter(b => b.responsibilityColor === "gray").length;
  return {
    greenRatio: green / total,
    yellowRatio: yellow / total,
    grayRatio: gray / total,
    unverifiedCount: allBlocks.filter(b => b.verificationStatus === "unverified").length,
    noSourceCount: allBlocks.filter(b => b.evidenceRefs.length === 0).length,
    aiInferredCount: yellow
  };
}
