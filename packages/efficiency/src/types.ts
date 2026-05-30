export interface TermEntry {
  id: string;
  term: string;
  definition: string;
  domain: string;
  aliases: string[];
  sourceProjectId: string | null;
  createdAt: string;
}

export interface Termbase {
  id: string;
  workspaceId: string;
  entries: TermEntry[];
}

export interface FragmentNote {
  id: string;
  projectId: string;
  content: string;
  source: string;
  tags: string[];
  linkedProjectIds: string[];
  createdAt: string;
}

export interface CrossProjectLink {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  linkType: "shared_knowledge" | "shared_methodology" | "shared_data" | "shared_template" | "continuation";
  description: string;
  createdAt: string;
}

export interface StyleProfile {
  id: string;
  userId: string;
  academicLevel: "undergraduate" | "master" | "phd" | "postdoc";
  domain: string;
  preferences: {
    formalityLevel: number;
    citationStyle: string;
    preferredTense: string;
    avoidFirstPerson: boolean;
    sentenceLengthPreference: "short" | "medium" | "long";
  };
}

export interface FormatConversionResult {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  content: string;
  fidelityScore: number;
  warnings: string[];
}

export interface DeduplicationResult {
  id: string;
  inputCount: number;
  outputCount: number;
  duplicates: DuplicatePair[];
  mergedContent: string;
}

export interface DuplicatePair {
  indexA: number;
  indexB: number;
  similarity: number;
  contentA: string;
  contentB: string;
}

/** Minimal LLM interface for domain enhancement — avoids hard dependency on @zhixu/model-gateway */
export interface LLMCallable {
  chat(params: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    responseFormat?: { type: "json_object" };
  }): Promise<{ content: string }>;
}
