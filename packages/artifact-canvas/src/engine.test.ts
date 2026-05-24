import { describe, expect, it } from "vitest";
import {
  createDocument,
  applyOperation,
  getBlock,
  getBlocksByType,
  getResponsibilitySummary,
  getEvidenceCoverage,
  getCompliancePanel
} from "./engine.js";
import { createLog, push, undo, redo, canUndo, canRedo } from "./operation-log.js";
import { startStream, appendStream, endStream, pauseStream } from "./streaming.js";
import { shorten, expand, academicize, addCitation, addExample, reduceRepetition, toSlide } from "./ai-commands.js";
import type { CanvasBlock, CanvasDocument, CanvasOperation } from "./types.js";

function makeBlock(overrides: Partial<CanvasBlock> & { id: string }): CanvasBlock {
  return {
    type: "paragraph",
    content: "test content",
    orderIndex: 0,
    responsibilityColor: "gray",
    verificationStatus: "unverified",
    evidenceRefs: [],
    comments: [],
    children: [],
    isStreaming: false,
    metadata: {},
    ...overrides
  };
}

describe("CanvasEngine", () => {
  describe("createDocument", () => {
    it("creates a document with correct fields", () => {
      const doc = createDocument("proj-1", "art-1", "Test Doc");
      expect(doc.projectId).toBe("proj-1");
      expect(doc.artifactId).toBe("art-1");
      expect(doc.title).toBe("Test Doc");
      expect(doc.blocks).toEqual([]);
      expect(doc.id).toBeTruthy();
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });
  });

  describe("applyOperation", () => {
    it("inserts a block at the beginning when afterBlockId is null", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      const op: CanvasOperation = { type: "insert_block", blockId: "b1", afterBlockId: null, block };
      const result = applyOperation(doc, op);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].id).toBe("b1");
      expect(result.blocks[0].orderIndex).toBe(0);
    });

    it("inserts a block after the specified block", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", orderIndex: 0 });
      const block2 = makeBlock({ id: "b2", orderIndex: 1 });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].id).toBe("b1");
      expect(result.blocks[1].id).toBe("b2");
      expect(result.blocks[0].orderIndex).toBe(0);
      expect(result.blocks[1].orderIndex).toBe(1);
    });

    it("updates a block", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      result = applyOperation(result, { type: "update_block", blockId: "b1", updates: { content: "updated" } });
      expect(result.blocks[0].content).toBe("updated");
    });

    it("deletes a block", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", orderIndex: 0 });
      const block2 = makeBlock({ id: "b2", orderIndex: 1 });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "delete_block", blockId: "b1" });
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].id).toBe("b2");
      expect(result.blocks[0].orderIndex).toBe(0);
    });

    it("moves a block", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", orderIndex: 0 });
      const block2 = makeBlock({ id: "b2", orderIndex: 1 });
      const block3 = makeBlock({ id: "b3", orderIndex: 2 });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "insert_block", blockId: "b3", afterBlockId: "b2", block: block3 });
      result = applyOperation(result, { type: "move_block", blockId: "b3", afterBlockId: null });
      expect(result.blocks[0].id).toBe("b3");
      expect(result.blocks[1].id).toBe("b1");
      expect(result.blocks[2].id).toBe("b2");
    });

    it("binds evidence to a block", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      result = applyOperation(result, { type: "bind_evidence", blockId: "b1", evidenceId: "ev-1" });
      expect(result.blocks[0].evidenceRefs).toEqual(["ev-1"]);
    });

    it("sets responsibility color on a block", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      result = applyOperation(result, { type: "set_responsibility", blockId: "b1", color: "green" });
      expect(result.blocks[0].responsibilityColor).toBe("green");
    });

    it("adds a comment to a block", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      const comment = { id: "c1", userId: "u1", text: "nice", createdAt: new Date().toISOString() };
      result = applyOperation(result, { type: "add_comment", blockId: "b1", comment });
      expect(result.blocks[0].comments).toHaveLength(1);
      expect(result.blocks[0].comments[0].text).toBe("nice");
    });

    it("returns a new document without mutating the original", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      const result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      expect(doc.blocks).toHaveLength(0);
      expect(result.blocks).toHaveLength(1);
    });
  });

  describe("getBlock", () => {
    it("finds a block by id", () => {
      const doc = createDocument("p", "a", "t");
      const block = makeBlock({ id: "b1" });
      const result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
      expect(getBlock(result, "b1")).toBeDefined();
      expect(getBlock(result, "b1")!.id).toBe("b1");
    });

    it("returns undefined for missing block", () => {
      const doc = createDocument("p", "a", "t");
      expect(getBlock(doc, "nonexistent")).toBeUndefined();
    });
  });

  describe("getBlocksByType", () => {
    it("filters blocks by type", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", type: "heading" });
      const block2 = makeBlock({ id: "b2", type: "paragraph" });
      const block3 = makeBlock({ id: "b3", type: "heading" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "insert_block", blockId: "b3", afterBlockId: "b2", block: block3 });
      const headings = getBlocksByType(result, "heading");
      expect(headings).toHaveLength(2);
    });
  });

  describe("getResponsibilitySummary", () => {
    it("counts blocks by responsibility color", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", responsibilityColor: "green" });
      const block2 = makeBlock({ id: "b2", responsibilityColor: "yellow" });
      const block3 = makeBlock({ id: "b3", responsibilityColor: "gray" });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "insert_block", blockId: "b3", afterBlockId: "b2", block: block3 });
      const summary = getResponsibilitySummary(result);
      expect(summary).toEqual({ green: 1, yellow: 1, gray: 1 });
    });
  });

  describe("getEvidenceCoverage", () => {
    it("returns 0 for empty document", () => {
      const doc = createDocument("p", "a", "t");
      expect(getEvidenceCoverage(doc)).toBe(0);
    });

    it("computes ratio of blocks with evidence", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", evidenceRefs: ["ev1"] });
      const block2 = makeBlock({ id: "b2", evidenceRefs: [] });
      const block3 = makeBlock({ id: "b3", evidenceRefs: ["ev2"] });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "insert_block", blockId: "b3", afterBlockId: "b2", block: block3 });
      expect(getEvidenceCoverage(result)).toBeCloseTo(2 / 3);
    });
  });

  describe("getCompliancePanel", () => {
    it("returns zeros for empty document", () => {
      const doc = createDocument("p", "a", "t");
      const panel = getCompliancePanel(doc);
      expect(panel).toEqual({
        greenRatio: 0,
        yellowRatio: 0,
        grayRatio: 0,
        unverifiedCount: 0,
        noSourceCount: 0,
        aiInferredCount: 0
      });
    });

    it("computes compliance metrics correctly", () => {
      const doc = createDocument("p", "a", "t");
      const block1 = makeBlock({ id: "b1", responsibilityColor: "green", verificationStatus: "verified", evidenceRefs: ["ev1"] });
      const block2 = makeBlock({ id: "b2", responsibilityColor: "yellow", verificationStatus: "pending", evidenceRefs: [] });
      const block3 = makeBlock({ id: "b3", responsibilityColor: "gray", verificationStatus: "unverified", evidenceRefs: [] });
      let result = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 });
      result = applyOperation(result, { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 });
      result = applyOperation(result, { type: "insert_block", blockId: "b3", afterBlockId: "b2", block: block3 });
      const panel = getCompliancePanel(result);
      expect(panel.greenRatio).toBeCloseTo(1 / 3);
      expect(panel.yellowRatio).toBeCloseTo(1 / 3);
      expect(panel.grayRatio).toBeCloseTo(1 / 3);
      expect(panel.unverifiedCount).toBe(1);
      expect(panel.noSourceCount).toBe(2);
      expect(panel.aiInferredCount).toBe(1);
    });
  });
});

