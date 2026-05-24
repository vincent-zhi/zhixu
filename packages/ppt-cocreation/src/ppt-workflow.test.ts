import { describe, it, expect } from "vitest";
import { PPTCoCreationWorkflow } from "./ppt-workflow.js";
import type { PPTCoCreationState } from "./types.js";

describe("PPTCoCreationWorkflow", () => {
  const workflow = new PPTCoCreationWorkflow();

  const sources = [
    { id: "src-1", fileName: "machine_learning_survey.pdf", summary: "A survey on deep learning methods" },
    { id: "src-2", fileName: "neural_network_architecture.pdf", summary: "Novel architecture for NLP tasks" },
    { id: "src-3", fileName: "transformer_models.pdf", summary: "Transformer models and attention mechanisms" }
  ];

  it("starts with topic_selection step", () => {
    const state = workflow.start("proj-1", sources);

    expect(state.projectId).toBe("proj-1");
    expect(state.currentStep).toBe("topic_selection");
    expect(state.topicCandidates).toEqual([]);
    expect(state.selectedTopicId).toBeNull();
    expect(state.slideOutlines).toEqual([]);
    expect(state.selectedStyle).toBeNull();
    expect(state.consistencyCheckResult).toBeNull();
  });

  it("generates 3 topic candidates", () => {
    const state = workflow.start("proj-1", sources);
    const updated = workflow.generateTopicCandidates(state, [
      "Deep learning survey covering various methods",
      "Neural network architectures for NLP",
      "Transformer attention mechanisms"
    ]);

    expect(updated.topicCandidates).toHaveLength(3);
    expect(updated.topicCandidates[0].id).toBe("topic-1");
    expect(updated.topicCandidates[1].id).toBe("topic-2");
    expect(updated.topicCandidates[2].id).toBe("topic-3");
    expect(updated.currentStep).toBe("topic_selection");
  });

  it("selects a topic and moves to outline_generation", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-2");

    expect(selected.selectedTopicId).toBe("topic-2");
    expect(selected.currentStep).toBe("outline_generation");
  });

  it("does not select a non-existent topic", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-999");

    expect(selected.selectedTopicId).toBeNull();
    expect(selected.currentStep).toBe("topic_selection");
  });

  it("generates slide outlines after topic selection", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);

    expect(withOutline.slideOutlines.length).toBeGreaterThanOrEqual(5);
    expect(withOutline.slideOutlines.length).toBeLessThanOrEqual(10);
    expect(withOutline.currentStep).toBe("slide_confirmation");
    expect(withOutline.slideOutlines[0].status).toBe("proposed");
    expect(withOutline.slideOutlines[0].layoutType).toBe("title");
  });

  it("confirms a single slide", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const confirmed = workflow.confirmSlide(withOutline, "slide-1");

    expect(confirmed.slideOutlines[0].status).toBe("confirmed");
    expect(confirmed.slideOutlines[1].status).toBe("proposed");
  });

  it("confirms all slides and moves to style_selection", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const allConfirmed = workflow.confirmAllSlides(withOutline);

    expect(allConfirmed.slideOutlines.every(s => s.status === "confirmed")).toBe(true);
    expect(allConfirmed.currentStep).toBe("style_selection");
  });

  it("selects a style and moves to content_generation", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const allConfirmed = workflow.confirmAllSlides(withOutline);
    const withStyle = workflow.selectStyle(allConfirmed, "academic_navy");

    expect(withStyle.selectedStyle).toBe("academic_navy");
    expect(withStyle.currentStep).toBe("content_generation");
  });

  it("rejects invalid style", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const allConfirmed = workflow.confirmAllSlides(withOutline);
    const withStyle = workflow.selectStyle(allConfirmed, "invalid_style");

    expect(withStyle.selectedStyle).toBeNull();
    expect(withStyle.currentStep).toBe("style_selection");
  });

  it("runs consistency check and detects issues", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const allConfirmed = workflow.confirmAllSlides(withOutline);
    const withStyle = workflow.selectStyle(allConfirmed, "academic_navy");
    const checked = workflow.runConsistencyCheck(withStyle);

    expect(checked.consistencyCheckResult).not.toBeNull();
    expect(checked.currentStep).toBe("consistency_check");
    const warningIssues = checked.consistencyCheckResult!.issues.filter(i => i.severity === "warning");
    expect(warningIssues.length).toBeGreaterThan(0);
  });

  it("marks export ready after consistency check", () => {
    const state = workflow.start("proj-1", sources);
    const withCandidates = workflow.generateTopicCandidates(state, ["summary1", "summary2", "summary3"]);
    const selected = workflow.selectTopic(withCandidates, "topic-1");
    const withOutline = workflow.generateOutline(selected);
    const allConfirmed = workflow.confirmAllSlides(withOutline);
    const withStyle = workflow.selectStyle(allConfirmed, "paper_white");
    const checked = workflow.runConsistencyCheck(withStyle);
    const exportReady = workflow.markExportReady(checked);

    expect(exportReady.currentStep).toBe("export_ready");
  });

  it("runs full flow from start to export_ready", () => {
    let state = workflow.start("proj-full", sources);
    expect(state.currentStep).toBe("topic_selection");

    state = workflow.generateTopicCandidates(state, ["AI survey methods", "Neural network architectures", "Transformer attention"]);
    expect(state.topicCandidates).toHaveLength(3);

    state = workflow.selectTopic(state, "topic-1");
    expect(state.currentStep).toBe("outline_generation");

    state = workflow.generateOutline(state);
    expect(state.currentStep).toBe("slide_confirmation");
    expect(state.slideOutlines.length).toBeGreaterThanOrEqual(5);

    state = workflow.confirmAllSlides(state);
    expect(state.currentStep).toBe("style_selection");

    state = workflow.selectStyle(state, "minimalist");
    expect(state.currentStep).toBe("content_generation");

    state = workflow.runConsistencyCheck(state);
    expect(state.currentStep).toBe("consistency_check");

    state = workflow.markExportReady(state);
    expect(state.currentStep).toBe("export_ready");
  });
});
