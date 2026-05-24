import type {
  CanvasBlock,
  CanvasComment,
  CanvasDocument,
  CanvasOperation,
  InlineAICommand,
  OutlineNode,
  StreamingState,
} from "./types.js";

export class CanvasEngine {
  createDocument(artifactId: string, title: string): CanvasDocument {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      artifactId,
      title,
      blocks: [],
      outline: [],
      streamingState: {
        artifactId,
        status: "idle",
        currentBlockId: null,
        progress: 0,
        branchPoint: null,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  insertBlock(
    doc: CanvasDocument,
    afterBlockId: string | null,
    block: Omit<CanvasBlock, "id" | "createdAt" | "updatedAt" | "comments" | "evidenceRefs" | "versionId" | "childrenIds">,
  ): CanvasBlock {
    const now = new Date().toISOString();
    const newBlock: CanvasBlock = {
      ...block,
      id: crypto.randomUUID(),
      artifactId: doc.artifactId,
      comments: [],
      evidenceRefs: [],
      versionId: null,
      childrenIds: [],
      createdAt: now,
      updatedAt: now,
    };

    if (afterBlockId === null) {
      newBlock.orderIndex = 0;
      for (const existing of doc.blocks) {
        if (existing.orderIndex >= newBlock.orderIndex) {
          existing.orderIndex++;
        }
      }
      doc.blocks.unshift(newBlock);
    } else {
      const afterIndex = doc.blocks.findIndex((b) => b.id === afterBlockId);
      if (afterIndex === -1) {
        newBlock.orderIndex = doc.blocks.length;
        doc.blocks.push(newBlock);
      } else {
        newBlock.orderIndex = doc.blocks[afterIndex]!.orderIndex + 1;
        for (const existing of doc.blocks) {
          if (existing.orderIndex >= newBlock.orderIndex) {
            existing.orderIndex++;
          }
        }
        doc.blocks.splice(afterIndex + 1, 0, newBlock);
      }
    }

    doc.outline = this.buildOutline(doc);
    doc.updatedAt = now;
    return newBlock;
  }

  updateBlock(
    doc: CanvasDocument,
    blockId: string,
    updates: Partial<Pick<CanvasBlock, "contentJson" | "responsibilityColor" | "verificationStatus">>,
  ): CanvasBlock | null {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) return null;

    if (updates.contentJson !== undefined) block.contentJson = updates.contentJson;
    if (updates.responsibilityColor !== undefined) block.responsibilityColor = updates.responsibilityColor;
    if (updates.verificationStatus !== undefined) block.verificationStatus = updates.verificationStatus;

    block.updatedAt = new Date().toISOString();
    doc.updatedAt = block.updatedAt;
    doc.outline = this.buildOutline(doc);
    return block;
  }

  deleteBlock(doc: CanvasDocument, blockId: string): boolean {
    const index = doc.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return false;

    doc.blocks.splice(index, 1);

    for (const child of doc.blocks) {
      if (child.parentId === blockId) {
        child.parentId = null;
      }
      const childIdx = child.childrenIds.indexOf(blockId);
      if (childIdx !== -1) {
        child.childrenIds.splice(childIdx, 1);
      }
    }

    doc.blocks.sort((a, b) => a.orderIndex - b.orderIndex);
    for (let i = 0; i < doc.blocks.length; i++) {
      doc.blocks[i]!.orderIndex = i;
    }

    doc.outline = this.buildOutline(doc);
    doc.updatedAt = new Date().toISOString();
    return true;
  }

  moveBlock(doc: CanvasDocument, blockId: string, newOrderIndex: number): boolean {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) return false;

    const oldOrderIndex = block.orderIndex;
    if (oldOrderIndex === newOrderIndex) return true;

    for (const b of doc.blocks) {
      if (b.id === blockId) continue;
      if (oldOrderIndex < newOrderIndex) {
        if (b.orderIndex > oldOrderIndex && b.orderIndex <= newOrderIndex) {
          b.orderIndex--;
        }
      } else {
        if (b.orderIndex >= newOrderIndex && b.orderIndex < oldOrderIndex) {
          b.orderIndex++;
        }
      }
    }

    block.orderIndex = newOrderIndex;
    doc.blocks.sort((a, b) => a.orderIndex - b.orderIndex);
    doc.outline = this.buildOutline(doc);
    doc.updatedAt = new Date().toISOString();
    return true;
  }

  bindEvidence(doc: CanvasDocument, blockId: string, evidenceId: string): boolean {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) return false;

    if (!block.evidenceRefs.includes(evidenceId)) {
      block.evidenceRefs.push(evidenceId);
    }

