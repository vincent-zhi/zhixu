import type { PaperEntry, PaperMatrix, ComparisonField, TimelineEntry, LLMCallable } from "./types.js";

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
      currentHeading = headingMatch[1]!.toLowerCase().replace(/[^a-z0-9]/g, "_");
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

function extractTitle(sections: SectionMap, content: string): string {
  if (sections.title) return sections.title.slice(0, 200);
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) return titleMatch[1]!.trim();
  return "Untitled";
}

function extractAuthors(sections: SectionMap): string[] {
  const authorSection = sections.authors ?? sections.author ?? "";
  if (!authorSection) return [];
  return authorSection
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function extractYear(content: string): number {
  const yearRegex = /\b(19|20)\d{2}\b/;
  const match = content.match(yearRegex);
  return match ? parseInt(match[0]!, 10) : new Date().getFullYear();
}

function extractVenue(sections: SectionMap): string {
  return sections.venue ?? sections.journal ?? sections.conference ?? "Unknown venue";
}

function extractMetrics(sections: SectionMap): string[] {
  const metricsSection = extractSectionText(sections, ["metric", "evaluation", "measure"]);
  if (metricsSection === "Not specified in source") return [];
  return metricsSection
    .split(/[,;]/)
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

function extractDoi(content: string): string | null {
  const doiMatch = content.match(/10\.\d{4,}\/[^\s]+/);
  return doiMatch ? doiMatch[0]! : null;
}

export class PaperReader {
  readPaper(source: { id: string; fileName: string; content: string }): PaperEntry {
    const sections = parseSectionsByHeadings(source.content);

    return {
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: extractTitle(sections, source.content),
      authors: extractAuthors(sections),
      year: extractYear(source.content),
      venue: extractVenue(sections),
      problem: extractSectionText(sections, ["problem", "introduction", "background", "motivation"]),
      method: extractSectionText(sections, ["method", "approach", "methodology", "framework"]),
      dataset: extractSectionText(sections, ["data", "dataset", "corpus", "benchmark"]),
      metrics: extractMetrics(sections),
      mainResults: extractSectionText(sections, ["result", "finding", "experiment", "outcome"]),
      limitations: extractSectionText(sections, ["limitation", "constraint", "weakness"]),
      futureWork: extractSectionText(sections, ["future", "direction", "extension", "next"]),
      relevanceToProject: "",
      doi: extractDoi(source.content),
    };
  }

  comparePapers(papers: PaperEntry[]): PaperMatrix {
    const comparisonMatrix = this.buildComparisonMatrix(papers);
    const researchGaps = this.identifyResearchGaps(papers);
    const controversies = this.findControversies(papers);
    const timeline = this.buildTimeline(papers);
    const suggestedOutline = this.generateSuggestedOutline(papers);

    return {
      id: crypto.randomUUID(),
      projectId: "",
      papers,
      comparisonMatrix,
      researchGaps,
      controversies,
      timeline,
      suggestedOutline,
    };
  }

  generateReportOutline(matrix: PaperMatrix): string[] {
    return matrix.suggestedOutline;
  }

  private buildComparisonMatrix(papers: PaperEntry[]): ComparisonField[] {
    const fields: ComparisonField[] = [];
    const fieldNames = ["problem", "method", "dataset", "mainResults", "limitations"] as const;

    for (const fieldName of fieldNames) {
      const values: Record<string, string> = {};
      for (const paper of papers) {
        values[paper.id] = paper[fieldName];
      }
      fields.push({ field: fieldName, values });
    }

    return fields;
  }

  private identifyResearchGaps(papers: PaperEntry[]): string[] {
    const gaps: string[] = [];
    const allLimitations = papers.flatMap((p) =>
      p.limitations
        .split(/[.;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10),
    );
    const allFutureWork = papers.flatMap((p) =>
      p.futureWork
        .split(/[.;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10),
    );

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

  private findControversies(papers: PaperEntry[]): string[] {
    if (papers.length < 2) return [];

    const controversies: string[] = [];
    const fieldNames = ["problem", "method", "dataset"] as const;

    for (const fieldName of fieldNames) {
      const values = new Set(papers.map((p) => p[fieldName]));
      if (values.size > 1) {
        controversies.push(`Differences in ${fieldName} across papers`);
      }
    }

    return controversies;
  }

  private buildTimeline(papers: PaperEntry[]): TimelineEntry[] {
    const yearMap = new Map<number, string[]>();

    for (const paper of papers) {
      const existing = yearMap.get(paper.year) ?? [];
      existing.push(paper.id);
      yearMap.set(paper.year, existing);
    }

    const entries: TimelineEntry[] = [];
    const sortedYears = [...yearMap.keys()].sort((a, b) => a - b);

    for (const year of sortedYears) {
      const paperIds = yearMap.get(year)!;
      entries.push({
        year,
        papers: paperIds,
        milestone: `${paperIds.length} paper(s) published`,
      });
    }

    return entries;
  }

  private generateSuggestedOutline(papers: PaperEntry[]): string[] {
    const outline: string[] = [
      "Introduction and Background",
      "Problem Statement and Research Questions",
      "Methodology Comparison",
      "Dataset and Evaluation Analysis",
      "Results and Findings",
      "Limitations and Research Gaps",
      "Future Directions",
      "Conclusion",
    ];

    return outline;
  }

  async readPaperEnhanced(content: string, llm: LLMCallable): Promise<PaperEntry> {
    const basic = this.readPaper({ id: crypto.randomUUID(), fileName: "", content });
    try {
      const result = await llm.chat({
        system: `你是一位学术论文精读助手。从论文内容中提取结构化信息。
返回 JSON：{"title": "...", "authors": ["..."], "year": 2024, "venue": "...", "problem": "...", "method": "...", "dataset": "...", "metrics": ["..."], "mainResults": "...", "limitations": ["..."], "futureWork": ["..."], "contributions": ["..."], "reproducibility": "..."}`,
        messages: [{ role: "user", content: content.slice(0, 6000) }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, ...parsed, authors: parsed.authors ?? basic.authors, year: parsed.year ?? basic.year };
    } catch {
      return basic;
    }
  }

  async comparePapersEnhanced(
    entries: PaperEntry[],
    llm: LLMCallable,
  ): Promise<
    Omit<PaperMatrix, "controversies"> & {
      methodClassification: Array<{ category: string; papers: string[] }>;
      controversies: Array<{ topic: string; positions: string[] }>;
    }
  > {
    const basic = this.comparePapers(entries);
    try {
      const result = await llm.chat({
        system: `你是一位文献综述助手。对比分析多篇论文，识别方法分类、争议点和研究空白。
返回 JSON：{"methodClassification": [{"category": "...", "papers": ["..."]}], "controversies": [{"topic": "...", "positions": ["..."]}], "researchGaps": ["..."], "suggestedOutline": ["..."]}`,
        messages: [
          {
            role: "user",
            content: entries
              .map(
                (e, i) =>
                  `论文${i + 1}: ${e.title}\n方法: ${e.method}\n结果: ${e.mainResults}\n局限: ${Array.isArray(e.limitations) ? e.limitations.join("、") : e.limitations}`,
              )
              .join("\n\n"),
          },
        ],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return {
        ...basic,
        methodClassification: parsed.methodClassification ?? [],
        controversies: parsed.controversies ?? [],
        researchGaps: parsed.researchGaps ?? basic.researchGaps,
        suggestedOutline: parsed.suggestedOutline ?? basic.suggestedOutline,
      };
    } catch {
      return {
        ...basic,
        methodClassification: [],
        controversies: [],
        researchGaps: basic.researchGaps,
        suggestedOutline: basic.suggestedOutline,
      };
    }
  }
}
