import { describe, expect, it } from "vitest";
import { FeedbackProcessor } from "./feedback-processor.js";
import { PreferenceTracker } from "./preference-tracker.js";
import type { FeedbackItem, RectificationItem } from "./types.js";

describe("FeedbackProcessor", () => {
  it("ingests feedback with all fields", () => {
    const processor = new FeedbackProcessor();
    const item = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改第三段的引用格式",
      mentorId: "mentor1"
    });
    expect(item.id).toBeTruthy();
    expect(item.projectId).toBe("proj1");
    expect(item.sourceType).toBe("text");
    expect(item.rawContent).toBe("请修改第三段的引用格式");
    expect(item.mentorId).toBe("mentor1");
    expect(item.createdAt).toBeTruthy();
  });

  it("ingests feedback without mentorId", () => {
    const processor = new FeedbackProcessor();
    const item = processor.ingestFeedback("proj1", {
      sourceType: "pdf_annotation",
      rawContent: "数据有误"
    });
    expect(item.mentorId).toBeUndefined();
  });

  it("decomposes feedback into rectification items by sentence", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改第三段。补充引用文献。注意数据一致性。"
    });
    const items = processor.decomposeFeedback(feedback);
    expect(items.length).toBe(3);
    expect(items[0].description).toBe("请修改第三段");
    expect(items[1].description).toBe("补充引用文献");
    expect(items[2].description).toBe("注意数据一致性");
  });

  it("assigns priority 5 for high-priority keywords", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改这段内容。"
    });
    const items = processor.decomposeFeedback(feedback);
    expect(items[0].priority).toBe(5);
  });

  it("assigns priority 3 for medium-priority keywords", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "建议增加更多数据支撑。"
    });
    const items = processor.decomposeFeedback(feedback);
    expect(items[0].priority).toBe(3);
  });

  it("assigns priority 2 for low-priority keywords", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "注意格式规范。"
    });
    const items = processor.decomposeFeedback(feedback);
    expect(items[0].priority).toBe(2);
  });

  it("assigns default priority 3 when no keywords match", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "这里写得不错。"
    });
    const items = processor.decomposeFeedback(feedback);
    expect(items[0].priority).toBe(3);
  });

  it("binds rectification item to an entity", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改这段。"
    });
    const items = processor.decomposeFeedback(feedback);
    const bound = processor.bindToEntity(items[0], "slide", "slide_42");
    expect(bound.boundEntityType).toBe("slide");
    expect(bound.boundEntityId).toBe("slide_42");
  });

  it("marks rectification item as completed", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改这段。"
    });
    const items = processor.decomposeFeedback(feedback);
    const completed = processor.markCompleted(items[0], "v2");
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
    expect(completed.versionAfterFix).toBe("v2");
  });

  it("creates rectification items linked to the feedback item", () => {
    const processor = new FeedbackProcessor();
    const feedback = processor.ingestFeedback("proj1", {
      sourceType: "text",
      rawContent: "请修改。补充数据。"
    });
    const items = processor.decomposeFeedback(feedback);
    for (const item of items) {
      expect(item.feedbackItemId).toBe(feedback.id);
      expect(item.projectId).toBe("proj1");
      expect(item.status).toBe("pending");
      expect(item.boundEntityId).toBeNull();
    }
  });
});

describe("PreferenceTracker", () => {
  it("extracts preferences from feedback", () => {
    const tracker = new PreferenceTracker();
    const feedback: FeedbackItem = {
      id: "fb1",
      projectId: "proj1",
      sourceType: "text",
      rawContent: "请修改引用格式，数据不够准确",
      mentorId: "mentor1",
      createdAt: new Date().toISOString()
    };
    const pref = tracker.extractPreferences(feedback);
    expect(pref.mentorId).toBe("mentor1");
    const categories = pref.preferences.map((p) => p.category);
    expect(categories).toContain("citation");
    expect(categories).toContain("formatting");
    expect(categories).toContain("data");
  });

  it("accumulates frequency across multiple feedbacks", () => {
    const tracker = new PreferenceTracker();

    const fb1: FeedbackItem = {
      id: "fb1",
      projectId: "proj1",
      sourceType: "text",
      rawContent: "引用格式需要修改",
      mentorId: "mentor1",
      createdAt: new Date().toISOString()
    };
    tracker.extractPreferences(fb1);

    const fb2: FeedbackItem = {
      id: "fb2",
      projectId: "proj1",
      sourceType: "text",
      rawContent: "引用不够规范",
      mentorId: "mentor1",
      createdAt: new Date().toISOString()
    };
    const pref = tracker.extractPreferences(fb2);

    const citationPref = pref.preferences.find((p) => p.category === "citation");
    expect(citationPref).toBeDefined();
    expect(citationPref!.frequency).toBe(2);
  });

  it("returns empty preferences for unknown mentor", () => {
    const tracker = new PreferenceTracker();
    const pref = tracker.getPreferences("unknown");
    expect(pref.preferences).toEqual([]);
  });

  it("isolates preferences per mentor", () => {
    const tracker = new PreferenceTracker();

    const fb1: FeedbackItem = {
      id: "fb1",
      projectId: "proj1",
      sourceType: "text",
      rawContent: "逻辑有问题",
      mentorId: "mentor1",
      createdAt: new Date().toISOString()
    };
    tracker.extractPreferences(fb1);

    const fb2: FeedbackItem = {
      id: "fb2",
      projectId: "proj1",
      sourceType: "text",
      rawContent: "表达不够清晰",
      mentorId: "mentor2",
      createdAt: new Date().toISOString()
    };
    tracker.extractPreferences(fb2);

    const pref1 = tracker.getPreferences("mentor1");
    const pref2 = tracker.getPreferences("mentor2");

    expect(pref1.preferences.map((p) => p.category)).toContain("logic");
    expect(pref2.preferences.map((p) => p.category)).toContain("expression");
  });
});
