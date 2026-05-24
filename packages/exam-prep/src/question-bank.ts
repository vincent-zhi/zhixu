import type { Question, MistakeRecord, KnowledgeNode, CourseKnowledgeGraph } from "./types.js";

export class QuestionBank {
  generateQuestions(nodeId: string, nodeLabel: string, type: string, count: number): Question[] {
    const questions: Question[] = [];

    const templates: Record<string, Array<{ question: string; answer: string; options?: string[] }>> = {
      concept: [
        { question: `What is ${nodeLabel}?`, answer: `Definition of ${nodeLabel}`, options: [`Definition of ${nodeLabel}`, "A related but different concept", "An unrelated term", "None of the above"] },
        { question: `Which of the following best describes ${nodeLabel}?`, answer: `Core description of ${nodeLabel}`, options: [`Core description of ${nodeLabel}`, "Partial description", "Incorrect description", "Not applicable"] },
        { question: `Explain the key aspects of ${nodeLabel}.`, answer: `Key aspects of ${nodeLabel} include its definition, properties, and applications.` }
      ],
      formula: [
        { question: `What is the formula for ${nodeLabel}?`, answer: `Formula for ${nodeLabel}` },
        { question: `Calculate using the formula for ${nodeLabel}: given standard inputs.`, answer: `Result using ${nodeLabel} formula` },
        { question: `Which variable represents ${nodeLabel} in the formula?`, answer: `The primary variable`, options: ["The primary variable", "A constant", "A coefficient", "An exponent"] }
      ],
      example: [
        { question: `Give an example of ${nodeLabel}.`, answer: `Example of ${nodeLabel}` },
        { question: `Which of the following is an example of ${nodeLabel}?`, answer: `Correct example`, options: ["Correct example", "Incorrect example 1", "Incorrect example 2", "Incorrect example 3"] },
        { question: `True or False: The following is an example of ${nodeLabel}.`, answer: "True", options: ["True", "False"] }
      ],
      chapter: [
        { question: `What are the main topics covered in ${nodeLabel}?`, answer: `Main topics in ${nodeLabel}` },
        { question: `Summarize the key points of ${nodeLabel}.`, answer: `Summary of ${nodeLabel}` },
        { question: `Which topic is NOT covered in ${nodeLabel}?`, answer: `Unrelated topic`, options: ["Covered topic A", "Covered topic B", "Unrelated topic", "Covered topic C"] }
      ]
    };

    const typeTemplates = templates[type] ?? templates.concept;
    const questionTypes: Array<Question["type"]> = ["multiple_choice", "short_answer", "fill_blank", "calculation", "true_false"];

    for (let i = 0; i < count; i++) {
      const template = typeTemplates[i % typeTemplates.length];
      const questionType = template.options
        ? (template.options.length === 2 ? "true_false" : "multiple_choice")
        : (i % 2 === 0 ? "short_answer" : "fill_blank");

      questions.push({
        id: `q-${nodeId}-${i + 1}`,
        type: questionType,
        nodeId,
        question: template.question,
        options: template.options,
        answer: template.answer,
        explanation: `This question tests understanding of ${nodeLabel}.`,
        difficulty: Math.min(3 + Math.floor(i / 2), 5),
        responsibilityColor: "gray"
      });
    }

    return questions;
  }

  recordMistake(question: Question, userAnswer: string, attribution: string): MistakeRecord {
    return {
      id: `mistake-${question.id}-${Date.now()}`,
      questionId: question.id,
      nodeId: question.nodeId,
      userAnswer,
      correctAnswer: question.answer,
      attribution: attribution as MistakeRecord["attribution"],
      reviewedAt: new Date().toISOString(),
      mastered: false
    };
  }

  getWeakNodes(mistakes: MistakeRecord[], graph: CourseKnowledgeGraph): KnowledgeNode[] {
    const mistakeCountByNode = new Map<string, number>();

    for (const mistake of mistakes) {
      const count = mistakeCountByNode.get(mistake.nodeId) ?? 0;
      mistakeCountByNode.set(mistake.nodeId, count + 1);
    }

    const weakNodeIds = [...mistakeCountByNode.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nodeId]) => nodeId);

    return weakNodeIds
      .map(id => graph.nodes.find(n => n.id === id))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }
}
