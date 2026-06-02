import { PPTCoCreationWorkflow } from "@zhixu/ppt-cocreation";
import type { PresentationBrief, TopicCandidateExtended, SlidePlan, SpeakerNotes, RiskLevel, ResponsibilityColor } from "./types.js";

const VALID_RISK_LEVELS = ["L0", "L1", "L2", "L3"] as const;
const VALID_RESPONSIBILITY_COLORS = ["green", "yellow", "gray"] as const;
const VALID_SLIDE_STATUSES = ["proposed", "confirmed", "generating", "completed", "needs_revision"] as const;

function toRiskLevel(v: string): RiskLevel {
  return VALID_RISK_LEVELS.includes(v as RiskLevel) ? (v as RiskLevel) : "L1";
}

function toResponsibilityColor(v: string): ResponsibilityColor {
  return VALID_RESPONSIBILITY_COLORS.includes(v as ResponsibilityColor) ? (v as ResponsibilityColor) : "gray";
}

function toSlideStatus(v: string): SlidePlan["status"] {
  return VALID_SLIDE_STATUSES.includes(v as SlidePlan["status"]) ? (v as SlidePlan["status"]) : "proposed";
}

export class PresentationAgent {
  private readonly workflow = new PPTCoCreationWorkflow();

  async generateTopicCandidates(brief: PresentationBrief): Promise<TopicCandidateExtended[]> {
    const state = this.workflow.start(brief.projectId, brief.sourceIds.map((id) => ({ id, fileName: id })));

    const sourceSummaries = brief.sourceIds.map((id) => `Source ${id}`);
    const updated = this.workflow.generateTopicCandidates(state, sourceSummaries);

    return updated.topicCandidates.map((candidate, i) => ({
      id: candidate.id,
      title: candidate.title,
      angle: candidate.angle,
      targetAudience: candidate.targetAudience,
      estimatedSlides: candidate.estimatedSlides,
      sourceCoverage: candidate.sourceCoverage,
      difficultyLevel: i === 0 ? "easy" as const : i === 1 ? "medium" as const : "hard" as const,
      errorRisk: candidate.riskLevel === "L0" ? "低" : candidate.riskLevel === "L1" ? "中" : "较高",
      canFillDuration: candidate.estimatedSlides * 1.5 >= brief.presentationDuration,
      recommendationReason: `适合${candidate.targetAudience}，预计${candidate.estimatedSlides}页`,
      riskLevel: toRiskLevel(candidate.riskLevel)
    }));
  }

  async generateSlideOutline(topicId: string, brief: PresentationBrief): Promise<SlidePlan[]> {
    const state = this.workflow.start(brief.projectId, brief.sourceIds.map((id) => ({ id, fileName: id })));
    const withTopics = this.workflow.generateTopicCandidates(state, brief.sourceIds.map((id) => `Source ${id}`));
    const selected = this.workflow.selectTopic(withTopics, topicId);
    const withOutline = this.workflow.generateOutline(selected);

    return withOutline.slideOutlines.map((outline) => ({
      id: outline.id,
      orderIndex: outline.orderIndex,
      title: outline.title,
      objective: outline.objective ?? "",
      keyPoints: outline.keyPoints,
      evidenceRefs: outline.evidenceRefs,
      responsibilityColor: toResponsibilityColor(outline.responsibilityColor),
      speakerNotes: outline.speakerNotes ?? "",
      estimatedDurationSeconds: Math.round((brief.presentationDuration * 60) / withOutline.slideOutlines.length),
      layoutType: outline.layoutType === "blank" ? "blank" as const
        : ["title", "content", "two_column", "image_focus"].includes(outline.layoutType)
          ? outline.layoutType as SlidePlan["layoutType"]
          : "content" as const,
      status: toSlideStatus(outline.status)
    }));
  }

  async generateSpeakerNotes(slidePlans: SlidePlan[], durationMinutes: number): Promise<SpeakerNotes[]> {
    const totalSeconds = durationMinutes * 60;
    const perSlide = Math.round(totalSeconds / slidePlans.length);

    return slidePlans.map((plan) => {
      const pacingWarning = perSlide > 180 ? "此页时间较长，注意节奏" : null;
      const nextSlide = slidePlans[plan.orderIndex + 1];

      return {
        slideId: plan.id,
        spokenText: plan.speakerNotes || `接下来介绍${plan.title}。${plan.keyPoints.join("；")}。`,
        estimatedDurationSeconds: perSlide,
        pacingWarning,
        keyTransition: nextSlide ? `接下来我们看${nextSlide.title}` : "以上是本次汇报的全部内容"
      };
    });
  }
}
