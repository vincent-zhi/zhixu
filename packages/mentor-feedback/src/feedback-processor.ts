import type { FeedbackItem, RectificationItem } from "./types.js";

let feedbackCounter = 0;
let rectCounter = 0;

function nextFeedbackId(): string {
  feedbackCounter += 1;
  return `fb_${feedbackCounter}_${Date.now()}`;
}

function nextRectId(): string {
  rectCounter += 1;
  return `rect_${rectCounter}_${Date.now()}`;
}

const HIGH_PRIORITY_KEYWORDS = ["修改", "补充", "删除", "调整"];
const MEDIUM_PRIORITY_KEYWORDS = ["建议", "可以考虑"];
const LOW_PRIORITY_KEYWORDS = ["注意", "留意"];

function detectPriority(sentence: string): number {
  for (const kw of HIGH_PRIORITY_KEYWORDS) {
    if (sentence.includes(kw)) return 5;
  }
  for (const kw of MEDIUM_PRIORITY_KEYWORDS) {
    if (sentence.includes(kw)) return 3;
  }
  for (const kw of LOW_PRIORITY_KEYWORDS) {
    if (sentence.includes(kw)) return 2;
  }
  return 3;
}

export class FeedbackProcessor {
  ingestFeedback(
    projectId: string,
    input: { sourceType: string; rawContent: string; mentorId?: string }
  ): FeedbackItem {
    const item: FeedbackItem = {
      id: nextFeedbackId(),
      projectId,
      sourceType: input.sourceType as FeedbackItem["sourceType"],
      rawContent: input.rawContent,
      mentorId: input.mentorId,
      createdAt: new Date().toISOString()
    };
    return item;
  }

  decomposeFeedback(feedback: FeedbackItem): RectificationItem[] {
    const sentences = feedback.rawContent
      .split(/[。！？!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences.map((sentence) => {
      const priority = detectPriority(sentence);
      return {
        id: nextRectId(),
        feedbackItemId: feedback.id,
        projectId: feedback.projectId,
        description: sentence,
        boundEntityType: "artifact_block",
        boundEntityId: null,
        status: "pending",
        priority,
        dueAt: null,
        completedAt: null,
        versionAfterFix: null
      };
    });
  }

  bindToEntity(
    item: RectificationItem,
    entityType: RectificationItem["boundEntityType"],
    entityId: string
  ): RectificationItem {
    return {
      ...item,
      boundEntityType: entityType,
      boundEntityId: entityId
    };
  }

  markCompleted(item: RectificationItem, versionAfterFix: string): RectificationItem {
    return {
      ...item,
      status: "completed",
      completedAt: new Date().toISOString(),
      versionAfterFix
    };
  }
}
