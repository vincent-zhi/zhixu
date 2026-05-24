import type { PlagiarismCheckResult, PlagiarismSegment } from "./types.js";

const AI_PHRASES = [
  "as an ai",
  "as a language model",
  "i don't have personal",
  "in conclusion, it is important",
  "it is worth noting that",
  "in summary, this",
  "furthermore, it is essential",
  "it is crucial to note",
  "delve into",
  "tapestry of",
  "navigating the complexities",
  "in today's world",
  "realm of",
  "landscape of",
  "pivotal role",
  "multifaceted",
  "paradigm shift",
];

const QUOTE_PATTERN = /["\u201C\u201D]([^"\u201C\u201D]{50,})["\u201C\u201D]/g;

export class PlagiarismPrechecker {
  checkContent(content: string): PlagiarismCheckResult {
    const flaggedSegments: PlagiarismSegment[] = [];
    const lower = content.toLowerCase();

    const aiMatches = lower.matchAll(new RegExp(`(${AI_PHRASES.map(escapeRegex).join("|")})`, "gi"));
    for (const match of aiMatches) {
      flaggedSegments.push({
        text: match[0],
        startIndex: match.index ?? 0,
        endIndex: (match.index ?? 0) + match[0].length,
        similarityScore: 0.9,
        sourceType: "ai_generated",
        matchedSource: "common_ai_phrase",
      });
    }

    const quoteMatches = content.matchAll(QUOTE_PATTERN);
    for (const match of quoteMatches) {
      flaggedSegments.push({
        text: match[1]!,
        startIndex: match.index ?? 0,
        endIndex: (match.index ?? 0) + match[0].length,
        similarityScore: 0.7,
        sourceType: "academic",
        matchedSource: null,
      });
    }

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const sim = computeNgramOverlap(sentences[i]!, sentences[j]!);
        if (sim > 0.6) {
          const idxA = content.indexOf(sentences[i]!.trim());
          const idxB = content.indexOf(sentences[j]!.trim());
          if (idxA >= 0) {
            flaggedSegments.push({
              text: sentences[i]!.trim(),
              startIndex: idxA,
              endIndex: idxA + sentences[i]!.trim().length,
              similarityScore: sim,
              sourceType: "self_plagiarism",
              matchedSource: `sentence_${j}`,
            });
          }
        }
      }
    }

    const aiProb = this.estimateAIGeneration(content);
    const overallScore = flaggedSegments.length === 0 ? 1 : Math.max(0, 1 - flaggedSegments.length * 0.1);

    const recommendations: string[] = [];
    if (aiProb > 0.5) {
      recommendations.push("Content shows patterns consistent with AI-generated text. Review and rewrite flagged sections.");
    }
    if (flaggedSegments.some((s) => s.sourceType === "academic")) {
      recommendations.push("Long quoted passages detected. Ensure proper citation and quotation formatting.");
    }
    if (flaggedSegments.some((s) => s.sourceType === "self_plagiarism")) {
      recommendations.push("Similar sentences detected. Review for potential redundancy or self-plagiarism.");
    }

    return {
      id: crypto.randomUUID(),
      artifactId: "",
      overallScore,
      flaggedSegments,
      aiGeneratedProbability: aiProb,
      recommendations,
    };
  }

  estimateAIGeneration(content: string): number {
    const lower = content.toLowerCase();
    let score = 0;
    let factors = 0;

    let aiPhraseCount = 0;
    for (const phrase of AI_PHRASES) {
      if (lower.includes(phrase)) {
        aiPhraseCount++;
      }
    }
    score += Math.min(aiPhraseCount / 3, 1) * 0.4;
    factors++;

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 2) {
      const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((sum, l) => sum + (l - avg) ** 2, 0) / lengths.length;
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
      if (cv < 0.3) {
        score += 0.3;
      }
      factors++;
    }

    const transitionWords = ["furthermore", "moreover", "additionally", "consequently", "nevertheless", "subsequently"];
    let transitionCount = 0;
    for (const word of transitionWords) {
      if (lower.includes(word)) {
        transitionCount++;
      }
    }
    score += Math.min(transitionCount / 4, 1) * 0.3;
    factors++;

    return factors > 0 ? Math.min(score, 1) : 0;
  }
}

function computeNgramOverlap(a: string, b: string, n: number = 3): number {
  const ngramsA = getNgrams(a.toLowerCase(), n);
  const ngramsB = getNgrams(b.toLowerCase(), n);

  if (ngramsA.size === 0 && ngramsB.size === 0) return 1;
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

  let intersection = 0;
  for (const ng of ngramsA) {
    if (ngramsB.has(ng)) {
      intersection++;
    }
  }

  const union = ngramsA.size + ngramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getNgrams(text: string, n: number): Set<string> {
  const words = text.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 0);
  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
