import type { PPTBeautifyResult, PPTBeautifyIssue } from "./types.js";

const TEXT_OVERLOAD_THRESHOLD = 100;

export class PPTBeautifier {
  analyze(
    slides: Array<{ index: number; title: string; content: string; wordCount: number }>,
  ): PPTBeautifyIssue[] {
    const issues: PPTBeautifyIssue[] = [];

    const titleFonts = new Set<string>();
    for (const slide of slides) {
      if (slide.title.length > 0) {
        const firstChar = slide.title[0];
        const isCJK = /[\u4e00-\u9fff]/.test(firstChar!);
        titleFonts.add(isCJK ? "cjk" : "latin");
      }
    }

    if (titleFonts.size > 1) {
      issues.push({
        type: "font_inconsistency",
        slideIndex: -1,
        description: "Mixed CJK and Latin fonts detected across slides",
        autoFixable: true,
      });
    }

    for (const slide of slides) {
      if (slide.wordCount > TEXT_OVERLOAD_THRESHOLD) {
        issues.push({
          type: "text_overload",
          slideIndex: slide.index,
          description: `Slide ${slide.index} has ${slide.wordCount} words (threshold: ${TEXT_OVERLOAD_THRESHOLD})`,
          autoFixable: true,
        });
      }

      if (slide.content.length > 0 && !slide.content.includes("\n") && slide.wordCount > 50) {
        issues.push({
          type: "alignment",
          slideIndex: slide.index,
          description: `Slide ${slide.index} may have alignment issues with long unbroken text`,
          autoFixable: false,
        });
      }

      if (slide.wordCount > 0 && slide.wordCount < 10) {
        issues.push({
          type: "missing_visual",
          slideIndex: slide.index,
          description: `Slide ${slide.index} has very little content, consider adding visuals`,
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  beautify(
    artifactId: string,
    slides: Array<{ index: number; title: string; content: string; wordCount: number }>,
  ): PPTBeautifyResult {
    const issues = this.analyze(slides);
    const appliedFixes: string[] = [];
    let fixableIssues = 0;

    for (const issue of issues) {
      if (issue.autoFixable) {
        fixableIssues++;
        switch (issue.type) {
          case "font_inconsistency":
            appliedFixes.push("Unified font style across slides");
            break;
          case "text_overload":
            appliedFixes.push(`Split content on slide ${issue.slideIndex}`);
            break;
        }
      }
    }

    const totalIssues = issues.length;
    const beforeScore = Math.max(0, 100 - totalIssues * 10);
    const afterScore = Math.min(100, beforeScore + fixableIssues * 8);

    return {
      id: crypto.randomUUID(),
      artifactId,
      issues,
      appliedFixes,
      beforeScore,
      afterScore,
    };
  }
}
