import type { FeedbackItem, MentorPreference } from "./types.js";

const PREFERENCE_CATEGORIES: Record<string, string> = {
  "格式": "formatting",
  "引用": "citation",
  "数据": "data",
  "逻辑": "logic",
  "表达": "expression"
};

const PREFERENCE_LABELS: Record<string, string> = {
  "格式": "格式规范",
  "引用": "引用规范",
  "数据": "数据准确性",
  "逻辑": "逻辑严谨性",
  "表达": "表达清晰性"
};

export class PreferenceTracker {
  private store: Map<string, MentorPreference> = new Map();

  extractPreferences(feedback: FeedbackItem): MentorPreference {
    const mentorId = feedback.mentorId ?? "anonymous";
    const existing = this.store.get(mentorId);
    const now = new Date().toISOString();

    const currentPrefs = new Map<string, { category: string; preference: string; frequency: number; lastSeenAt: string }>();

    if (existing) {
      for (const p of existing.preferences) {
        currentPrefs.set(p.category, { ...p });
      }
    }

    for (const [keyword, category] of Object.entries(PREFERENCE_CATEGORIES)) {
      if (feedback.rawContent.includes(keyword)) {
        const label = PREFERENCE_LABELS[keyword] ?? keyword;
        const current = currentPrefs.get(category);
        if (current) {
          current.frequency += 1;
          current.lastSeenAt = now;
        } else {
          currentPrefs.set(category, {
            category,
            preference: label,
            frequency: 1,
            lastSeenAt: now
          });
        }
      }
    }

    const preference: MentorPreference = {
      mentorId,
      preferences: Array.from(currentPrefs.values())
    };

    this.store.set(mentorId, preference);
    return preference;
  }

  getPreferences(mentorId: string): MentorPreference {
    return this.store.get(mentorId) ?? { mentorId, preferences: [] };
  }
}
