import type { IncompleteCitation, CitationSuggestion } from "./types.js";

const REQUIRED_FIELDS = ["doi", "title", "year", "authors", "venue"] as const;

export class CitationCompleter {
  findIncompleteCitations(
    citations: Array<{
      rawText: string;
      doi?: string;
      title?: string;
      year?: number;
      authors?: string;
      venue?: string;
    }>
  ): IncompleteCitation[] {
    const incomplete: IncompleteCitation[] = [];

    for (const citation of citations) {
      const missingFields: string[] = [];

      if (!citation.doi) missingFields.push("doi");
      if (!citation.title) missingFields.push("title");
      if (!citation.year) missingFields.push("year");
      if (!citation.authors) missingFields.push("authors");
      if (!citation.venue) missingFields.push("venue");

      if (missingFields.length > 0) {
        incomplete.push({
          rawText: citation.rawText,
          missingFields,
          location: citation.rawText.slice(0, 50),
        });
      }
    }

    return incomplete;
  }

  suggestCompletions(incomplete: IncompleteCitation[]): CitationSuggestion[] {
    const suggestions: CitationSuggestion[] = [];

    for (const citation of incomplete) {
      const suggestedFields: Record<string, string> = {};

      const yearMatch = citation.rawText.match(/\b(19|20)\d{2}\b/);
      if (citation.missingFields.includes("year") && yearMatch) {
        suggestedFields.year = yearMatch[0]!;
      }

      const authorMatch = citation.rawText.match(/^([A-Z][a-z]+(?:\s+(?:et\s+al\.|and|[A-Z][a-z]+))*)/);
      if (citation.missingFields.includes("authors") && authorMatch) {
        suggestedFields.authors = authorMatch[1]!;
      }

      const titlePatterns = [
        /"([^"]+)"/,
        /\u201C([^\u201D]+)\u201D/,
        /^([A-Z][^.!?\n]{10,}?)[.:,]/,
      ];
      if (citation.missingFields.includes("title")) {
        for (const pattern of titlePatterns) {
          const match = citation.rawText.match(pattern);
          if (match) {
            suggestedFields.title = match[1]!;
            break;
          }
        }
      }

      const venuePatterns = [
        /(?:in|proceedings of|journal of)\s+([A-Z][^,.]+)/i,
        /(?:conference|journal|transactions|letters|review)\s+(?:of\s+)?([A-Z][^,.]+)/i,
      ];
      if (citation.missingFields.includes("venue")) {
        for (const pattern of venuePatterns) {
          const match = citation.rawText.match(pattern);
          if (match) {
            suggestedFields.venue = match[1]!.trim();
            break;
          }
        }
      }

      const doiMatch = citation.rawText.match(/10\.\d{4,}\/[^\s]+/);
      if (citation.missingFields.includes("doi") && doiMatch) {
        suggestedFields.doi = doiMatch[0]!;
      }

      if (Object.keys(suggestedFields).length > 0) {
        const confidence = Object.keys(suggestedFields).length / citation.missingFields.length;
        suggestions.push({
          rawText: citation.rawText,
          suggestedFields,
          confidence,
          source: "pattern_matching",
        });
      }
    }

    return suggestions;
  }
}
