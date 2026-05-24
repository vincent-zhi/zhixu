import type { CrossVerificationResult } from "./types.js";

export class CrossVerifier {
  verify(
    inTextCitations: Array<{ key: string; rawText: string }>,
    referenceList: Array<{ key: string; rawText: string }>
  ): CrossVerificationResult {
    const inTextKeys = new Map<string, { key: string; rawText: string }>();
    for (const cite of inTextCitations) {
      inTextKeys.set(normalizeKey(cite.key), cite);
    }

    const refKeys = new Map<string, { key: string; rawText: string }>();
    for (const ref of referenceList) {
      refKeys.set(normalizeKey(ref.key), ref);
    }

    let matchedCitations = 0;
    const orphanedInText: string[] = [];
    const orphanedInReference: string[] = [];

    for (const [normalizedKey, cite] of inTextKeys) {
      if (refKeys.has(normalizedKey)) {
        matchedCitations++;
      } else {
        orphanedInText.push(cite.rawText);
      }
    }

    for (const [normalizedKey, ref] of refKeys) {
      if (!inTextKeys.has(normalizedKey)) {
        orphanedInReference.push(ref.rawText);
      }
    }

    const total = inTextCitations.length + referenceList.length;
    const consistencyScore = total > 0
      ? (2 * matchedCitations) / total
      : 1;

    return {
      id: crypto.randomUUID(),
      projectId: "",
      inTextCitations: inTextCitations.length,
      referenceListCitations: referenceList.length,
      matchedCitations,
      orphanedInText,
      orphanedInReference,
      consistencyScore: Math.min(consistencyScore, 1),
    };
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
