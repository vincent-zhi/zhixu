import type { AcademicTracker, DigestEntry } from "./types.js";

export class AcademicTrackerManager {
  createTracker(input: { keywords: string[]; authors: string[]; venues: string[] }): AcademicTracker {
    return {
      id: crypto.randomUUID(),
      projectId: "",
      keywords: input.keywords,
      authors: input.authors,
      venues: input.venues,
      weeklyDigest: [],
    };
  }

  generateDigest(
    tracker: AcademicTracker,
    newPapers: Array<{ title: string; abstract: string; year: number }>,
  ): DigestEntry {
    const relevantPapers: DigestEntry["relevantPapers"] = [];

    for (const paper of newPapers) {
      const lowerTitle = paper.title.toLowerCase();
      const lowerAbstract = paper.abstract.toLowerCase();
      const searchText = `${lowerTitle} ${lowerAbstract}`;

      let relevance = 0;
      for (const keyword of tracker.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          relevance += 3;
        }
      }
      for (const author of tracker.authors) {
        if (searchText.includes(author.toLowerCase())) {
          relevance += 2;
        }
      }
      for (const venue of tracker.venues) {
        if (searchText.includes(venue.toLowerCase())) {
          relevance += 1;
        }
      }

      if (relevance > 0) {
        relevantPapers.push({ title: paper.title, relevance });
      }
    }

    relevantPapers.sort((a, b) => b.relevance - a.relevance);

    const trends: string[] = [];
    const keywordCounts = new Map<string, number>();
    for (const keyword of tracker.keywords) {
      const count = newPapers.filter((p) =>
        `${p.title} ${p.abstract}`.toLowerCase().includes(keyword.toLowerCase()),
      ).length;
      keywordCounts.set(keyword, count);
    }

    const sortedKeywords = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [keyword, count] of sortedKeywords) {
      if (count > 0) {
        trends.push(`${keyword}: ${count} paper(s) this week`);
      }
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStr = weekStart.toISOString().split("T")[0]!;

    return {
      week: weekStr,
      newPapers: newPapers.length,
      relevantPapers: relevantPapers.slice(0, 10),
      trends,
    };
  }
}
