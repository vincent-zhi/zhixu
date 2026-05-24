import { describe, expect, it } from "vitest";
import { CanvasEngine } from "./canvas-engine.js";
import type { CanvasBlock, CanvasDocument, InlineAICommand } from "./types.js";

describe("CanvasEngine", () => {
  const engine = new CanvasEngine();

  describe("createDocument", () => {
    it("creates a document with correct fields", () => {
      const doc = engine.createDocument("art-1", "Test Doc");
      expect(doc.artifactId).toBe("art-1");
      expect(doc.title).toBe("Test Doc");
      expect(doc.blocks).toEqual([]);
      expect(doc.outline).toEqual([]);
      expect(doc.streamingState.status).toBe("idle");
      expect(doc.streamingState.artifactId).toBe("art-1");
      expect(doc.id).toBeTruthy();
      expect(doc.createdAt).toBeTruthy();
    });
  });

  describe("insertBlock", () => {
    it("inserts a block at the beginning when afterBlockId is null", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: { text: "hello" },
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "user-1",
        updatedBy: "user-1",
      });
      expect(block.id).toBeTruthy();
      expect(block.comments).toEqual([]);
      expect(block.evidenceRefs).toEqual([]);
      expect(block.versionId).toBeNull();
      expect(block.childrenIds).toEqual([]);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0]!.orderIndex).toBe(0);
    });

    it("inserts a block after the specified block", () => {
      const doc = engine.createDocument("a", "t");
      const block1 = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: { text: "first" },
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const block2 = engine.insertBlock(doc, block1.id, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: { text: "second" },
        orderIndex: 1,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      expect(doc.blocks).toHaveLength(2);
      expect(doc.blocks[0]!.id).toBe(block1.id);
      expect(doc.blocks[1]!.id).toBe(block2.id);
    });

    it("appends block at end when afterBlockId not found", () => {
      const doc = engine.createDocument("a", "t");
      engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const block2 = engine.insertBlock(doc, "nonexistent", {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 1,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      expect(doc.blocks).toHaveLength(2);
      expect(doc.blocks[1]!.id).toBe(block2.id);
    });
  });

  describe("updateBlock", () => {
    it("updates contentJson on a block", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: { text: "original" },
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const updated = engine.updateBlock(doc, block.id, { contentJson: { text: "updated" } });
      expect(updated).not.toBeNull();
      expect(updated!.contentJson.text).toBe("updated");
    });

    it("updates responsibilityColor and verificationStatus", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      engine.updateBlock(doc, block.id, { responsibilityColor: "green", verificationStatus: "verified" });
      expect(doc.blocks[0]!.responsibilityColor).toBe("green");
      expect(doc.blocks[0]!.verificationStatus).toBe("verified");
    });

    it("returns null for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(engine.updateBlock(doc, "nonexistent", { contentJson: {} })).toBeNull();
    });
  });

  describe("deleteBlock", () => {
    it("deletes a block", () => {
      const doc = engine.createDocument("a", "t");
      const block1 = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const block2 = engine.insertBlock(doc, block1.id, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 1,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const result = engine.deleteBlock(doc, block1.id);
      expect(result).toBe(true);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0]!.id).toBe(block2.id);
      expect(doc.blocks[0]!.orderIndex).toBe(0);
    });

    it("returns false for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(engine.deleteBlock(doc, "nonexistent")).toBe(false);
    });

    it("clears parentId references to deleted block", () => {
      const doc = engine.createDocument("a", "t");
      const block1 = engine.insertBlock(doc, null, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 0,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: null,
        createdBy: "u1",
        updatedBy: "u1",
      });
      const block2 = engine.insertBlock(doc, block1.id, {
        artifactId: "a",
        blockType: "paragraph",
        contentJson: {},
        orderIndex: 1,
        responsibilityColor: "gray",
        verificationStatus: "unverified",
        parentId: block1.id,
        createdBy: "u1",
        updatedBy: "u1",
      });
      engine.deleteBlock(doc, block1.id);
      expect(doc.blocks[0]!.parentId).toBeNull();
    });
  });

  describe("moveBlock", () => {
    it("moves a block to a new order index", () => {
      const doc = engine.createDocument("a", "t");
      const b1 = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const b2 = engine.insertBlock(doc, b1.id, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 1,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const b3 = engine.insertBlock(doc, b2.id, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 2,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.moveBlock(doc, b3.id, 0);
      expect(doc.blocks[0]!.id).toBe(b3.id);
      expect(doc.blocks[1]!.id).toBe(b1.id);
      expect(doc.blocks[2]!.id).toBe(b2.id);
    });

    it("returns false for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(engine.moveBlock(doc, "nonexistent", 0)).toBe(false);
    });
  });

  describe("bindEvidence", () => {
    it("binds evidence to a block", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const result = engine.bindEvidence(doc, block.id, "ev-1");
      expect(result).toBe(true);
      expect(doc.blocks[0]!.evidenceRefs).toEqual(["ev-1"]);
    });

    it("does not duplicate evidence", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.bindEvidence(doc, block.id, "ev-1");
      engine.bindEvidence(doc, block.id, "ev-1");
      expect(doc.blocks[0]!.evidenceRefs).toEqual(["ev-1"]);
    });

    it("returns false for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(engine.bindEvidence(doc, "nonexistent", "ev-1")).toBe(false);
    });
  });

  describe("addComment", () => {
    it("adds a comment to a block", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const comment = engine.addComment(doc, block.id, "user-2", "Nice work!");
      expect(comment.id).toBeTruthy();
      expect(comment.blockId).toBe(block.id);
      expect(comment.authorId).toBe("user-2");
      expect(comment.content).toBe("Nice work!");
      expect(comment.resolved).toBe(false);
      expect(doc.blocks[0]!.comments).toHaveLength(1);
    });

    it("throws for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(() => engine.addComment(doc, "nonexistent", "u1", "hi")).toThrow();
    });
  });

  describe("resolveComment", () => {
    it("resolves a comment", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const comment = engine.addComment(doc, block.id, "u2", "fix this");
      const result = engine.resolveComment(doc, comment.id);
      expect(result).toBe(true);
      expect(doc.blocks[0]!.comments[0]!.resolved).toBe(true);
    });

    it("returns false for nonexistent comment", () => {
      const doc = engine.createDocument("a", "t");
      expect(engine.resolveComment(doc, "nonexistent")).toBe(false);
    });
  });

  describe("executeAICommand", () => {
    it("applies AI command placeholder to block", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: { text: "hello" }, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const result = engine.executeAICommand(doc, block.id, "shorten");
      expect(result.contentJson.aiCommand).toBe("shorten");
      expect(result.contentJson.aiOutput).toBe("[AI: shortened]");
    });

    it("throws for nonexistent block", () => {
      const doc = engine.createDocument("a", "t");
      expect(() => engine.executeAICommand(doc, "nonexistent", "expand")).toThrow();
    });
  });

  describe("getOutline", () => {
    it("builds outline from heading blocks", () => {
      const doc = engine.createDocument("a", "t");
      engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "heading", contentJson: { text: "Chapter 1", level: 1 }, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.insertBlock(doc, doc.blocks[0]!.id, {
        artifactId: "a", blockType: "paragraph", contentJson: { text: "content" }, orderIndex: 1,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.insertBlock(doc, doc.blocks[1]!.id, {
        artifactId: "a", blockType: "heading", contentJson: { text: "Section 1.1", level: 2 }, orderIndex: 2,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      const outline = engine.getOutline(doc);
      expect(outline).toHaveLength(1);
      expect(outline[0]!.title).toBe("Chapter 1");
      expect(outline[0]!.children).toHaveLength(1);
      expect(outline[0]!.children[0]!.title).toBe("Section 1.1");
    });

    it("returns empty outline for document without headings", () => {
      const doc = engine.createDocument("a", "t");
      engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      expect(engine.getOutline(doc)).toEqual([]);
    });
  });

  describe("streaming", () => {
    it("starts streaming", () => {
      const doc = engine.createDocument("a", "t");
      const state = engine.startStreaming(doc);
      expect(state.status).toBe("streaming");
      expect(doc.streamingState.status).toBe("streaming");
    });

    it("pauses streaming", () => {
      const doc = engine.createDocument("a", "t");
      engine.startStreaming(doc);
      const state = engine.pauseStreaming(doc);
      expect(state.status).toBe("paused");
      expect(doc.streamingState.status).toBe("paused");
    });

    it("resumes streaming", () => {
      const doc = engine.createDocument("a", "t");
      engine.startStreaming(doc);
      engine.pauseStreaming(doc);
      const state = engine.resumeStreaming(doc);
      expect(state.status).toBe("streaming");
      expect(doc.streamingState.status).toBe("streaming");
    });
  });

  describe("applyOperation", () => {
    it("applies an insert operation", () => {
      const doc = engine.createDocument("a", "t");
      const op = engine.applyOperation(doc, {
        artifactId: "a",
        blockId: "b-new",
        operationType: "insert",
        payload: { blockType: "paragraph", contentJson: { text: "via op" }, afterBlockId: null },
        userId: "u1",
      });
      expect(op.id).toBeTruthy();
      expect(op.timestamp).toBeTruthy();
      expect(doc.blocks).toHaveLength(1);
    });

    it("applies a delete operation", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.applyOperation(doc, {
        artifactId: "a",
        blockId: block.id,
        operationType: "delete",
        payload: {},
        userId: "u1",
      });
      expect(doc.blocks).toHaveLength(0);
    });

    it("applies a bind_evidence operation", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.applyOperation(doc, {
        artifactId: "a",
        blockId: block.id,
        operationType: "bind_evidence",
        payload: { evidenceId: "ev-1" },
        userId: "u1",
      });
      expect(doc.blocks[0]!.evidenceRefs).toContain("ev-1");
    });

    it("applies an ai_command operation", () => {
      const doc = engine.createDocument("a", "t");
      const block = engine.insertBlock(doc, null, {
        artifactId: "a", blockType: "paragraph", contentJson: {}, orderIndex: 0,
        responsibilityColor: "gray", verificationStatus: "unverified", parentId: null, createdBy: "u1", updatedBy: "u1",
      });
      engine.applyOperation(doc, {
        artifactId: "a",
        blockId: block.id,
        operationType: "ai_command",
        payload: { command: "summarize" },
        userId: "u1",
      });
      expect(doc.blocks[0]!.contentJson.aiCommand).toBe("summarize");
    });
  });
});
