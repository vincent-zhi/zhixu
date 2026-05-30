import type { GrantApplication, GrantSection, LLMCallable } from "./types.js";

const SECTION_CONNECTIONS: Record<string, string[]> = {
  background: ["innovation", "methodology"],
  innovation: ["background", "methodology", "feasibility"],
  methodology: ["background", "innovation", "feasibility"],
  feasibility: ["methodology", "innovation", "budget"],
  foundation: ["background", "innovation"],
  budget: ["methodology", "feasibility", "timeline"],
  timeline: ["methodology", "budget"],
};

export class GrantApplicationHelper {
  analyzeGrant(input: { grantType: string; sections: GrantSection[] }): GrantApplication {
    const logicGaps = this.checkLogicGaps(input.sections);
    const evidenceGaps = this.checkEvidenceGaps(input.sections);

    const filledSections = input.sections.filter((s) => s.content.length > 0);
    const completeness = input.sections.length > 0
      ? Math.round((filledSections.length / input.sections.length) * 100)
      : 0;

    return {
      id: crypto.randomUUID(),
      projectId: "",
      grantType: input.grantType,
      sections: input.sections,
      completeness,
      logicGaps,
      evidenceGaps,
    };
  }

  checkLogicGaps(sections: GrantSection[]): string[] {
    const gaps: string[] = [];
    const sectionTypes = new Set(sections.map((s) => s.type));

    const requiredSections = ["background", "innovation", "methodology", "feasibility"];
    for (const required of requiredSections) {
      if (!sectionTypes.has(required as GrantSection["type"])) {
        gaps.push(`Missing required section: ${required}`);
      }
    }

    for (const section of sections) {
      const connections = SECTION_CONNECTIONS[section.type] ?? [];
      for (const connected of connections) {
        if (sectionTypes.has(connected as GrantSection["type"])) {
          const connectedSection = sections.find((s) => s.type === connected);
          if (connectedSection && section.content.length > 0 && connectedSection.content.length > 0) {
            const sectionKeywords = new Set(
              section.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4),
            );
            const connectedKeywords = new Set(
              connectedSection.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4),
            );
            const overlap = [...sectionKeywords].filter((w) => connectedKeywords.has(w));
            if (overlap.length === 0) {
              gaps.push(
                `Weak logical connection between ${section.type} and ${connected}`,
              );
            }
          }
        }
      }
    }

    return gaps;
  }

  checkEvidenceGaps(sections: GrantSection[]): string[] {
    const gaps: string[] = [];
    const evidenceKeywords = ["data", "result", "experiment", "evidence", "证明", "验证", "实验", "数据"];

    for (const section of sections) {
      if (section.content.length === 0) continue;

      const lower = section.content.toLowerCase();
      const hasEvidence = evidenceKeywords.some((kw) => lower.includes(kw));

      if (!hasEvidence && (section.type === "methodology" || section.type === "feasibility")) {
        gaps.push(`Section "${section.type}" lacks supporting evidence or data`);
      }

      const sentences = section.content.split(/[.!?。！？]/).filter((s) => s.trim().length > 0);
      const claimPatterns = ["will", "can", "should", "would", "能够", "将", "应该"];
      for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        if (claimPatterns.some((p) => lowerSentence.includes(p))) {
          const hasSupport = evidenceKeywords.some((kw) => lowerSentence.includes(kw));
          if (!hasSupport) {
            gaps.push(`Unsupported claim in ${section.type}: "${sentence.trim().slice(0, 80)}"`);
            break;
          }
        }
      }
    }

    return gaps;
  }

  async analyzeGrantEnhanced(
    application: GrantApplication,
    llm: LLMCallable
  ): Promise<{ logicGaps: string[]; evidenceGaps: string[]; completeness: number; aiReview: string[] }> {
    const basic = this.analyzeGrant({ grantType: application.grantType, sections: application.sections });
    try {
      const result = await llm.chat({
        system: `你是一位基金申报评审助手。评估课题申报书的逻辑完整性、创新点清晰度和技术路线可行性。
返回 JSON：{"completeness": 0.0-1.0, "review": ["具体修改建议1", "..."], "strengths": ["优点1", "..."]}`,
        messages: [{ role: "user", content: application.sections.map(s => `【${s.title}】\n${s.content}`).join("\n\n") }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const aiCompleteness = parsed.completeness != null ? Math.round(parsed.completeness * 100) : basic.completeness;
      return { ...basic, completeness: aiCompleteness, aiReview: parsed.review ?? [] };
    } catch {
      return { ...basic, aiReview: [] };
    }
  }
}
