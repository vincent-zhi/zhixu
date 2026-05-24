export interface PaperMatrix {
  id: string;
  projectId: string;
  papers: PaperEntry[];
  comparisonMatrix: ComparisonField[];
  researchGaps: string[];
  controversies: string[];
  timeline: TimelineEntry[];
  suggestedOutline: string[];
}

export interface PaperEntry {
  id: string;
  sourceId: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  problem: string;
  method: string;
  dataset: string;
  metrics: string[];
  mainResults: string;
  limitations: string;
  futureWork: string;
  relevanceToProject: string;
  doi: string | null;
}

export interface ComparisonField {
  field: string;
  values: Record<string, string>;
}

export interface TimelineEntry {
  year: number;
  papers: string[];
  milestone: string;
}

export interface LiteratureSearchResult {
  query: string;
  papers: PaperEntry[];
  totalFound: number;
  hasMore: boolean;
}
