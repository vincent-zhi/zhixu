import type { PPTCoCreationState, TopicCandidate, SlideOutline } from "./types.js";

function extractThemesFromFileName(fileName: string): string[] {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
  const words = baseName.split(/\s+/).filter(w => w.length > 2);
  return words;
}

export class PPTCoCreationWorkflow {
  start(projectId: string, sources: Array<{id: string; fileName: string; summary?: string}>): PPTCoCreationState {
    return {
      projectId,
      currentStep: "topic_selection",
      topicCandidates: [],
      selectedTopicId: null,
      slideOutlines: [],
      selectedStyle: null,
      consistencyCheckResult: null
    };
  }

  generateTopicCandidates(state: PPTCoCreationState, sourceSummaries: string[]): PPTCoCreationState {
    if (state.currentStep !== "topic_selection") {
      return state;
    }

    const themes = sourceSummaries.flatMap(s => {
      const words = s.split(/\s+/).filter(w => w.length > 3);
      return words.slice(0, 5);
    });

    const uniqueThemes = [...new Set(themes)].slice(0, 3);
    const fallbackThemes = ["Overview and Key Findings", "Methodology and Results", "Implications and Future Work"];

    const candidates: TopicCandidate[] = (uniqueThemes.length >= 3 ? uniqueThemes : fallbackThemes).map((theme, i) => ({
      id: `topic-${i + 1}`,
      title: theme,
      angle: `Focused perspective on ${theme.toLowerCase()}`,
      targetAudience: i === 0 ? "General audience" : i === 1 ? "Domain experts" : "Practitioners",
      estimatedSlides: 8 + i * 2,
      sourceCoverage: Math.min(0.5 + i * 0.15, 1),
      riskLevel: i === 0 ? "L0" as const : i === 1 ? "L1" as const : "L2" as const
    }));

    return {
      ...state,
      topicCandidates: candidates
    };
  }

  selectTopic(state: PPTCoCreationState, topicId: string): PPTCoCreationState {
    if (state.currentStep !== "topic_selection") {
      return state;
    }

    const topic = state.topicCandidates.find(t => t.id === topicId);
    if (!topic) {
      return state;
    }

    return {
      ...state,
      selectedTopicId: topicId,
      currentStep: "outline_generation"
    };
  }

  generateOutline(state: PPTCoCreationState): PPTCoCreationState {
    if (state.currentStep !== "outline_generation") {
      return state;
    }

    const topic = state.topicCandidates.find(t => t.id === state.selectedTopicId);
    if (!topic) {
      return state;
    }

    const slideCount = Math.min(topic.estimatedSlides, 10);
    const layoutTypes: SlideOutline["layoutType"][] = ["title", "content", "two_column", "image_focus", "content", "content", "two_column", "content", "content", "content"];

    const outlines: SlideOutline[] = Array.from({ length: slideCount }, (_, i) => ({
      id: `slide-${i + 1}`,
      orderIndex: i,
      title: i === 0 ? topic.title : `Section ${i}: Key Point ${i}`,
      objective: i === 0 ? "Introduce the topic" : `Explain key point ${i}`,
      layoutType: layoutTypes[i] ?? "content",
      keyPoints: i === 0 ? [topic.title, topic.angle] : [`Detail ${i}A`, `Detail ${i}B`],
      evidenceRefs: i === 0 ? [] : [`ref-${i}`],
      responsibilityColor: i === 0 ? "green" as const : "gray" as const,
      speakerNotes: i === 0 ? `Welcome to the presentation on ${topic.title}` : undefined,
      status: "proposed" as const
    }));

    return {
      ...state,
      slideOutlines: outlines,
      currentStep: "slide_confirmation"
    };
  }

  confirmSlide(state: PPTCoCreationState, slideId: string): PPTCoCreationState {
    if (state.currentStep !== "slide_confirmation") {
      return state;
    }

    const outlines = state.slideOutlines.map(s =>
      s.id === slideId ? { ...s, status: "confirmed" as const } : s
    );

    return {
      ...state,
      slideOutlines: outlines
    };
  }

  confirmAllSlides(state: PPTCoCreationState): PPTCoCreationState {
    if (state.currentStep !== "slide_confirmation") {
      return state;
    }

    const outlines = state.slideOutlines.map(s => ({
      ...s,
      status: "confirmed" as const
    }));

    return {
      ...state,
      slideOutlines: outlines,
      currentStep: "style_selection"
    };
  }

  selectStyle(state: PPTCoCreationState, style: string): PPTCoCreationState {
    if (state.currentStep !== "style_selection") {
      return state;
    }

    const validStyles = ["academic_navy", "paper_white", "minimalist", "vibrant"] as const;
    if (!validStyles.includes(style as typeof validStyles[number])) {
      return state;
    }

    return {
      ...state,
      selectedStyle: style as typeof validStyles[number],
      currentStep: "content_generation"
    };
  }

  runConsistencyCheck(state: PPTCoCreationState): PPTCoCreationState {
    if (state.currentStep !== "content_generation" && state.currentStep !== "local_edit") {
      return state;
    }

    const issues: Array<{ slideId: string; issue: string; severity: "warning" | "error" }> = [];

    for (const slide of state.slideOutlines) {
      if (slide.status !== "confirmed" && slide.status !== "completed") {
        issues.push({
          slideId: slide.id,
          issue: "Slide is not confirmed",
          severity: "error"
        });
      }

      if (!slide.speakerNotes || slide.speakerNotes.trim() === "") {
        issues.push({
          slideId: slide.id,
          issue: "Missing speaker notes",
          severity: "warning"
        });
      }

      if (slide.evidenceRefs.length === 0 && slide.orderIndex > 0) {
        issues.push({
          slideId: slide.id,
          issue: "Low evidence coverage",
          severity: "warning"
        });
      }
    }

    return {
      ...state,
      consistencyCheckResult: {
        passed: issues.filter(i => i.severity === "error").length === 0,
        issues
      },
      currentStep: "consistency_check"
    };
  }

  markExportReady(state: PPTCoCreationState): PPTCoCreationState {
    if (state.currentStep !== "consistency_check") {
      return state;
    }

    return {
      ...state,
      currentStep: "export_ready"
    };
  }
}
