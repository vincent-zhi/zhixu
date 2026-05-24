import type { SelfCheckResult, SelfCheckIssue } from "./types.js";

const COLLOQUIAL_PATTERNS = [
  /\b(我觉得|我觉得吧|反正|就是|然后|那个|这个|怎么说呢|其实吧|说白了)\b/g,
  /\b(like|you know|basically|stuff|things|kinda|sorta|gonna|wanna|gotta|dunno)\b/gi,
];

const CONTRADICTION_PATTERNS = [
  { positive: /\b(increase|improve|enhance|boost|raise|grow)\b/i, negative: /\b(decrease|reduce|decline|lower|drop|diminish)\b/i },
  { positive: /\b(support|confirm|prove|demonstrate|verify)\b/i, negative: /\b(contradict|refute|disprove|deny|negate)\b/i },
];

export class SelfChecker {
  checkArtifact(input: {
    content: string;
    requirements: {
      minWords?: number;
      maxWords?: number;
      requiredSections?: string[];
      citationStyle?: string;
    };
  }): SelfCheckResult {
    const { content, requirements } = input;
    const issues: SelfCheckIssue[] = [];

    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    let wordCountScore = 100;
    if (requirements.minWords && wordCount < requirements.minWords) {
      const deficit = requirements.minWords - wordCount;
      wordCountScore = Math.max(0, 100 - deficit);
      issues.push({
        type: "word_count",
        severity: deficit > requirements.minWords * 0.3 ? "error" : "warning",
        message: `Word count ${wordCount} is below minimum ${requirements.minWords}`,
        location: "document",
        suggestion: `Add approximately ${deficit} more words`,
      });
    }
    if (requirements.maxWords && wordCount > requirements.maxWords) {
      const excess = wordCount - requirements.maxWords;
      wordCountScore = Math.max(0, 100 - excess);
      issues.push({
        type: "word_count",
        severity: excess > requirements.maxWords * 0.1 ? "error" : "warning",
        message: `Word count ${wordCount} exceeds maximum ${requirements.maxWords}`,
        location: "document",
        suggestion: `Remove approximately ${excess} words`,
      });
    }

    let structureScore = 100;
    if (requirements.requiredSections && requirements.requiredSections.length > 0) {
      const foundSections = requirements.requiredSections.filter((section) =>
        content.toLowerCase().includes(section.toLowerCase()),
      );
      const missingSections = requirements.requiredSections.filter(
        (section) => !content.toLowerCase().includes(section.toLowerCase()),
      );
      structureScore = Math.round(
        (foundSections.length / requirements.requiredSections.length) * 100,
      );

      for (const missing of missingSections) {
        issues.push({
          type: "structure",
          severity: "error",
          message: `Missing required section: "${missing}"`,
          location: "document",
          suggestion: `Add a section titled "${missing}"`,
        });
      }
    }

    const citationPattern = /\[\d+\]|\(\w+,?\s*\d{4}\)/g;
    const citationMatches = content.match(citationPattern);
    const citationCount = citationMatches ? citationMatches.length : 0;
    const citationCompleteness = Math.min(100, citationCount * 20);

    if (citationCount === 0 && wordCount > 200) {
      issues.push({
        type: "citation",
        severity: "warning",
        message: "No citations found in document",
        location: "document",
        suggestion: "Add proper citations to support claims",
      });
    }

    let colloquialCount = 0;
    for (const pattern of COLLOQUIAL_PATTERNS) {
      const matches = content.match(pattern);
      colloquialCount += matches ? matches.length : 0;
    }
    const formalityScore = Math.max(0, 100 - colloquialCount * 15);

    if (colloquialCount > 0) {
      issues.push({
        type: "formality",
        severity: colloquialCount > 3 ? "error" : "warning",
        message: `Found ${colloquialCount} colloquial expression(s)`,
        location: "document",
        suggestion: "Replace informal language with academic expressions",
      });
    }

    let contradictionCount = 0;
    for (const pattern of CONTRADICTION_PATTERNS) {
      if (pattern.positive.test(content) && pattern.negative.test(content)) {
        contradictionCount++;
      }
    }
    const logicScore = Math.max(0, 100 - contradictionCount * 25);

    if (contradictionCount > 0) {
      issues.push({
        type: "logic",
        severity: contradictionCount > 1 ? "error" : "warning",
        message: `Detected ${contradictionCount} potential contradiction(s)`,
        location: "document",
        suggestion: "Review and resolve contradictory statements",
      });
    }

    const formatScore = 80;
    const topicMatchScore = 75;

    const overallScore = Math.round(
      (wordCountScore * 0.15 +
        formatScore * 0.1 +
        structureScore * 0.2 +
        topicMatchScore * 0.15 +
        citationCompleteness * 0.15 +
        formalityScore * 0.1 +
        logicScore * 0.15),
    );

    return {
      id: crypto.randomUUID(),
      artifactId: "",
      wordCount,
      formatScore,
      structureScore,
      topicMatchScore,
      citationCompleteness,
      formalityScore,
      logicScore,
      issues,
      overallScore,
    };
  }
}
