import type { ReviewComment, ReviewActionItem, ResponseLetterSection, ReviewResponse, LLMCallable } from "./types.js";

const MAJOR_KEYWORDS = ["major", "significant", "fundamental", "critical", "serious", "主要问题", "重大"];
const MINOR_KEYWORDS = ["minor", "small", "typo", "formatting", "minor issue", "小问题", "格式"];
const CLARIFICATION_KEYWORDS = ["clarify", "unclear", "confusing", "explain", "unclear", "不清楚", "解释"];
const POSITIVE_KEYWORDS = ["good", "excellent", "well", "nice", "strong", "好的", "优秀"];

function classifyComment(text: string): ReviewComment["category"] {
  const lower = text.toLowerCase();
  if (MAJOR_KEYWORDS.some((kw) => lower.includes(kw))) return "major";
  if (MINOR_KEYWORDS.some((kw) => lower.includes(kw))) return "minor";
  if (CLARIFICATION_KEYWORDS.some((kw) => lower.includes(kw))) return "clarification";
  if (POSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) return "positive";
  return "minor";
}

function estimateDifficulty(category: ReviewComment["category"]): number {
  switch (category) {
    case "major": return 8;
    case "minor": return 3;
    case "clarification": return 4;
    case "positive": return 1;
  }
}

function inferActionType(category: ReviewComment["category"]): ReviewActionItem["actionType"] {
  switch (category) {
    case "major": return "revise";
    case "minor": return "revise";
    case "clarification": return "clarify";
    case "positive": return "reject_with_reason";
  }
}

export class ReviewResponseEngine {
  parseReviewComments(rawReview: string): ReviewComment[] {
    const paragraphs = rawReview
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const comments: ReviewComment[] = [];
    let reviewerIndex = 0;

    for (const paragraph of paragraphs) {
      const reviewerMatch = paragraph.match(/reviewer\s*(\d+)/i);
      if (reviewerMatch) {
        reviewerIndex = parseInt(reviewerMatch[1]!, 10) - 1;
      }

      const sentences = paragraph
        .split(/[.!?。！？]\s*/)
        .flatMap((s) => s.split(/\n/))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 5) continue;

        const category = classifyComment(trimmed);
        comments.push({
          id: crypto.randomUUID(),
          reviewerIndex,
          originalText: trimmed,
          category,
          boundSection: null,
          boundParagraph: null,
          difficulty: estimateDifficulty(category),
        });
      }
    }

    return comments;
  }

  generateActionItems(comments: ReviewComment[]): ReviewActionItem[] {
    return comments.map((comment) => ({
      id: crypto.randomUUID(),
      commentId: comment.id,
      actionType: inferActionType(comment.category),
      description: `Address ${comment.category} comment: ${comment.originalText.slice(0, 100)}`,
      boundArtifactId: null,
      boundBlockId: null,
      status: "pending" as const,
    }));
  }

  draftResponseLetter(items: ReviewActionItem[]): ResponseLetterSection[] {
    return items.map((item) => {
      let responseText: string;
      let actionTaken: string;

      switch (item.actionType) {
        case "revise":
          responseText = "We appreciate the reviewer's feedback and have revised the manuscript accordingly.";
          actionTaken = "Revised the relevant section to address the concern";
          break;
        case "add_experiment":
          responseText = "We have conducted additional experiments as suggested.";
          actionTaken = "Added new experimental results";
          break;
        case "clarify":
          responseText = "We have clarified the point raised by the reviewer.";
          actionTaken = "Added clarifying explanation";
          break;
        case "add_citation":
          responseText = "We have added the suggested citation.";
          actionTaken = "Included the recommended reference";
          break;
        case "restructure":
          responseText = "We have restructured the section for better clarity.";
          actionTaken = "Reorganized the content structure";
          break;
        case "reject_with_reason":
          responseText = "We thank the reviewer for the positive feedback.";
          actionTaken = "No changes needed";
          break;
      }

      return {
        commentId: item.commentId,
        originalComment: item.description,
        responseText,
        actionTaken,
      };
    });
  }

  createReviewResponse(rawReview: string): ReviewResponse {
    const comments = this.parseReviewComments(rawReview);
    const actionItems = this.generateActionItems(comments);
    const responseLetter = this.draftResponseLetter(actionItems);

    const majorCount = comments.filter((c) => c.category === "major").length;
    const minorCount = comments.filter((c) => c.category === "minor").length;

    let overallStrategy: string;
    if (majorCount > 3) {
      overallStrategy = "Major revision needed: address all major concerns with substantial changes";
    } else if (majorCount > 0) {
      overallStrategy = "Moderate revision: focus on major concerns while addressing minor issues";
    } else if (minorCount > 0) {
      overallStrategy = "Minor revision: address minor issues and clarifications";
    } else {
      overallStrategy = "Positive review: minimal changes required";
    }

    return {
      id: crypto.randomUUID(),
      projectId: "",
      reviewComments: comments,
      actionItems,
      responseLetter,
      overallStrategy,
    };
  }

  async createReviewResponseEnhanced(
    rawReview: string,
    paperContent: string,
    llm: LLMCallable
  ): Promise<ReviewResponse & { aiDraftSections: ResponseLetterSection[] }> {
    const basic = this.createReviewResponse(rawReview);
    try {
      const result = await llm.chat({
        system: `你是一位学术论文返修助手。根据审稿意见和论文内容，生成逐条回复草稿。
返回 JSON：{"sections": [{"reviewerComment": "...", "response": "...", "changes": "..."}], "overallStrategy": "..."}`,
        messages: [{ role: "user", content: `审稿意见：\n${rawReview}\n\n论文内容（节选）：\n${paperContent.slice(0, 3000)}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const sections: ResponseLetterSection[] = (parsed.sections ?? []).map((s: any) => ({
        commentId: crypto.randomUUID(),
        originalComment: s.reviewerComment ?? "",
        responseText: s.response ?? "",
        actionTaken: s.changes ?? "",
      }));
      return { ...basic, aiDraftSections: sections, overallStrategy: parsed.overallStrategy ?? basic.overallStrategy };
    } catch {
      return { ...basic, aiDraftSections: [] };
    }
  }
}
