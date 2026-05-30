export interface DefenseSimulation {
  id: string;
  projectId: string;
  questions: DefenseQuestion[];
  performance: DefensePerformance;
  overallScore: number;
}

export interface DefenseQuestion {
  id: string;
  category: "methodology" | "results" | "contribution" | "literature" | "future_work" | "weakness";
  question: string;
  expectedPoints: string[];
  difficulty: number;
}

export interface DefensePerformance {
  answeredQuestions: number;
  totalQuestions: number;
  averageScore: number;
  weakCategories: string[];
  strongCategories: string[];
}

export interface ProcrastinationAdapter {
  id: string;
  projectId: string;
  currentDelay: number;
  suggestedApproach: "gentle_nudge" | "micro_task" | "deadline_reframe" | "accountability" | "break_down";
  microTasks: MicroTask[];
  motivationMessage: string;
}

export interface MicroTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface SocraticQuestion {
  id: string;
  category: "assumption" | "evidence" | "alternative" | "implication" | "definition";
  question: string;
  followUpQuestions: string[];
  relatedConcept: string;
}

export interface MeetingBrief {
  id: string;
  projectId: string;
  meetingType: "group_meeting" | "advising" | "defense_prep" | "progress_update";
  keyPoints: string[];
  suggestedSlides: string[];
  anticipatedQuestions: string[];
  preparationChecklist: string[];
}

export interface DiagnosticReport {
  id: string;
  projectId: string;
  period: { start: string; end: string };
  taskCompletionRate: number;
  averageDelay: number;
  riskAreas: string[];
  strengthAreas: string[];
  recommendations: string[];
  knowledgeRetention: number;
}

/** Minimal LLM interface for domain enhancement — avoids hard dependency on @zhixu/model-gateway */
export interface LLMCallable {
  chat(params: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    responseFormat?: { type: "json_object" };
  }): Promise<{ content: string }>;
}