describe("OperationLog", () => {
  it("starts with empty stacks", () => {
    const log = createLog();
    expect(canUndo(log)).toBe(false);
    expect(canRedo(log)).toBe(false);
  });

  it("can undo after push", () => {
    let doc = createDocument("p", "a", "t");
    let log = createLog();
    const block = makeBlock({ id: "b1" });
    const op: CanvasOperation = { type: "insert_block", blockId: "b1", afterBlockId: null, block };
    log = push(log, doc, op);
    doc = applyOperation(doc, op);
    expect(canUndo(log)).toBe(true);
    expect(canRedo(log)).toBe(false);
  });

  it("undoes an operation", () => {
    let doc = createDocument("p", "a", "t");
    let log = createLog();
    const block = makeBlock({ id: "b1" });
    const op: CanvasOperation = { type: "insert_block", blockId: "b1", afterBlockId: null, block };
    log = push(log, doc, op);
    doc = applyOperation(doc, op);
    expect(doc.blocks).toHaveLength(1);
    const undoResult = undo(log, doc);
    log = undoResult.log;
    doc = undoResult.doc;
    expect(doc.blocks).toHaveLength(0);
    expect(canRedo(log)).toBe(true);
  });

  it("redoes an undone operation", () => {
    let doc = createDocument("p", "a", "t");
    let log = createLog();
    const block = makeBlock({ id: "b1" });
    const op: CanvasOperation = { type: "insert_block", blockId: "b1", afterBlockId: null, block };
    log = push(log, doc, op);
    doc = applyOperation(doc, op);
    let undoResult = undo(log, doc);
    log = undoResult.log;
    doc = undoResult.doc;
    expect(doc.blocks).toHaveLength(0);
    const redoResult = redo(log, doc);
    log = redoResult.log;
    doc = redoResult.doc;
    expect(doc.blocks).toHaveLength(1);
    expect(canUndo(log)).toBe(true);
  });

  it("clears redo stack on new push", () => {
    let doc = createDocument("p", "a", "t");
    let log = createLog();
    const block1 = makeBlock({ id: "b1" });
    const block2 = makeBlock({ id: "b2" });
    const op1: CanvasOperation = { type: "insert_block", blockId: "b1", afterBlockId: null, block: block1 };
    const op2: CanvasOperation = { type: "insert_block", blockId: "b2", afterBlockId: "b1", block: block2 };
    log = push(log, doc, op1);
    doc = applyOperation(doc, op1);
    log = push(log, doc, op2);
    doc = applyOperation(doc, op2);
    let undoResult = undo(log, doc);
    log = undoResult.log;
    doc = undoResult.doc;
    expect(canRedo(log)).toBe(true);
    const block3 = makeBlock({ id: "b3" });
    const op3: CanvasOperation = { type: "insert_block", blockId: "b3", afterBlockId: null, block: block3 };
    log = push(log, doc, op3);
    doc = applyOperation(doc, op3);
    expect(canRedo(log)).toBe(false);
  });

  it("returns same doc when undoing with empty stack", () => {
    const doc = createDocument("p", "a", "t");
    const log = createLog();
    const result = undo(log, doc);
    expect(result.doc).toBe(doc);
  });

  it("returns same doc when redoing with empty stack", () => {
    const doc = createDocument("p", "a", "t");
    const log = createLog();
    const result = redo(log, doc);
    expect(result.doc).toBe(doc);
  });
});

