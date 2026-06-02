import type { CanvasPatch, PresentationBrief, PaperCard, PaperComparisonMatrix, SlidePlan, AdvisorQuestion } from "./types.js";

export class CanvasAgent {
  private patches: CanvasPatch[] = [];

  patchCanvas(patch: CanvasPatch): void {
    this.patches.push(patch);
  }

  updateBrief(brief: PresentationBrief): void {
    this.patchCanvas({
      artifactId: `brief-${brief.id}`,
      operation: "upsert_block",
      blockType: "presentation_brief",
      contentJson: brief as unknown as Record<string, unknown>,
      evidenceRefs: brief.sourceIds,
      responsibilityColor: "green"
    });
  }

  updatePaperCards(cards: PaperCard[]): void {
    for (const card of cards) {
      this.patchCanvas({
        artifactId: `paper-cards-${card.projectId}`,
        operation: "upsert_block",
        blockType: "paper_card",
        contentJson: card as unknown as Record<string, unknown>,
        evidenceRefs: Object.keys(card.evidencePageNumbers),
        responsibilityColor: card.responsibilityColor
      });
    }
  }

  updateComparisonMatrix(matrix: PaperComparisonMatrix): void {
    this.patchCanvas({
      artifactId: `matrix-${matrix.id}`,
      operation: "upsert_block",
      blockType: "comparison_matrix",
      contentJson: matrix as unknown as Record<string, unknown>,
      evidenceRefs: matrix.papers.map((p) => p.sourceId),
      responsibilityColor: "yellow"
    });
  }

  updateSlidePlans(plans: SlidePlan[]): void {
    for (const plan of plans) {
      this.patchCanvas({
        artifactId: `slide-plan-${plan.id}`,
        operation: "upsert_block",
        blockType: "slide_plan",
        contentJson: plan as unknown as Record<string, unknown>,
        evidenceRefs: plan.evidenceRefs,
        responsibilityColor: plan.responsibilityColor,
        orderIndex: plan.orderIndex
      });
    }
  }

  updateAdvisorQuestions(questions: AdvisorQuestion[]): void {
    for (const question of questions) {
      this.patchCanvas({
        artifactId: `advisor-questions-${question.projectId}`,
        operation: "upsert_block",
        blockType: "advisor_question",
        contentJson: question as unknown as Record<string, unknown>,
        evidenceRefs: question.evidenceRefs,
        responsibilityColor: "yellow"
      });
    }
  }

  getPatches(): CanvasPatch[] {
    return [...this.patches];
  }

  clearPatches(): void {
    this.patches = [];
  }
}
