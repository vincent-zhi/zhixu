interface CitationInput {
  raw: string;
  doi?: string;
  title?: string;
  year?: number;
  style?: string;
}

interface FormattedCitation {
  formatted: string;
  style: string;
}

function formatAPA(citation: CitationInput): string {
  const parts = citation.raw.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length >= 3) {
    return `${parts[0]} (${citation.year ?? "n.d."}). ${parts.slice(2).join(", ")}.`;
  }
  return citation.raw;
}

function formatIEEE(citation: CitationInput): string {
  const parts = citation.raw.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0]}, "${parts.slice(1).join(", ")}," ${citation.year ?? "n.d."}.`;
  }
  return citation.raw;
}

function formatGBT7714(citation: CitationInput): string {
  const parts = citation.raw.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0]}. ${parts.slice(1).join(", ")}[${citation.year ?? "n.d."}].`;
  }
  return citation.raw;
}

export class CitationFixer {
  formatCitations(citations: Array<{ raw: string; style: string }>): Array<{ formatted: string; style: string }> {
    return citations.map((citation) => {
      const input: CitationInput = { raw: citation.raw, style: citation.style };
      let formatted: string;

      switch (citation.style.toLowerCase()) {
        case "apa":
          formatted = formatAPA(input);
          break;
        case "ieee":
          formatted = formatIEEE(input);
          break;
        case "gb/t 7714":
        case "gbt7714":
          formatted = formatGBT7714(input);
          break;
        default:
          formatted = citation.raw;
      }

      return { formatted, style: citation.style };
    });
  }

  detectAnomalies(citations: Array<{ raw: string; doi?: string; title?: string; year?: number }>): string[] {
    const anomalies: string[] = [];

    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i]!;

      if (!citation.title && !citation.doi) {
        anomalies.push(`Citation ${i + 1}: Missing both title and DOI`);
      }

      if (citation.year) {
        const currentYear = new Date().getFullYear();
        if (citation.year < 1900 || citation.year > currentYear + 1) {
          anomalies.push(`Citation ${i + 1}: Suspicious year ${citation.year}`);
        }
      } else {
        anomalies.push(`Citation ${i + 1}: Missing publication year`);
      }

      if (citation.raw.trim().length < 10) {
        anomalies.push(`Citation ${i + 1}: Citation appears incomplete (too short)`);
      }
    }

    return anomalies;
  }

  deduplicate(citations: Array<{ raw: string; doi?: string; title?: string }>): Array<{ raw: string; doi?: string; title?: string }> {
    const seen = new Map<string, number>();
    const result: Array<{ raw: string; doi?: string; title?: string }> = [];

    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i]!;
      let key: string | null = null;

      if (citation.doi) {
        key = `doi:${citation.doi.toLowerCase()}`;
      } else if (citation.title) {
        key = `title:${citation.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      }

      if (key) {
        if (seen.has(key)) {
          continue;
        }
        seen.set(key, i);
      }

      result.push(citation);
    }

    return result;
  }
}