describe("StreamingController", () => {
  it("starts streaming on a block", () => {
    let doc = createDocument("p", "a", "t");
    const block = makeBlock({ id: "b1" });
    doc = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
    doc = startStream(doc, "b1");
    expect(getBlock(doc, "b1")!.isStreaming).toBe(true);
  });

  it("appends content to a streaming block", () => {
    let doc = createDocument("p", "a", "t");
    const block = makeBlock({ id: "b1", content: "" });
    doc = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
    doc = startStream(doc, "b1");
    doc = appendStream(doc, "b1", "Hello ");
    doc = appendStream(doc, "b1", "World");
    expect(getBlock(doc, "b1")!.content).toBe("Hello World");
  });

  it("ends streaming and sets responsibility color", () => {
    let doc = createDocument("p", "a", "t");
    const block = makeBlock({ id: "b1", content: "" });
    doc = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
    doc = startStream(doc, "b1");
    doc = appendStream(doc, "b1", "content");
    doc = endStream(doc, "b1", "green");
    expect(getBlock(doc, "b1")!.isStreaming).toBe(false);
    expect(getBlock(doc, "b1")!.responsibilityColor).toBe("green");
  });

  it("pauses streaming but preserves content", () => {
    let doc = createDocument("p", "a", "t");
    const block = makeBlock({ id: "b1", content: "" });
    doc = applyOperation(doc, { type: "insert_block", blockId: "b1", afterBlockId: null, block });
    doc = startStream(doc, "b1");
    doc = appendStream(doc, "b1", "partial content");
    doc = pauseStream(doc, "b1");
    expect(getBlock(doc, "b1")!.isStreaming).toBe(false);
    expect(getBlock(doc, "b1")!.content).toBe("partial content");
  });
});

describe("AI commands", () => {
  it("shortens a block", () => {
    const block = makeBlock({ id: "b1", content: "long content" });
    const result = shorten(block);
    expect(result.content).toBe("[shortened] long content");
  });

  it("expands a block", () => {
    const block = makeBlock({ id: "b1", content: "short" });
    const result = expand(block);
    expect(result.content).toBe("[expanded] short");
  });

  it("academicizes a block", () => {
    const block = makeBlock({ id: "b1", content: "casual text" });
    const result = academicize(block);
    expect(result.content).toBe("[academic] casual text");
  });

  it("adds a citation evidence ref", () => {
    const block = makeBlock({ id: "b1", evidenceRefs: [] });
    const result = addCitation(block, "cite-1");
    expect(result.evidenceRefs).toEqual(["cite-1"]);
  });

  it("adds an example to a block", () => {
    const block = makeBlock({ id: "b1", content: "text" });
    const result = addExample(block);
    expect(result.content).toBe("text [example added]");
  });

  it("reduces repetition in a block", () => {
    const block = makeBlock({ id: "b1", content: "repetitive text" });
    const result = reduceRepetition(block);
    expect(result.content).toBe("[reduced] repetitive text");
  });

  it("converts a block to slide type", () => {
    const block = makeBlock({ id: "b1", type: "paragraph" });
    const result = toSlide(block);
    expect(result.type).toBe("slide");
  });
});
