import type { QuestionBank, Question, MistakeRecord, MistakeAttribution, KnowledgeGraph } from "./types.js";

export class QuestionBankManager {
  createBank(projectId: string): QuestionBank {
    return {
      id: crypto.randomUUID(),
      projectId,
      questions: [],
      mistakes: [],
    };
  }

  generateQuestions(
    bank: QuestionBank,
    nodeIds: string[],
    count: number,
    types?: Question["type"][],
  ): Question[] {
    const questions: Question[] = [];
    const allowedTypes = types ?? ["multiple_choice", "fill_blank", "short_answer", "calculation", "true_false"];

    for (let i = 0; i < count; i++) {
      const nodeId = nodeIds[i % nodeIds.length]!;
      const type = allowedTypes[i % allowedTypes.length]!;

      const templates: Record<Question["type"], { stem: string; answer: string; options?: string[] }> = {
        multiple_choice: {
          stem: `Which of the following best describes the concept related to node ${nodeId}?`,
          answer: `Correct description for ${nodeId}`,
          options: [
            `Correct description for ${nodeId}`,
            "A related but different concept",
            "An unrelated term",
            "None of the above",
          ],
        },
        fill_blank: {
          stem: `The key property of the concept in node ${nodeId} is ___.`,
          answer: `Key property of ${nodeId}`,
        },
        short_answer: {
          stem: `Explain the main aspects of the concept related to node ${nodeId}.`,
          answer: `Main aspects of ${nodeId} include its definition, properties, and applications.`,
        },
        calculation: {
          stem: `Calculate the result using the formula related to node ${nodeId}.`,
          answer: `Result using formula from ${nodeId}`,
        },
        true_false: {
          stem: `True or False: The concept in node ${nodeId} applies to all cases.`,
          answer: "False",
          options: ["True", "False"],
        },
      };

      const template = templates[type];

      const question: Question = {
        id: crypto.randomUUID(),
        type,
        stem: template.stem,
        answer: template.answer,
        explanation: `This question tests understanding of the concept in node ${nodeId}.`,
        difficulty: Math.min(3 + Math.floor(i / 2), 5),
        nodeIds: [nodeId],
        sourceId: null,
      };

      if (template.options) {
        question.options = template.options;
      }

      questions.push(question);
      bank.questions.push(question);
    }

    return questions;
  }

  recordMistake(
    bank: QuestionBank,
    questionId: string,
    userId: string,
    userAnswer: string,
    attribution: MistakeAttribution,
  ): MistakeRecord {
    const mistake: MistakeRecord = {
      id: crypto.randomUUID(),
      questionId,
      userId,
      userAnswer,
      attribution,
      reviewCount: 0,
      lastReviewedAt: null,
      mastered: false,
      createdAt: new Date().toISOString(),
    };

    bank.mistakes.push(mistake);
    return mistake;
  }

  getMistakesByAttribution(bank: QuestionBank, attributionType: MistakeAttribution["type"]): MistakeRecord[] {
    return bank.mistakes.filter((m) => m.attribution.type === attributionType);
  }

  getWeakAreaQuestions(bank: QuestionBank, graph: KnowledgeGraph, count: number): Question[] {
    const weakNodes = graph.nodes
      .filter((n) => n.masteryLevel < 0.5)
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    const weakNodeIds = weakNodes.slice(0, count).map((n) => n.id);

    const existingQuestions = bank.questions.filter((q) =>
      q.nodeIds.some((nid) => weakNodeIds.includes(nid)),
    );

    if (existingQuestions.length >= count) {
      return existingQuestions.slice(0, count);
    }

    const newQuestions = this.generateQuestions(
      bank,
      weakNodeIds,
      count - existingQuestions.length,
    );

    return [...existingQuestions, ...newQuestions].slice(0, count);
  }
}
