import { describe, expect, it } from "vitest";
import { isSensitiveSourceLevel, ProjectEventSchema } from "./workflow.js";

describe("agent workflow contracts", () => {
  it("accepts project-scoped source intake events", () => {
    const event = ProjectEventSchema.parse({
      eventType: "source_intake_requested",
      actorId: "user_demo",
      payload: { fileName: "paper.pdf" }
    });

    expect(event.eventType).toBe("source_intake_requested");
  });

  it("classifies PRD-sensitive source levels", () => {
    expect(isSensitiveSourceLevel("unpublished_paper")).toBe(true);
    expect(isSensitiveSourceLevel("course_internal")).toBe(true);
    expect(isSensitiveSourceLevel("normal")).toBe(false);
  });
});
