import type { DefenseQuestion, DefenseSimulation, DefensePerformance } from "./types.js";

const CATEGORY_TEMPLATES: Record<DefenseQuestion["category"], Array<{ question: string; expectedPoints: string[] }>> = {
  methodology: [
    { question: "Why did you choose this methodology over alternatives?", expectedPoints: ["comparison with alternatives", "justification for choice", "limitations acknowledged"] },
    { question: "How did you ensure the validity of your approach?", expectedPoints: ["validation strategy", "threats to validity", "mitigation measures"] },
    { question: "Can you describe your research design in detail?", expectedPoints: ["research design type", "data collection methods", "analysis approach"] },
  ],
  results: [
    { question: "What are your key findings?", expectedPoints: ["main results stated", "statistical significance", "practical implications"] },
    { question: "How do your results compare to prior work?", expectedPoints: ["comparison with baseline", "improvement magnitude", "novel findings"] },
    { question: "Were there any unexpected results?", expectedPoints: ["unexpected findings described", "possible explanations", "follow-up investigations"] },
  ],
  contribution: [
    { question: "What is the main contribution of your work?", expectedPoints: ["novelty stated", "significance explained", "impact described"] },
    { question: "How does your work advance the field?", expectedPoints: ["gap addressed", "new knowledge created", "practical applications"] },
  ],
  literature: [
    { question: "How does your work relate to existing literature?", expectedPoints: ["key references cited", "positioning in field", "gap identification"] },
    { question: "What are the most influential works in your area?", expectedPoints: ["seminal works identified", "recent advances noted", "connections to own work"] },
  ],
  future_work: [
    { question: "What are the next steps for this research?", expectedPoints: ["concrete next steps", "long-term vision", "resource requirements"] },
    { question: "How could your approach be extended?", expectedPoints: ["extension possibilities", "new domains of application", "methodological improvements"] },
  ],
  weakness: [
    { question: "What are the limitations of your study?", expectedPoints: ["limitations acknowledged", "impact on conclusions", "mitigation strategies"] },
    { question: "How would you address criticisms of your approach?", expectedPoints: ["anticipated criticisms", "defensive arguments", "acknowledged trade-offs"] },
  ],
};

export class DefenseSimulator {
  generateQuestions(input: { projectTitle: string; projectType: string; content: string }): DefenseQuestion[] {
    const categories: DefenseQuestion["category"][] = [
      "methodology", "results", "contribution", "literature", "future_work", "weakness",
    ];

    const questions: DefenseQuestion[] = [];

    for (const category of categories) {
      const templates = CATEGORY_TEMPLATES[category];
      const selected = templates[Math.floor(Math.random() * templates.length)]!;

      questions.push({
        id: crypto.randomUUID(),
        category,
        question: selected.question,
        expectedPoints: selected.expectedPoints,
        difficulty: Math.random() * 0.4 + 0.3,
      });
    }

    return questions;
  }

  evaluateAnswer(
    question: DefenseQuestion,
    answer: string
  ): { score: number; coveredPoints: string[]; missedPoints: string[] } {
    const answerLower = answer.toLowerCase();
    const coveredPoints: string[] = [];
    const missedPoints: string[] = [];

    for (const point of question.expectedPoints) {
      const keywords = point.toLowerCase().split(/\s+/);
      const matchCount = keywords.filter((kw) => answerLower.includes(kw)).length;
      if (matchCount / keywords.length >= 0.5) {
        coveredPoints.push(point);
      } else {
        missedPoints.push(point);
      }
    }

    const score = question.expectedPoints.length > 0
      ? coveredPoints.length / question.expectedPoints.length
      : 0;

    return { score, coveredPoints, missedPoints };
  }

  runSimulation(
    questions: DefenseQuestion[],
    answers: Array<{ questionId: string; answer: string }>
  ): DefenseSimulation {
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
    const scores: Array<{ category: string; score: number }> = [];

    for (const question of questions) {
      const answer = answerMap.get(question.id);
      if (answer) {
        const result = this.evaluateAnswer(question, answer);
        scores.push({ category: question.category, score: result.score });
      }
    }

    const answeredQuestions = scores.length;
    const totalQuestions = questions.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

    const categoryScores = new Map<string, number[]>();
    for (const s of scores) {
      const existing = categoryScores.get(s.category) ?? [];
      existing.push(s.score);
      categoryScores.set(s.category, existing);
    }

    const weakCategories: string[] = [];
    const strongCategories: string[] = [];

    for (const [category, catScores] of categoryScores) {
      const avg = catScores.reduce((a, b) => a + b, 0) / catScores.length;
      if (avg < 0.5) {
        weakCategories.push(category);
      } else if (avg >= 0.7) {
        strongCategories.push(category);
      }
    }

    const performance: DefensePerformance = {
      answeredQuestions,
      totalQuestions,
      averageScore,
      weakCategories,
      strongCategories,
    };

    return {
      id: crypto.randomUUID(),
      projectId: "",
      questions,
      performance,
      overallScore: averageScore,
    };
  }
}
