import type { PaperMatrix, ComparisonMatrix } from "./types.js";

interface SectionMap {
  [key: string]: string;
}

function parseSectionsByHeadings(content: string): SectionMap {
  const sections: SectionMap = {};
  const lines = content.split("\n");
  let currentHeading = "abstract";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections[currentHeading] = currentContent.join(" ").trim();
      }
      currentHeading = headingMatch[1]?.toLowerCase().replace(/[^a-z0-9]/g, "_") ?? "untitled";
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections[currentHeading] = currentContent.join(" ").trim();
  }

  return sections;
}

function extractSectionText(sections: SectionMap, keywords: string[]): string {
  for (const keyword of keywords) {
    for (const [key, value] of Object.entries(sections)) {
      if (key.includes(keyword)) {
        return value.slice(0, 500);
      }
    }
  }
  return "Not specified in source";
}

function extractYears(content: string): number[] {
  const yearRegex = /\b(19|20)\d{2}\b/g;
  const matches = content.match(yearRegex);
  if (!matches) return [];
  return [...new Set(matches.map(Number))].sort((a, b) => a - b);
}

export class PaperAnalyzer {
  analyzeSinglePaper(sourceId: string, content: string): PaperMatrix {
    const sections = parseSectionsByHeadings(content);

    return {
      sourceId,
      problem: extractSectionText(sections, ["problem", "introduction", "background", "motivation"]),
      method: extractSectionText(sections, ["method", "approach", "methodology", "framework"]),
      data: extractSectionText(sections, ["data", "dataset", "corpus", "benchmark"]),
      metrics: extractSectionText(sections, ["metric", "evaluation", "measure", "score"]),
      mainResults: extractSectionText(sections, ["result", "finding", "experiment", "outcome"]),
      limitations: extractSectionText(sections, ["limitation", "constraint", "weakness", "future"]),
      futureWork: extractSectionText(sections, ["future", "direction", "extension", "next"]),
      responsibilityColor: "gray"
    };
  }

  buildComparisonMatrix(projectId: string, papers: PaperMatrix[]): ComparisonMatrix {
    const methodCategories = this.extractMethodCategories(papers);
    const timeline = this.buildTimeline(papers);
    const controversies = this.findControversies(papers);
    const researchGaps = this.identifyResearchGaps(papers);
    const suggestedOutline = this.generateSuggestedOutline(papers);

    return {
      projectId,
      papers,
      methodCategories,
      timeline,
      controversies,
      researchGaps,
      suggestedOutline
    };
  }

  private extractMethodCategories(papers: PaperMatrix[]): string[] {
    const categories = new Set<string>();
    for (const paper of papers) {
      const methodWords = paper.method.toLowerCase().split(/\s+/);
      for (const word of methodWords) {
        if (word.length > 4) {
          categories.add(word);
        }
      }
    }
    return [...categories].slice(0, 10);
  }

  private buildTimeline(papers: PaperMatrix[]): Array<{ year: number; event: string }> {
    const events: Array<{ year: number; event: string }> = [];
    for (const paper of papers) {
      const years = extractYears(paper.method + " " + paper.mainResults);
      for (const year of years) {
        events.push({
          year,
          event: `Findings from ${paper.sourceId}`
        });
      }
    }
    return events.sort((a, b) => a.year - b.year);
  }

  private findControversies(papers: PaperMatrix[]): Array<{ topic: string; positions: Array<{ sourceId: string; position: string }> }> {
    if (papers.length < 2) return [];

    const controversies: Array<{ topic: string; positions: Array<{ sourceId: string; position: string }> }> = [];

    const topicKeywords = ["method", "data", "metrics"];
    for (const keyword of topicKeywords) {
      const positions = papers.map(p => ({
        sourceId: p.sourceId,
        position: p[keyword as keyof PaperMatrix] as string
      }));

      const uniquePositions = new Set(positions.map(p => p.position));
      if (uniquePositions.size > 1) {
        controversies.push({
          topic: `Differences in ${keyword}`,
          positions
        });
      }
    }

    return controversies;
  }

  private identifyResearchGaps(papers: PaperMatrix[]): string[] {
    const gaps: string[] = [];
    const allLimitations = papers.flatMap(p => p.limitations.split(/[.;]/).map(s => s.trim()).filter(s => s.length > 10));
    const allFutureWork = papers.flatMap(p => p.futureWork.split(/[.;]/).map(s => s.trim()).filter(s => s.length > 10));

    const combined = [...allLimitations, ...allFutureWork];
    const seen = new Set<string>();
    for (const item of combined) {
      const key = item.toLowerCase().slice(0, 40);
      if (!seen.has(key)) {
        seen.add(key);
        gaps.push(item);
      }
    }

    return gaps.slice(0, 5);
  }

  private generateSuggestedOutline(papers: PaperMatrix[]): Array<{ section: string; keyPoints: string[] }> {
    const outline: Array<{ section: string; keyPoints: string[] }> = [
      {
        section: "Introduction",
        keyPoints: papers.map(p => p.problem).filter(p => p !== "Not specified in source").slice(0, 3)
      },
      {
        section: "Methodology Comparison",
        keyPoints: papers.map(p => p.method).filter(m => m !== "Not specified in source").slice(0, 3)
      },
      {
        section: "Results Analysis",
        keyPoints: papers.map(p => p.mainResults).filter(r => r !== "Not specified in source").slice(0, 3)
      },
      {
        section: "Limitations and Future Work",
        keyPoints: papers.map(p => p.limitations).filter(l => l !== "Not specified in source").slice(0, 3)
      }
    ];

    return outline;
  }
}
