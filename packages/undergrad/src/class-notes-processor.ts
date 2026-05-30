import type { ClassNotes, LLMCallable } from "./types.js";

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

  async processTranscriptEnhanced(
    rawTranscript: string,
    courseInfo: { name: string; type: string; topics: string[] },
    llm: LLMCallable
  ): Promise<ClassNotes & { aiSummary: string; examHints: string[]; keyConcepts: string[] }> {
    const basic = this.processTranscript(rawTranscript, courseInfo.name, new Date().toISOString().split("T")[0]!);
    try {
      const result = await llm.chat({
        system: `你是一位课堂笔记助手。从录音转写文本中提取课程摘要、考试重点和关键概念。
返回 JSON：{"summary": "课程内容摘要", "examHints": ["考点1：...", "..."], "keyConcepts": ["概念1：...", "..."]}`,
        messages: [{ role: "user", content: `课程：${courseInfo.name}（${courseInfo.type}）\n主题：${courseInfo.topics.join("、")}\n\n转写文本：\n${rawTranscript.slice(0, 4000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, aiSummary: parsed.summary ?? "", examHints: parsed.examHints ?? [], keyConcepts: parsed.keyConcepts ?? [] };
    } catch {
      return { ...basic, aiSummary: "", examHints: [], keyConcepts: [] };
    }
  }
}
