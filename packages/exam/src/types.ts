export interface KnowledgeNode {
  id: string;
  type: "chapter" | "concept" | "formula" | "example" | "assignment" | "mistake" | "question_type";
  label: string;
  content: string;
  masteryLevel: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: "prerequisite" | "similar" | "often_confused" | "appears_in" | "tested_by";
  weight: number;
}

export interface KnowledgeGraph {
  id: string;
  projectId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface ReviewPlan {
  id: string;
  projectId: string;
  examDate: string;
  totalDays: number;
  dailyTasks: DailyTask[];
  knowledgeGraph: KnowledgeGraph;
  progress: number;
}

export interface DailyTask {
  day: number;
  date: string;
  topics: string[];
  nodeIds: string[];
  activities: StudyActivity[];
  estimatedMinutes: number;
  completed: boolean;
}

export interface StudyActivity {
  id: string;
  type: "read" | "practice" | "review_mistakes" | "flashcard" | "quiz" | "summarize";
  title: string;
  content: string;
  nodeIds: string[];
  duration: number;
  completed: boolean;
}

export interface Question {
  id: string;
  type: "multiple_choice" | "fill_blank" | "short_answer" | "calculation" | "true_false";
  stem: string;
  options?: string[];
  answer: string;
  explanation: string;
  difficulty: number;
  nodeIds: string[];
  sourceId: string | null;
}

export interface MistakeRecord {
  id: string;
  questionId: string;
  userId: string;
  userAnswer: string;
  attribution: MistakeAttribution;
  reviewCount: number;
  lastReviewedAt: string | null;
  mastered: boolean;
  createdAt: string;
}

export interface MistakeAttribution {
  type: "concept_unclear" | "formula_misuse" | "calculation_error" | "misread" | "step_missing" | "knowledge_confusion";
  description: string;
  relatedNodeIds: string[];
}

export interface QuestionBank {
  id: string;
  projectId: string;
  questions: Question[];
  mistakes: MistakeRecord[];
}