    block.updatedAt = new Date().toISOString();
    doc.updatedAt = block.updatedAt;
    return true;
  }

  addComment(doc: CanvasDocument, blockId: string, authorId: string, content: string): CanvasComment {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    const now = new Date().toISOString();
    const comment: CanvasComment = {
      id: crypto.randomUUID(),
      blockId,
      authorId,
      content,
      resolved: false,
      createdAt: now,
    };

    block.comments.push(comment);
    block.updatedAt = now;
    doc.updatedAt = now;
    return comment;
  }

  resolveComment(doc: CanvasDocument, commentId: string): boolean {
    for (const block of doc.blocks) {
      const comment = block.comments.find((c) => c.id === commentId);
      if (comment) {
        comment.resolved = true;
        block.updatedAt = new Date().toISOString();
        doc.updatedAt = block.updatedAt;
        return true;
      }
    }
    return false;
  }

  executeAICommand(doc: CanvasDocument, blockId: string, command: InlineAICommand): CanvasBlock {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    const placeholderMap: Record<InlineAICommand, string> = {
      shorten: "[AI: shortened]",
      expand: "[AI: expanded]",
      academicize: "[AI: academicized]",
      add_example: "[AI: example added]",
      add_citation: "[AI: citation added]",
      reduce_similarity: "[AI: similarity reduced]",
      convert_to_slide: "[AI: converted to slide]",
      generate_speaker_notes: "[AI: speaker notes generated]",
      summarize: "[AI: summarized]",
      translate: "[AI: translated]",
    };

    block.contentJson = {
      ...block.contentJson,
      aiCommand: command,
      aiOutput: placeholderMap[command],
    };

    block.updatedAt = new Date().toISOString();
    doc.updatedAt = block.updatedAt;
    return block;
  }

  getOutline(doc: CanvasDocument): OutlineNode[] {
    return this.buildOutline(doc);
  }

  startStreaming(doc: CanvasDocument): StreamingState {
    doc.streamingState = {
      ...doc.streamingState,
      status: "streaming",
      currentBlockId: doc.streamingState.currentBlockId,
      progress: 0,
    };
    doc.updatedAt = new Date().toISOString();
    return doc.streamingState;
  }

  pauseStreaming(doc: CanvasDocument): StreamingState {
    doc.streamingState = {
      ...doc.streamingState,
      status: "paused",
    };
    doc.updatedAt = new Date().toISOString();
    return doc.streamingState;
  }

  resumeStreaming(doc: CanvasDocument): StreamingState {
    doc.streamingState = {
      ...doc.streamingState,
      status: "streaming",
    };
    doc.updatedAt = new Date().toISOString();
    return doc.streamingState;
  }

  applyOperation(
    doc: CanvasDocument,
    operation: Omit<CanvasOperation, "id" | "timestamp">,
  ): CanvasOperation {
    const now = new Date().toISOString();
    const op: CanvasOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: now,
    };

    switch (operation.operationType) {
      case "insert": {
        const blockData = operation.payload as Record<string, unknown>;
        this.insertBlock(doc, operation.payload.afterBlockId as string | null, {
          artifactId: doc.artifactId,
          blockType: (blockData.blockType ?? "paragraph") as CanvasBlock["blockType"],
          contentJson: (blockData.contentJson ?? {}) as Record<string, unknown>,
          orderIndex: (blockData.orderIndex as number) ?? 0,
          responsibilityColor: (blockData.responsibilityColor as CanvasBlock["responsibilityColor"]) ?? "gray",
          verificationStatus: (blockData.verificationStatus as CanvasBlock["verificationStatus"]) ?? "unverified",
          parentId: (blockData.parentId as string | null) ?? null,
          createdBy: operation.userId,
          updatedBy: operation.userId,
        });
        break;
      }
      case "update": {
        this.updateBlock(doc, operation.blockId, operation.payload as Partial<Pick<CanvasBlock, "contentJson" | "responsibilityColor" | "verificationStatus">>);
        break;
      }
      case "delete": {
        this.deleteBlock(doc, operation.blockId);
        break;
      }
      case "move": {
        this.moveBlock(doc, operation.blockId, operation.payload.newOrderIndex as number);
        break;
      }
      case "bind_evidence": {
        this.bindEvidence(doc, operation.blockId, operation.payload.evidenceId as string);
        break;
      }
      case "add_comment": {
        this.addComment(doc, operation.blockId, operation.userId, operation.payload.content as string);
        break;
      }
      case "ai_command": {
        this.executeAICommand(doc, operation.blockId, operation.payload.command as InlineAICommand);
        break;
      }
    }

    return op;
  }

  private buildOutline(doc: CanvasDocument): OutlineNode[] {
    const headings = doc.blocks
      .filter((b) => b.blockType === "heading")
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const root: OutlineNode[] = [];
    const stack: OutlineNode[] = [];

    for (const heading of headings) {
      const level = (heading.contentJson.level as number) ?? 1;
      const title = (heading.contentJson.text as string) ?? "";
      const node: OutlineNode = {
        id: crypto.randomUUID(),
        blockId: heading.id,
        title,
        level,
        children: [],
        orderIndex: heading.orderIndex,
      };

      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1]!.children.push(node);
      }

      stack.push(node);
    }

    return root;
  }
}
