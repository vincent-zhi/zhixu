import { PaperReader } from "@zhixu/research";
import type { TimelineEntry } from "@zhixu/research";
import { PaperAnalyzer } from "@zhixu/paper-reading";
import type { PaperCard, PaperComparisonMatrix, PresentationPath, AdvisorQuestion } from "./types.js";

export class PaperReadingAgent {
  private readonly paperReader = new PaperReader();
  private readonly paperAnalyzer = new PaperAnalyzer();

  async readPaper(sourceId: string): Promise<PaperCard> {
    const entry = this.paperReader.readPaper({
      id: sourceId,
      fileName: sourceId,
      content: ""
    });

    return {
      id: entry.id,
      sourceId: entry.sourceId,
      projectId: "",
      title: entry.title,
      authors: entry.authors,
      year: entry.year,
      venue: entry.venue,
      doi: entry.doi,
      researchQuestion: entry.problem,
      backgroundMotivation: entry.problem,
      methodFramework: entry.method,
      dataset: entry.dataset,
      metricsAndResults: Array.isArray(entry.metrics) ? entry.metrics.join(", ") : entry.mainResults,
      mainContributions: entry.mainResults,
      limitations: entry.limitations,
      reproducibility: "",
      keyFigures: [],
      references: [],
      evidencePageNumbers: {},
      responsibilityColor: "gray"
    };
  }

  async generateComparisonMatrix(paperCards: PaperCard[]): Promise<PaperComparisonMatrix> {
    const matrix = this.paperReader.comparePapers(
      paperCards.map((card) => ({
        id: card.id,
        sourceId: card.sourceId,
        title: card.title,
        authors: card.authors,
        year: card.year,
        venue: card.venue,
        problem: card.researchQuestion,
        method: card.methodFramework,
        dataset: card.dataset,
        metrics: card.metricsAndResults.split(", "),
        mainResults: card.mainContributions,
        limitations: card.limitations,
        futureWork: "",
        relevanceToProject: "",
        doi: card.doi
      }))
    );

    return {
      id: matrix.id,
      projectId: matrix.projectId,
      papers: paperCards,
      comparisonFields: matrix.comparisonMatrix.map((field: { field: string; values: Record<string, string> }) => ({
        field: field.field,
        values: field.values
      })),
      methodCategories: [],
      timeline: (matrix.timeline as TimelineEntry[]).map((t) => ({
        year: t.year,
        event: t.milestone
      })),
      controversies: (matrix.controversies as string[]).map((c) => ({
        topic: c,
        positions: paperCards.map((p) => ({ sourceId: p.sourceId, position: "see paper" }))
      })),
      researchGaps: matrix.researchGaps,
      suggestedOutline: (matrix.suggestedOutline as string[]).map((s) => ({ section: s, keyPoints: [] }))
    };
  }

  async generatePresentationPaths(matrix: PaperComparisonMatrix): Promise<PresentationPath[]> {
    const paths: PresentationPath[] = [
      {
        id: "path-deep-dive",
        pathType: "deep_dive",
        title: "深度精读路径",
        description: "聚焦单篇论文的深度解读",
        suitableScenario: "课程PPT汇报，需要深入讲解一篇论文",
        estimatedSlides: 12,
        estimatedDuration: 15,
        focusPapers: matrix.papers.slice(0, 1).map((p) => p.sourceId),
        outlineSections: matrix.suggestedOutline.map((s) => s.section),
        riskLevel: "L0",
        isRecommended: matrix.papers.length === 1
      },
      {
        id: "path-comparison",
        pathType: "comparison",
        title: "对比分析路径",
        description: "横向对比多篇论文的方法与结果",
        suitableScenario: "组会论文汇报，需要对比多篇相关工作",
        estimatedSlides: 15,
        estimatedDuration: 20,
        focusPapers: matrix.papers.map((p) => p.sourceId),
        outlineSections: matrix.suggestedOutline.map((s) => s.section),
        riskLevel: "L1",
        isRecommended: matrix.papers.length > 1
      },
      {
        id: "path-evolution",
        pathType: "evolution",
        title: "演进脉络路径",
        description: "按时间线梳理研究演进",
        suitableScenario: "文献综述类汇报，展示领域发展脉络",
        estimatedSlides: 18,
        estimatedDuration: 25,
        focusPapers: matrix.papers.map((p) => p.sourceId),
        outlineSections: matrix.suggestedOutline.map((s) => s.section),
        riskLevel: "L1",
        isRecommended: false
      }
    ];

    return paths;
  }

  async generateAdvisorQuestions(paperCards: PaperCard[], matrix: PaperComparisonMatrix): Promise<AdvisorQuestion[]> {
    const questions: AdvisorQuestion[] = [];

    for (const card of paperCards) {
      questions.push({
        id: `q-method-${card.id}`,
        projectId: card.projectId,
        question: `${card.title} 的核心方法是什么？与同类方法相比有何创新？`,
        category: "method",
        relatedSourceIds: [card.sourceId],
        suggestedAnswer: card.methodFramework,
        difficultyLevel: "basic",
        evidenceRefs: [card.sourceId]
      });

      questions.push({
        id: `q-data-${card.id}`,
        projectId: card.projectId,
        question: `${card.title} 使用了什么数据集？结果是否可复现？`,
        category: "data",
        relatedSourceIds: [card.sourceId],
        suggestedAnswer: `数据集: ${card.dataset}，可复现性: ${card.reproducibility || "未明确"}`,
        difficultyLevel: "intermediate",
        evidenceRefs: [card.sourceId]
      });

      questions.push({
        id: `q-weakness-${card.id}`,
        projectId: card.projectId,
        question: `${card.title} 有哪些局限性？可能的改进方向是什么？`,
        category: "weakness",
        relatedSourceIds: [card.sourceId],
        suggestedAnswer: card.limitations,
        difficultyLevel: "challenging",
        evidenceRefs: [card.sourceId]
      });
    }

    if (matrix.researchGaps.length > 0) {
      questions.push({
        id: "q-research-gaps",
        projectId: matrix.projectId,
        question: `当前研究领域存在哪些空白？如何填补？`,
        category: "extension",
        relatedSourceIds: matrix.papers.map((p) => p.sourceId),
        suggestedAnswer: matrix.researchGaps.join("；"),
        difficultyLevel: "challenging",
        evidenceRefs: matrix.papers.map((p) => p.sourceId)
      });
    }

    return questions;
  }
}
