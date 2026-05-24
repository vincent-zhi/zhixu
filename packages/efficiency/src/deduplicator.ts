import type { DeduplicationResult, DuplicatePair } from "./types.js";

export class ContentDeduplicator {
  deduplicate(contents: string[], threshold: number = 0.7): DeduplicationResult {
    const duplicates: DuplicatePair[] = [];
    const merged: string[] = [];
    const included = new Set<number>();

    for (let i = 0; i < contents.length; i++) {
      if (included.has(i)) continue;

      let bestMatch: { index: number; similarity: number } | null = null;

      for (let j = i + 1; j < contents.length; j++) {
        if (included.has(j)) continue;

        const similarity = this.computeSimilarity(contents[i]!, contents[j]!);
        if (similarity >= threshold) {
          duplicates.push({
            indexA: i,
            indexB: j,
            similarity,
            contentA: contents[i]!,
            contentB: contents[j]!,
          });

          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { index: j, similarity };
          }
        }
      }

      if (bestMatch) {
        included.add(bestMatch.index);
      }

      merged.push(contents[i]!);
    }

    return {
      id: crypto.randomUUID(),
      inputCount: contents.length,
      outputCount: merged.length,
      duplicates,
      mergedContent: merged.join("\n\n"),
    };
  }

  computeSimilarity(a: string, b: string): number {
    const wordsA = tokenize(a);
    const wordsB = tokenize(b);

    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) {
        intersection++;
      }
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );
}
