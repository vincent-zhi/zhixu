import type { ClassNotes } from "./types.js";

const HOMEWORK_KEYWORDS = ["作业", "homework", "assignment", "due", "截止", "提交", "交"];
const EXAM_HINT_KEYWORDS = ["考试", "exam", "test", "quiz", "考点", "重点", "会考", "必考", "出题"];
const KEY_POINT_INDICATORS = ["关键", "重点", "核心", "注意", "important", "key point", "note that", "remember", "总之", "总结"];

export class ClassNotesProcessor {
  processTranscript(rawTranscript: string, courseName: string, date: string): ClassNotes {
    const sentences = rawTranscript
      .split(/[。！？.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const keyPoints: string[] = [];
    const homeworkMentions: string[] = [];
    const examHints: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (KEY_POINT_INDICATORS.some((kw) => lower.includes(kw))) {
        keyPoints.push(sentence);
      }
      if (HOMEWORK_KEYWORDS.some((kw) => lower.includes(kw))) {
        homeworkMentions.push(sentence);
      }
      if (EXAM_HINT_KEYWORDS.some((kw) => lower.includes(kw))) {
        examHints.push(sentence);
      }
    }

    return {
      id: crypto.randomUUID(),
      projectId: "",
      date,
      courseName,
      rawTranscript,
      keyPoints,
      homeworkMentions,
      examHints,
      actionItems: [],
    };
  }

  extractActionItems(notes: ClassNotes): string[] {
    const items: string[] = [];

    for (const hw of notes.homeworkMentions) {
      items.push(`Complete homework: ${hw}`);
    }

    for (const hint of notes.examHints) {
      items.push(`Review for exam: ${hint}`);
    }

    for (const point of notes.keyPoints) {
      items.push(`Study key point: ${point}`);
    }

    return items;
  }
}
