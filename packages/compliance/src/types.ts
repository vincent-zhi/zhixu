export interface PlagiarismCheckResult {
  id: string;
  artifactId: string;
  overallScore: number;
  flaggedSegments: PlagiarismSegment[];
  aiGeneratedProbability: number;
  recommendations: string[];
}

export interface PlagiarismSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  similarityScore: number;
  sourceType: "internet" | "academic" | "ai_generated" | "self_plagiarism";
  matchedSource: string | null;
}

export interface CitationCompletion {
  id: string;
  projectId: string;
  incompleteCitations: IncompleteCitation[];
  suggestedCompletions: CitationSuggestion[];
}

export interface IncompleteCitation {
  rawText: string;
  missingFields: string[];
  location: string;
}

export interface CitationSuggestion {
  rawText: string;
  suggestedFields: Record<string, string>;
  confidence: number;
  source: string;
}

export interface RiskAlert {
  id: string;
  projectId: string;
  riskType: "fabricated_citation" | "fabricated_data" | "exam_cheating" | "auto_submission" | "unauthorized_download" | "sensitive_upload" | "plagiarism_risk";
  severity: "L1" | "L2" | "L3";
  description: string;
  evidence: string[];
  timestamp: string;
  dismissed: boolean;
}

export interface TraceabilityReport {
  id: string;
  projectId: string;
  artifactId: string;
  generatedAt: string;
  sections: TraceabilitySection[];
  overallCompliance: number;
  greenRatio: number;
  yellowRatio: number;
  grayRatio: number;
  unverifiedCitations: number;
  highRiskItems: number;
}

export interface TraceabilitySection {
  title: string;
  content: string;
  data: Record<string, unknown>;
}

export interface CrossVerificationResult {
  id: string;
  projectId: string;
  inTextCitations: number;
  referenceListCitations: number;
  matchedCitations: number;
  orphanedInText: string[];
  orphanedInReference: string[];
  consistencyScore: number;
}
