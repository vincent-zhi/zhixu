export interface SubmissionChecklist {
  id: string;
  projectId: string;
  targetVenue: string;
  requirements: VenueRequirement[];
  checks: ChecklistItem[];
  overallReadiness: number;
}

export interface VenueRequirement {
  category: string;
  requirement: string;
  met: boolean;
  notes: string;
}

export interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  status: "pass" | "fail" | "warning" | "not_checked";
  details: string;
}

export interface ReviewResponse {
  id: string;
  projectId: string;
  reviewComments: ReviewComment[];
  actionItems: ReviewActionItem[];
  responseLetter: ResponseLetterSection[];
  overallStrategy: string;
}

export interface ReviewComment {
  id: string;
  reviewerIndex: number;
  originalText: string;
  category: "major" | "minor" | "clarification" | "positive";
  boundSection: string | null;
  boundParagraph: string | null;
  difficulty: number;
}

export interface ReviewActionItem {
  id: string;
  commentId: string;
  actionType: "revise" | "add_experiment" | "clarify" | "add_citation" | "restructure" | "reject_with_reason";
  description: string;
  boundArtifactId: string | null;
  boundBlockId: string | null;
  status: "pending" | "in_progress" | "completed";
}

export interface ResponseLetterSection {
  commentId: string;
  originalComment: string;
  responseText: string;
  actionTaken: string;
}

export interface ExperimentLog {
  id: string;
  projectId: string;
  purpose: string;
  variables: ExperimentVariable[];
  steps: ExperimentStep[];
  environment: Record<string, string>;
  rawData: Record<string, unknown>;
  results: string;
  analysis: string;
  issues: string[];
  conclusion: string;
  createdAt: string;
}

export interface ExperimentVariable {
  name: string;
  type: "independent" | "dependent" | "controlled";
  value: string;
}

export interface ExperimentStep {
  order: number;
  description: string;
  duration: string;
  notes: string;
}

export interface ExperimentAnomaly {
  id: string;
  experimentLogId: string;
  description: string;
  possibleCauses: string[];
  priority: number;
  suggestedActions: string[];
}

export interface GrantApplication {
  id: string;
  projectId: string;
  grantType: string;
  sections: GrantSection[];
  completeness: number;
  logicGaps: string[];
  evidenceGaps: string[];
}

export interface GrantSection {
  type: "background" | "innovation" | "methodology" | "feasibility" | "foundation" | "budget" | "timeline";
  title: string;
  content: string;
  completeness: number;
  issues: string[];
}

export interface AcademicTracker {
  id: string;
  projectId: string;
  keywords: string[];
  authors: string[];
  venues: string[];
  weeklyDigest: DigestEntry[];
}

export interface DigestEntry {
  week: string;
  newPapers: number;
  relevantPapers: Array<{ title: string; relevance: number }>;
  trends: string[];
}

export interface AcademicResume {
  id: string;
  userId: string;
  sections: ResumeSection[];
  lastUpdated: string;
}

export interface ResumeSection {
  type: "education" | "publications" | "presentations" | "experiments" | "competitions" | "grants" | "awards" | "skills";
  entries: Array<{ title: string; details: Record<string, unknown>; date: string }>;
}

export interface ResearchGap {
  id: string;
  projectId: string;
  description: string;
  evidence: string[];
  feasibility: number;
  risk: number;
  requiredExperiments: string[];
  relatedPapers: string[];
}

export interface LLMCallable {
  chat(input: {
    system: string;
    messages: Array<{ role: string; content: string }>;
    responseFormat?: { type: string };
  }): Promise<{ content: string }>;
}
