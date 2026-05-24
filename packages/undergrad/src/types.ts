export interface SemesterPlan {
  id: string;
  projectId: string;
  semesterName: string;
  startDate: string;
  endDate: string;
  courses: CourseEntry[];
  examSchedule: ExamEntry[];
  assignmentDeadlines: AssignmentEntry[];
  weeklyPlan: WeeklyPlan[];
  overallStrategy: string;
}

export interface CourseEntry {
  id: string;
  name: string;
  credits: number;
  assessmentType: string;
  difficulty: number;
  priorityWeight: number;
}

export interface ExamEntry {
  id: string;
  courseId: string;
  examDate: string;
  examType: "midterm" | "final" | "quiz" | "makeup";
  weight: number;
}

export interface AssignmentEntry {
  id: string;
  courseId: string;
  title: string;
  dueDate: string;
  weight: number;
  type: "homework" | "project" | "presentation" | "paper" | "lab";
}

export interface WeeklyPlan {
  week: number;
  startDate: string;
  focusCourses: string[];
  tasks: string[];
  reviewSessions: string[];
}

export interface GroupDivision {
  id: string;
  projectId: string;
  taskTitle: string;
  members: GroupMember[];
  assignments: GroupAssignment[];
  contributionReport: ContributionEntry[];
}

export interface GroupMember {
  id: string;
  name: string;
  role: string;
  strengths: string[];
  assignedWeight: number;
}

export interface GroupAssignment {
  memberId: string;
  taskIds: string[];
  estimatedHours: number;
  difficulty: number;
}

export interface ContributionEntry {
  memberId: string;
  completedTasks: number;
  totalHours: number;
  qualityScore: number;
  contributionPercent: number;
}

export interface ClassNotes {
  id: string;
  projectId: string;
  date: string;
  courseName: string;
  rawTranscript: string;
  keyPoints: string[];
  homeworkMentions: string[];
  examHints: string[];
  actionItems: string[];
}

export interface SelfCheckResult {
  id: string;
  artifactId: string;
  wordCount: number;
  formatScore: number;
  structureScore: number;
  topicMatchScore: number;
  citationCompleteness: number;
  formalityScore: number;
  logicScore: number;
  issues: SelfCheckIssue[];
  overallScore: number;
}

export interface SelfCheckIssue {
  type: "word_count" | "format" | "structure" | "topic" | "citation" | "formality" | "logic";
  severity: "info" | "warning" | "error";
  message: string;
  location: string;
  suggestion: string;
}

export interface ExamCrashPlan {
  id: string;
  projectId: string;
  examDate: string;
  daysRemaining: number;
  highFrequencyTopics: HighFrequencyTopic[];
  dailyPlan: CrashDayPlan[];
  strategy: string;
}

export interface HighFrequencyTopic {
  topic: string;
  sourceIds: string[];
  frequency: number;
  estimatedWeight: number;
}

export interface CrashDayPlan {
  day: number;
  date: string;
  topics: string[];
  activities: string[];
  estimatedMinutes: number;
}

export interface PPTBeautifyResult {
  id: string;
  artifactId: string;
  issues: PPTBeautifyIssue[];
  appliedFixes: string[];
  beforeScore: number;
  afterScore: number;
}

export interface PPTBeautifyIssue {
  type: "font_inconsistency" | "text_overload" | "alignment" | "spacing" | "color_mismatch" | "missing_visual";
  slideIndex: number;
  description: string;
  autoFixable: boolean;
}
