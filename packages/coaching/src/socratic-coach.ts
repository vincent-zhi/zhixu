import type { SocraticQuestion, LLMCallable } from "./types.js";

const CATEGORY_QUESTIONS: Record<SocraticQuestion["category"], Array<{ template: string; followUps: string[] }>> = {
  assumption: [
    { template: "What assumptions underlie the claim that {topic}?", followUps: ["Are these assumptions justified?", "What happens if these assumptions are wrong?"] },
    { template: "What would need to be true for {topic} to hold?", followUps: ["How could you verify these conditions?", "What evidence supports these prerequisites?"] },
  ],
  evidence: [
    { template: "What evidence supports the claim about {topic}?", followUps: ["Is this evidence sufficient?", "What kind of evidence would strengthen the claim?"] },
    { template: "How would you test the validity of {topic}?", followUps: ["What would constitute a fair test?", "What are potential confounding factors?"] },
  ],
  alternative: [
    { template: "What alternative explanations exist for {topic}?", followUps: ["How do these alternatives compare?", "What would distinguish between them?"] },
    { template: "Could {topic} be interpreted differently?", followUps: ["What perspective leads to a different interpretation?", "What evidence would support that view?"] },
  ],
  implication: [
    { template: "What are the implications if {topic} is true?", followUps: ["Who is affected by these implications?", "Are there unintended consequences?"] },
    { template: "What follows logically from {topic}?", followUps: ["Does this lead to any contradictions?", "How far can this reasoning be extended?"] },
  ],
  definition: [
    { template: "How do you define {topic} precisely?", followUps: ["Is this definition widely accepted?", "What edge cases challenge this definition?"] },
    { template: "What distinguishes {topic} from related concepts?", followUps: ["Where is the boundary between them?", "Could they be conflated?"] },
  ],
};

export class SocraticCoach {
  generateQuestions(topic: string, depth: number = 1): SocraticQuestion[] {
    const categories: SocraticQuestion["category"][] = [
      "assumption", "evidence", "alternative", "implication", "definition",
    ];

    const questions: SocraticQuestion[] = [];
    const selectedCategories = categories.slice(0, Math.min(depth * 2, categories.length));

    for (const category of selectedCategories) {
      const templates = CATEGORY_QUESTIONS[category];
      const selected = templates[Math.floor(Math.random() * templates.length)]!;

      questions.push({
        id: crypto.randomUUID(),
        category,
        question: selected.template.replace("{topic}", topic),
        followUpQuestions: selected.followUps,
        relatedConcept: topic,
      });
    }

    return questions;
  }

  followUp(previousQuestion: SocraticQuestion, answer: string): SocraticQuestion[] {
    const answerWords = new Set(answer.toLowerCase().split(/\s+/));
    const questions: SocraticQuestion[] = [];

    const nextCategories: SocraticQuestion["category"][] = [];
    switch (previousQuestion.category) {
      case "assumption":
        nextCategories.push("evidence", "alternative");
        break;
      case "evidence":
        nextCategories.push("implication", "assumption");
        break;
      case "alternative":
        nextCategories.push("evidence", "definition");
        break;
      case "implication":
        nextCategories.push("assumption", "alternative");
        break;
      case "definition":
        nextCategories.push("evidence", "alternative");
        break;
    }

    for (const category of nextCategories) {
      const templates = CATEGORY_QUESTIONS[category];
      const selected = templates[Math.floor(Math.random() * templates.length)]!;

      const concept = previousQuestion.relatedConcept;
      const question = selected.template.replace("{topic}", concept);

      questions.push({
        id: crypto.randomUUID(),
        category,
        question,
        followUpQuestions: selected.followUps,
        relatedConcept: concept,
      });
    }

    return questions;
  }

  async generateContextualQuestions(
    topic: string,
    conversationHistory: string[],
    projectContext: { title: string; type: string },
    llm: LLMCallable
  ): Promise<SocraticQuestion[]> {
    try {
      const result = await llm.chat({
        system: `你是一位苏格拉底式教学导师。根据话题和对话历史，生成 4 个递进式追问。
返回 JSON 数组：[{"category": "...", "question": "...", "followUp": "..."}]`,
        messages: [{ role: "user", content: `话题：${topic}\n项目：${projectContext.title}（${projectContext.type}）\n历史对话：\n${conversationHistory.slice(-5).join("\n")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return (Array.isArray(parsed) ? parsed : parsed.questions ?? []).map((q: any) => ({
        id: crypto.randomUUID(),
        category: q.category ?? "assumption",
        question: q.question ?? "",
        followUpQuestions: q.followUp ? [q.followUp] : [],
        relatedConcept: topic,
      }));
    } catch {
      return this.generateQuestions(topic, 2);
    }
  }

  async generateContextualQuestionsEnhanced(
    conversationHistory: string[],
    projectContext: { title: string; type: string; sources: string[] },
    llm: LLMCallable
  ): Promise<SocraticQuestion[]> {
    try {
      const result = await llm.chat({
        system: `你是一位苏格拉底式教学导师。根据对话历史和项目上下文，生成 4 个递进式追问。
返回 JSON：{"questions": [{"category": "assumption"|"evidence"|"alternative"|"implication"|"definition", "question": "...", "followUpQuestions": ["..."], "relatedConcept": "..."}]}`,
        messages: [{ role: "user", content: `项目：${projectContext.title}（${projectContext.type}）\n参考资料：${projectContext.sources.join("、")}\n对话历史：\n${conversationHistory.slice(-5).join("\n")}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      const questions: SocraticQuestion[] = (Array.isArray(parsed) ? parsed : parsed.questions ?? []).map((q: any) => ({
        id: crypto.randomUUID(),
        category: q.category ?? "assumption",
        question: q.question ?? "",
        followUpQuestions: q.followUpQuestions ?? [],
        relatedConcept: q.relatedConcept ?? projectContext.title,
        verificationStatus: "yellow" as const,
      }));
      if (questions.length > 0) return questions;
      return this.generateQuestions(projectContext.title, 2).map((q) => ({ ...q, verificationStatus: "green" as const }));
    } catch {
      return this.generateQuestions(projectContext.title, 2).map((q) => ({ ...q, verificationStatus: "green" as const }));
    }
  }
}
