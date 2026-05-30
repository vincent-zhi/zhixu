import type { SubmissionChecklist, VenueRequirement, ChecklistItem, LLMCallable } from "./types.js";

const VENUE_REQUIREMENTS: Record<string, Array<{ category: string; requirement: string }>> = {
  IEEE: [
    { category: "format", requirement: "Double-column format" },
    { category: "format", requirement: "Page limit: 8-10 pages" },
    { category: "structure", requirement: "Abstract under 250 words" },
    { category: "structure", requirement: "Keywords section" },
    { category: "citation", requirement: "IEEE citation style" },
    { category: "content", requirement: "Experimental validation" },
    { category: "content", requirement: "Comparison with state-of-the-art" },
  ],
  ACM: [
    { category: "format", requirement: "ACM format template" },
    { category: "format", requirement: "Page limit: 10-12 pages" },
    { category: "structure", requirement: "Abstract under 300 words" },
    { category: "structure", requirement: "CCS concepts" },
    { category: "citation", requirement: "ACM reference format" },
    { category: "content", requirement: "Reproducibility statement" },
    { category: "content", requirement: "Artifact availability" },
  ],
  Nature: [
    { category: "format", requirement: "Single-column format" },
    { category: "format", requirement: "Article length: 3000-5000 words" },
    { category: "structure", requirement: "Abstract under 200 words" },
    { category: "structure", requirement: "Methods section" },
    { category: "citation", requirement: "Nature citation style" },
    { category: "content", requirement: "Statistical significance" },
    { category: "content", requirement: "Data availability statement" },
    { category: "content", requirement: "Code availability statement" },
  ],
};

function matchRequirement(content: string, requirement: string): boolean {
  const lower = content.toLowerCase();
  const keywords = requirement.toLowerCase().split(/\s+/);
  return keywords.some((kw) => lower.includes(kw));
}

export class SubmissionChecker {
  checkSubmission(input: {
    targetVenue: string;
    artifactContent: string;
    requirements?: Array<{ category: string; requirement: string }>;
  }): SubmissionChecklist {
    const venueKey = Object.keys(VENUE_REQUIREMENTS).find(
      (k) => k.toLowerCase() === input.targetVenue.toLowerCase(),
    );

    const reqDefs = input.requirements ?? (venueKey ? VENUE_REQUIREMENTS[venueKey]! : []);

    const requirements: VenueRequirement[] = reqDefs.map((req) => ({
      category: req.category,
      requirement: req.requirement,
      met: matchRequirement(input.artifactContent, req.requirement),
      notes: "",
    }));

    const checks: ChecklistItem[] = requirements.map((req) => ({
      id: crypto.randomUUID(),
      category: req.category,
      description: req.requirement,
      status: req.met ? ("pass" as const) : ("fail" as const),
      details: req.met ? "Requirement detected in content" : "Requirement not found in content",
    }));

    const passedCount = checks.filter((c) => c.status === "pass").length;
    const overallReadiness = checks.length > 0
      ? Math.round((passedCount / checks.length) * 100)
      : 0;

    return {
      id: crypto.randomUUID(),
      projectId: "",
      targetVenue: input.targetVenue,
      requirements,
      checks,
      overallReadiness,
    };
  }

  async checkSubmissionEnhanced(
    content: string,
    venue: string,
    llm: LLMCallable,
    customRequirements?: string[]
  ): Promise<SubmissionChecklist & { aiAnalysis: string[] }> {
    const basic = this.checkSubmission({ targetVenue: venue, artifactContent: content });
    try {
      const result = await llm.chat({
        system: `你是一位学术期刊投稿检查助手。检查论文内容是否满足投稿要求。
返回 JSON：{"readiness": 0.0-1.0, "analysis": ["具体修改建议1", "..."], "missing": ["缺失项1", "..."]}`,
        messages: [{ role: "user", content: `目标期刊/会议：${venue}\n${customRequirements ? `额外要求：${customRequirements.join("、")}\n` : ""}论文内容（节选）：\n${content.slice(0, 4000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const aiReadiness = parsed.readiness != null ? Math.round(parsed.readiness * 100) : basic.overallReadiness;
      return { ...basic, overallReadiness: aiReadiness, aiAnalysis: parsed.analysis ?? [] };
    } catch {
      return { ...basic, aiAnalysis: [] };
    }
  }
}
