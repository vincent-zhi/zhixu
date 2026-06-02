import { describe, expect, it } from "vitest";
import { coursePresentationWorkflow } from "./course-presentation.workflow.js";

describe("coursePresentationWorkflow", () => {
  it("defines the course PPT workflow in the expected order", () => {
    expect(coursePresentationWorkflow.nodes.map((node) => node.id)).toEqual([
      "understanding",
      "brief",
      "topic_candidates",
      "select_topic",
      "slide_outline",
      "speaker_notes",
      "verification"
    ]);
  });

  it("uses a human gate for topic selection", () => {
    const selectTopic = coursePresentationWorkflow.nodes.find((node) => node.id === "select_topic");
    expect(selectTopic?.type).toBe("human_gate");
    expect(selectTopic?.outputKey).toBe("selectedTopicId");
  });

  it("passes raw user input and sources into understanding", () => {
    const understanding = coursePresentationWorkflow.nodes.find((node) => node.id === "understanding");
    expect(understanding?.inputKeys).toEqual(["rawInput", "sources", "dueDate"]);
  });
});
