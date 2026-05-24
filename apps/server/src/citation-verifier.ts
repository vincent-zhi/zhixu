export interface CitationVerificationResult {
  rawText: string;
  status: "verified" | "needs_review" | "rejected";
  issues: string[];
  normalizedDoi?: string;
  normalizedTitle?: string;
}

interface CitationInput {
  rawText: string;
  doi?: string;
  title?: string;
  year?: number;
}

const DOI_PATTERN = /^10\.\d{4,9}\/[^\s]+$/;

export class CitationVerifier {
  verifyCitation(citation: CitationInput): CitationVerificationResult {
    const issues: string[] = [];
    let normalizedDoi: string | undefined;
    let normalizedTitle: string | undefined;

    if (!citation.doi && !citation.title) {
      issues.push("At least one of DOI or title must be provided");
    }

    if (citation.doi) {
      normalizedDoi = citation.doi.trim().toLowerCase();
      if (!DOI_PATTERN.test(normalizedDoi)) {
        issues.push(`Invalid DOI format: "${citation.doi}"`);
      }
    }

    if (citation.title) {
      normalizedTitle = citation.title.trim();
      if (normalizedTitle.length === 0) {
        issues.push("Title must not be empty when provided");
      }
    }

    if (citation.year !== undefined) {
      const currentYear = new Date().getFullYear();
      if (citation.year < 1900 || citation.year > currentYear + 1) {
        issues.push(`Year ${citation.year} is out of valid range (1900-${currentYear + 1})`);
      }
    }

    const status = issues.length === 0
      ? "verified"
      : issues.some((i) => i.includes("must be provided") || i.includes("Invalid DOI") || i.includes("out of valid range"))
        ? "rejected"
        : "needs_review";

    const result: CitationVerificationResult = {
      rawText: citation.rawText,
      status,
      issues
    };

    if (normalizedDoi !== undefined) {
      result.normalizedDoi = normalizedDoi;
    }
    if (normalizedTitle !== undefined) {
      result.normalizedTitle = normalizedTitle;
    }

    return result;
  }

  batchVerify(citations: CitationInput[]): CitationVerificationResult[] {
    const results = citations.map((c) => this.verifyCitation(c));

    const doiIndex = new Map<string, number[]>();
    const titleYearIndex = new Map<string, number[]>();

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      if (r.normalizedDoi) {
        const existing = doiIndex.get(r.normalizedDoi) ?? [];
        existing.push(i);
        doiIndex.set(r.normalizedDoi, existing);
      }
      if (r.normalizedTitle && citations[i]!.year !== undefined) {
        const key = `${r.normalizedTitle.toLowerCase()}||${citations[i]!.year}`;
        const existing = titleYearIndex.get(key) ?? [];
        existing.push(i);
        titleYearIndex.set(key, existing);
      }
    }

    for (const [, indices] of doiIndex) {
      if (indices.length > 1) {
        for (const idx of indices) {
          const entry = results[idx]!;
          entry.issues.push(`Duplicate DOI detected: ${entry.normalizedDoi}`);
          entry.status = "needs_review";
        }
      }
    }

    for (const [, indices] of titleYearIndex) {
      if (indices.length > 1) {
        for (const idx of indices) {
          const entry = results[idx]!;
          const cite = citations[idx]!;
          entry.issues.push(`Duplicate title+year detected: "${entry.normalizedTitle}" (${cite.year})`);
          entry.status = "needs_review";
        }
      }
    }

    return results;
  }
}
