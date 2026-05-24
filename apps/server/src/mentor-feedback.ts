const HIGH_PRIORITY_PATTERNS = /必须|需要|请|should|must|need\s+to|have\s+to/i;
const MEDIUM_PRIORITY_PATTERNS = /建议|suggest|recommend|consider|could|might\s+want/i;

export interface ParsedFeedbackItem {
  content: string;
  priority: "high" | "medium" | "low";
}

export class MentorFeedbackParser {
  parseFeedback(rawContent: string, sourceType: string): ParsedFeedbackItem[] {
    const sentences = rawContent
      .split(/[。！？.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences.map((content) => ({
      content,
      priority: this.classifyPriority(content, sourceType),
    }));
  }

  private classifyPriority(content: string, sourceType: string): "high" | "medium" | "low" {
    if (HIGH_PRIORITY_PATTERNS.test(content)) {
      return "high";
    }

    if (MEDIUM_PRIORITY_PATTERNS.test(content)) {
      return "medium";
    }

    if (sourceType === "advisor" || sourceType === "committee") {
      return "medium";
    }

    return "low";
  }
}
