export interface CitationVerificationResult {
  rawText: string;
  status: "verified" | "needs_review" | "rejected";
  issues: string[];
  normalizedDoi?: string;
  normalizedTitle?: string;
  crossRefMetadata?: CrossRefMetadata;
}

interface CitationInput {
  rawText: string;
  doi?: string;
  title?: string;
  year?: number;
}

export interface CrossRefMetadata {
  doi: string;
  title: string | null;
  authors: string[];
  publishedYear: number | null;
  journal: string | null;
  url: string | null;
  isReferencedByCount: number | null;
}

const DOI_PATTERN = /^10\.\d{4,9}\/[^\s]+$/;
const CROSSREF_API_BASE = "https://api.crossref.org/works";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CitationVerifier {
  private readonly crossrefRateLimitMs: number;

  constructor(options?: { crossrefRateLimitMs?: number }) {
    this.crossrefRateLimitMs = options?.crossrefRateLimitMs ?? 1000;
  }

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

  async verifyDoiBatch(input: {
    citations: CitationInput[];
    concurrency?: number;
  }): Promise<CitationVerificationResult[]> {
    const { citations, concurrency = 3 } = input;

    const dedupedDois = new Map<string, number[]>();
    const results = citations.map((c) => this.verifyCitation(c));

    for (let i = 0; i < citations.length; i++) {
      const doi = results[i]!.normalizedDoi;
      if (doi) {
        const existing = dedupedDois.get(doi) ?? [];
        existing.push(i);
        dedupedDois.set(doi, existing);
      }
    }

    const doisToFetch = Array.from(dedupedDois.keys());
    const fetchedMetadata = new Map<string, CrossRefMetadata>();

    for (let i = 0; i < doisToFetch.length; i += concurrency) {
      const batch = doisToFetch.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((doi) => this.fetchCrossRefMetadata(doi))
      );

      for (let j = 0; j < batch.length; j++) {
        const doi = batch[j]!;
        const result = batchResults[j]!;
        if (result.status === "fulfilled") {
          fetchedMetadata.set(doi, result.value);
        }
      }

      if (i + concurrency < doisToFetch.length) {
        await sleep(this.crossrefRateLimitMs);
      }
    }

    for (const [doi, indices] of dedupedDois) {
      const metadata = fetchedMetadata.get(doi);
      if (!metadata) continue;

      for (const idx of indices) {
        const result = results[idx]!;
        result.crossRefMetadata = metadata;

        if (!result.normalizedTitle && metadata.title) {
          result.normalizedTitle = metadata.title;
        }
        if (result.status === "verified" && metadata.publishedYear) {
          const citation = citations[idx]!;
          if (citation.year && citation.year !== metadata.publishedYear) {
            result.issues.push(
              `Year mismatch: provided ${citation.year}, CrossRef shows ${metadata.publishedYear}`
            );
            result.status = "needs_review";
          }
        }
      }
    }

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
          if (!entry.issues.some((i) => i.includes("Duplicate DOI"))) {
            entry.issues.push(`Duplicate DOI detected: ${entry.normalizedDoi}`);
            entry.status = "needs_review";
          }
        }
      }
    }

    for (const [, indices] of titleYearIndex) {
      if (indices.length > 1) {
        for (const idx of indices) {
          const entry = results[idx]!;
          const cite = citations[idx]!;
          if (!entry.issues.some((i) => i.includes("Duplicate title+year"))) {
            entry.issues.push(`Duplicate title+year detected: "${entry.normalizedTitle}" (${cite.year})`);
            entry.status = "needs_review";
          }
        }
      }
    }

    return results;
  }

  async fetchCrossRefMetadata(doi: string): Promise<CrossRefMetadata> {
    const url = `${CROSSREF_API_BASE}/${encodeURIComponent(doi)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ZhiXu/1.0 (https://zhixu.ai; mailto:support@zhixu.ai)"
      },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      throw new Error(`CrossRef API returned ${response.status} for DOI: ${doi}`);
    }

    const data = await response.json() as {
      message?: {
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        "published-print"?: { "date-parts"?: number[][] };
        "published-online"?: { "date-parts"?: number[][] };
        "container-title"?: string[];
        URL?: string;
        "is-referenced-by-count"?: number;
      };
    };

    const msg = data.message;
    if (!msg) {
      throw new Error(`No message in CrossRef response for DOI: ${doi}`);
    }

    const authors = (msg.author ?? []).map((a) => {
      const parts = [a.given, a.family].filter(Boolean);
      return parts.join(" ") || "Unknown";
    });

    const publishedYear =
      msg["published-print"]?.["date-parts"]?.[0]?.[0] ??
      msg["published-online"]?.["date-parts"]?.[0]?.[0] ??
      null;

    return {
      doi,
      title: msg.title?.[0] ?? null,
      authors,
      publishedYear,
      journal: msg["container-title"]?.[0] ?? null,
      url: msg.URL ?? null,
      isReferencedByCount: msg["is-referenced-by-count"] ?? null
    };
  }
}
