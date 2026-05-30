import type { CanvasBlock } from "./types.js";

export function shorten(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[shortened] " + block.content };
}

export function expand(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[expanded] " + block.content };
}

export function academicize(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[academic] " + block.content };
}

export function addExample(block: CanvasBlock): CanvasBlock {
  return { ...block, content: block.content + " [example added]" };
}

export function addCitation(block: CanvasBlock, citation: string): CanvasBlock {
  return { ...block, evidenceRefs: [...block.evidenceRefs, citation] };
}

export function reduceRepetition(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[reduced] " + block.content };
}

export function toSlide(block: CanvasBlock): CanvasBlock {
  return { ...block, type: "slide" };
}

export function generateSpeakerNotes(block: CanvasBlock): CanvasBlock {
  return { ...block, metadata: { ...block.metadata, speakerNotes: "[AI: speaker notes generated]" } };
}

export function summarize(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[summarized] " + block.content };
}

export function translate(block: CanvasBlock): CanvasBlock {
  return { ...block, content: "[translated] " + block.content };
}
