import type { CanvasBlock, CanvasDocument } from "./types.js";
import type { ResponsibilityColor } from "@zhixu/core";

function updateBlock(doc: CanvasDocument, blockId: string, updater: (block: CanvasBlock) => CanvasBlock): CanvasDocument {
  const now = new Date().toISOString();
  const newBlocks = doc.blocks.map(block => {
    if (block.id === blockId) {
      return updater(block);
    }
    if (block.children.length > 0) {
      const updatedChildren = block.children.map((child: CanvasBlock) =>
        child.id === blockId ? updater(child) : child
      );
      if (updatedChildren !== block.children) {
        return { ...block, children: updatedChildren };
      }
    }
    return block;
  });
  return { ...doc, blocks: newBlocks, updatedAt: now };
}

export function startStream(doc: CanvasDocument, blockId: string): CanvasDocument {
  return updateBlock(doc, blockId, block => ({
    ...block,
    isStreaming: true
  }));
}

export function appendStream(doc: CanvasDocument, blockId: string, content: string): CanvasDocument {
  return updateBlock(doc, blockId, block => ({
    ...block,
    content: block.content + content
  }));
}

export function endStream(doc: CanvasDocument, blockId: string, responsibilityColor: ResponsibilityColor): CanvasDocument {
  return updateBlock(doc, blockId, block => ({
    ...block,
    isStreaming: false,
    responsibilityColor
  }));
}

export function pauseStream(doc: CanvasDocument, blockId: string): CanvasDocument {
  return updateBlock(doc, blockId, block => ({
    ...block,
    isStreaming: false
  }));
}
