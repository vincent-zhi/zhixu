import type { ResearchGap, LLMCallable } from "./types.js";

export class ResearchGapAnalyzer {
  analyzeGaps(
    papers: Array<{ title: string; limitations: string; futureWork: string }>,
  ): ResearchGap[] {
    const gaps: ResearchGap[] = [];

    for (const paper of papers) {
      const limitationParts = paper.limitations
        .split(/[.;。；]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      const futureWorkParts = paper.futureWork
        .split(/[.;。；]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const limitation of limitationParts) {
        gaps.push({
          id: crypto.randomUUID(),
          projectId: "",
          description: limitation,
          evidence: [paper.title],
          feasibility: 5,
          risk: 5,
          requiredExperiments: [],
          relatedPapers: [paper.title],
        });
      }

      for (const future of futureWorkParts) {
        gaps.push({
          id: crypto.randomUUID(),
          projectId: "",
          description: future,
          evidence: [paper.title],
          feasibility: 7,
          risk: 3,
          requiredExperiments: [],
          relatedPapers: [paper.title],
        });
      }
    }

    const mergedGaps = this.mergeSimilarGaps(gaps);
    return mergedGaps.map((gap) => ({
      ...gap,
      feasibility: this.estimateFeasibility(gap),
      risk: this.estimateRisk(gap),
    }));
  }

  scoreGap(gap: ResearchGap): number {
    const feasibilityScore = gap.feasibility / 10;
    const evidenceScore = Math.min(1, gap.evidence.length / 3);
    const riskPenalty = gap.risk / 20;
    return Math.round((feasibilityScore * 0.4 + evidenceScore * 0.3 + (1 - riskPenalty) * 0.3) * 100);
  }

  private mergeSimilarGaps(gaps: ResearchGap[]): ResearchGap[] {
    const merged: ResearchGap[] = [];
    const used = new Set<number>();

    for (let i = 0; i < gaps.length; i++) {
      if (used.has(i)) continue;

      const current = { ...gaps[i]! };
      const similarIndices: number[] = [];

      for (let j = i + 1; j < gaps.length; j++) {
        if (used.has(j)) continue;

        const other = gaps[j]!;
        const words1 = new Set(current.description.toLowerCase().split(/\s+/));
        const words2 = new Set(other.description.toLowerCase().split(/\s+/));
        const intersection = [...words1].filter((w) => words2.has(w) && w.length > 3);
        const union = new Set([...words1, ...words2]);

        if (union.size > 0 && intersection.length / union.size > 0.3) {
          similarIndices.push(j);
        }
      }

      for (const idx of similarIndices) {
        used.add(idx);
        const other = gaps[idx]!;
        current.evidence = [...new Set([...current.evidence, ...other.evidence])];
        current.relatedPapers = [...new Set([...current.relatedPapers, ...other.relatedPapers])];
      }

      merged.push(current);
    }

    return merged;
  }

  private estimateFeasibility(gap: ResearchGap): number {
    let score = 5;
    if (gap.evidence.length >= 3) score += 2;
    else if (gap.evidence.length >= 2) score += 1;
    if (gap.description.length > 50) score += 1;
    return Math.min(10, score);
  }

  private estimateRisk(gap: ResearchGap): number {
    let score = 5;
    if (gap.evidence.length <= 1) score += 2;
    if (gap.requiredExperiments.length > 3) score += 1;
    return Math.min(10, score);
  }

  async analyzeGapsEnhanced(
    papers: string[],
    llm: LLMCallable
  ): Promise<ResearchGap[] & { aiDirections: Array<{ direction: string; rationale: string; feasibility: number }> }> {
    const structuredPapers = papers.map((p, i) => ({
      title: `Paper ${i + 1}`,
      limitations: p,
      futureWork: p,
    }));
    const gaps = this.analyzeGaps(structuredPapers);
    try {
      const result = await llm.chat({
        system: `你是一位科研方向规划助手。综合多篇论文的局限性和未来工作，推荐 3-5 个可行的研究方向。
返回 JSON：{"directions": [{"direction": "研究方向描述", "rationale": "基于哪些论文的什么空白", "feasibility": 0.0-1.0}]}`,
        messages: [{ role: "user", content: `论文内容：\n${papers.slice(0, 5).map((p, i) => `论文${i + 1}：\n${p.slice(0, 2000)}`).join("\n\n")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const aiDirections: Array<{ direction: string; rationale: string; feasibility: number }> = (parsed.directions ?? []).map((d: any) => ({
        direction: d.direction ?? "",
        rationale: d.rationale ?? "",
        feasibility: typeof d.feasibility === "number" ? d.feasibility : 0.5,
      }));
      return Object.assign(gaps, { aiDirections });
    } catch {
      return Object.assign(gaps, { aiDirections: [] });
    }
  }
}
