import type { StyleProfile, LLMCallable } from "./types.js";

export class StyleUnifier {
  createProfile(input: Omit<StyleProfile, "id">): StyleProfile {
    return {
      ...input,
      id: crypto.randomUUID(),
    };
  }

  unifyStyle(content: string, profile: StyleProfile): string {
    let result = content;

    if (profile.preferences.avoidFirstPerson) {
      result = result.replace(/\bI\s+(think|believe|argue|contend|propose|suggest)\b/gi, "It is $1d that");
      result = result.replace(/\bwe\s+(think|believe|argue|contend|propose|suggest)\b/gi, "It is $1d that");
      result = result.replace(/\bI\s+(found|discovered|observed|noticed)\b/gi, "It was $1 that");
      result = result.replace(/\bwe\s+(found|discovered|observed|noticed)\b/gi, "It was $1 that");
      result = result.replace(/\bmy\s+/gi, "the ");
      result = result.replace(/\bour\s+/gi, "the ");
    }

    if (profile.preferences.preferredTense === "past") {
      result = result.replace(/\b(is|are)\s+(used|applied|considered|employed|utilized)\b/gi, "was $2");
      result = result.replace(/\b(is|are)\s+(shown|demonstrated|proposed|presented)\b/gi, "was $2");
    } else if (profile.preferences.preferredTense === "present") {
      result = result.replace(/\b(was|were)\s+(used|applied|considered|employed|utilized)\b/gi, "is $2");
      result = result.replace(/\b(was|were)\s+(shown|demonstrated|proposed|presented)\b/gi, "is $2");
    }

    if (profile.preferences.formalityLevel >= 3) {
      result = result.replace(/\bcan't\b/gi, "cannot");
      result = result.replace(/\bdon't\b/gi, "do not");
      result = result.replace(/\bdoesn't\b/gi, "does not");
      result = result.replace(/\bwon't\b/gi, "will not");
      result = result.replace(/\bisn't\b/gi, "is not");
      result = result.replace(/\baren't\b/gi, "are not");
      result = result.replace(/\bwasn't\b/gi, "was not");
      result = result.replace(/\bweren't\b/gi, "were not");
      result = result.replace(/\bdidn't\b/gi, "did not");
      result = result.replace(/\bhasn't\b/gi, "has not");
      result = result.replace(/\bhaven't\b/gi, "have not");
      result = result.replace(/\bwouldn't\b/gi, "would not");
      result = result.replace(/\bcouldn't\b/gi, "could not");
      result = result.replace(/\bshouldn't\b/gi, "should not");
      result = result.replace(/\bit's\b/gi, "it is");
      result = result.replace(/\bthat's\b/gi, "that is");
      result = result.replace(/\bthere's\b/gi, "there is");
    }

    if (profile.preferences.sentenceLengthPreference === "short") {
      const sentences = result.split(/(?<=[.!?])\s+/);
      const shortened: string[] = [];
      for (const sentence of sentences) {
        const words = sentence.split(/\s+/);
        if (words.length > 30) {
          const mid = Math.floor(words.length / 2);
          const conjunctions = ["and", "but", "however", "therefore", "moreover", "furthermore", "additionally"];
          let splitPoint = mid;
          for (let i = mid - 5; i <= mid + 5 && i < words.length; i++) {
            if (i >= 0 && conjunctions.includes(words[i]!.toLowerCase())) {
              splitPoint = i;
              break;
            }
          }
          shortened.push(words.slice(0, splitPoint).join(" "));
          shortened.push(words.slice(splitPoint).join(" "));
        } else {
          shortened.push(sentence);
        }
      }
      result = shortened.join(" ");
    }

    return result;
  }

  checkConsistency(
    content: string,
    profile: StyleProfile
  ): Array<{ issue: string; location: string; suggestion: string }> {
    const issues: Array<{ issue: string; location: string; suggestion: string }> = [];

    if (profile.preferences.avoidFirstPerson) {
      const firstPersonMatches = content.matchAll(/\b(I|we)\s+(think|believe|argue|found|discovered|propose|suggest)\b/gi);
      for (const match of firstPersonMatches) {
        issues.push({
          issue: "First person usage detected",
          location: `position ${match.index}`,
          suggestion: "Consider using impersonal construction",
        });
      }
    }

    if (profile.preferences.preferredTense === "past") {
      const presentMatches = content.matchAll(/\b(is|are)\s+(used|applied|shown|demonstrated|proposed)\b/gi);
      for (const match of presentMatches) {
        issues.push({
          issue: "Present tense detected when past tense preferred",
          location: `position ${match.index}`,
          suggestion: `Consider using past tense: "was/were ${match[2]}"`,
        });
      }
    } else if (profile.preferences.preferredTense === "present") {
      const pastMatches = content.matchAll(/\b(was|were)\s+(used|applied|shown|demonstrated|proposed)\b/gi);
      for (const match of pastMatches) {
        issues.push({
          issue: "Past tense detected when present tense preferred",
          location: `position ${match.index}`,
          suggestion: `Consider using present tense: "is/are ${match[2]}"`,
        });
      }
    }

    if (profile.preferences.formalityLevel >= 3) {
      const contractionMatches = content.matchAll(/\b\w+'\w+\b/g);
      for (const match of contractionMatches) {
        const word = match[0]!.toLowerCase();
        const formalContractions = ["can't", "don't", "doesn't", "won't", "isn't", "aren't", "wasn't", "weren't", "didn't", "hasn't", "haven't", "wouldn't", "couldn't", "shouldn't", "it's", "that's", "there's"];
        if (formalContractions.includes(word)) {
          issues.push({
            issue: "Contraction detected in formal context",
            location: `position ${match.index}`,
            suggestion: "Expand contraction to full form",
          });
        }
      }
    }

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      if (profile.preferences.sentenceLengthPreference === "short" && wordCount > 30) {
        issues.push({
          issue: "Long sentence detected (short preference)",
          location: `"${sentence.trim().slice(0, 40)}..."`,
          suggestion: "Consider splitting into shorter sentences",
        });
      }
      if (profile.preferences.sentenceLengthPreference === "long" && wordCount < 8 && wordCount > 0) {
        issues.push({
          issue: "Very short sentence detected (long preference)",
          location: `"${sentence.trim().slice(0, 40)}..."`,
          suggestion: "Consider combining with adjacent sentence",
        });
      }
    }

    return issues;
  }

  async unifyStyleEnhanced(
    text: string,
    profile: StyleProfile,
    llm: LLMCallable
  ): Promise<{ unified: string; changes: Array<{ original: string; replacement: string; reason: string }> }> {
    const basic = this.unifyStyle(text, profile);
    try {
      const person = profile.preferences.avoidFirstPerson ? "第三人称" : "第一人称";
      const tense = profile.preferences.preferredTense === "present" ? "现在时" : "过去时";
      const result = await llm.chat({
        system: `你是一位学术写作助手。将文本统一为正式学术风格（${person}，${tense}，正式度${profile.preferences.formalityLevel}/5）。
返回 JSON：{"unified": "统一后的文本", "changes": [{"original": "原文片段", "replacement": "修改后", "reason": "修改原因"}]}`,
        messages: [{ role: "user", content: text }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { unified: parsed.unified ?? basic, changes: parsed.changes ?? [] };
    } catch {
      return { unified: basic, changes: [] };
    }
  }
}
