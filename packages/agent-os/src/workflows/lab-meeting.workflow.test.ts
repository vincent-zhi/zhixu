import { describe, expect, it } from "vitest";
import { labMeetingWorkflow } from "./lab-meeting.workflow.js";

describe("labMeetingWorkflow", () => {
  it("defines the lab meeting workflow in the expected order", () => {
    expect(labMeetingWorkflow.nodes.map((node) => node.id)).toEqual([
      "understanding",
      "brief",
      "paper_reading_group",
      "matrix_generation",
      "presentation_paths",
      "select_path",
      "slide_outline",
      "speaker_notes",
      "advisor_questions",
      "verification"
    ]);
  });

  it("declares paper reading as a parallel-capable node", () => {
    const paperReading = labMeetingWorkflow.nodes.find((node) => node.id === "paper_reading_group");
    expect(paperReading?.type).toBe("parallel");
    expect(paperReading?.ref).toBe("paper.readAllPapers");
    expect(paperReading?.outputKey).toBe("paperCards");
  });

  it("uses a human gate for presentation path selection", () => {
    const selectPath = labMeetingWorkflow.nodes.find((node) => node.id === "select_path");
    expect(selectPath?.type).toBe("human_gate");
    expect(selectPath?.outputKey).toBe("selectedPathId");
  });
});
