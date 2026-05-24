import type { ExamCrashPlan, HighFrequencyTopic, CrashDayPlan } from "./types.js";

export class ExamCrashPlanner {
  createCrashPlan(input: {
    examDate: string;
    sources: Array<{ id: string; content: string }>;
    existingMistakes?: string[];
  }): ExamCrashPlan {
    const examDate = new Date(input.examDate);
    const now = new Date();
    const daysRemaining = Math.max(1, Math.ceil(
      (examDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    ));

    const highFrequencyTopics = this.extractHighFrequencyTopics(input.sources);

    const dailyPlan: CrashDayPlan[] = [];
    const topicsPerDay = Math.max(1, Math.ceil(highFrequencyTopics.length / daysRemaining));

    for (let day = 1; day <= daysRemaining; day++) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() + day - 1);

      const startIdx = (day - 1) * topicsPerDay;
      const endIdx = Math.min(startIdx + topicsPerDay, highFrequencyTopics.length);
      const dayTopics = highFrequencyTopics
        .slice(startIdx, endIdx)
        .map((t) => t.topic);

      const activities: string[] = [];
      if (day <= daysRemaining * 0.6) {
        activities.push("Study new material");
        activities.push("Take notes on key concepts");
      } else {
        activities.push("Review and practice");
        activities.push("Solve practice problems");
      }

      if (input.existingMistakes && input.existingMistakes.length > 0) {
        activities.push("Review previous mistakes");
      }

      const estimatedMinutes = dayTopics.length > 0
        ? Math.min(480, dayTopics.length * 60 + 60)
        : 120;

      dailyPlan.push({
        day,
        date: dayDate.toISOString().split("T")[0]!,
        topics: dayTopics,
        activities,
        estimatedMinutes,
      });
    }

    let strategy: string;
    if (daysRemaining <= 3) {
      strategy = "Emergency mode: focus only on highest-frequency topics";
    } else if (daysRemaining <= 7) {
      strategy = "Intensive review: cover all high-frequency topics with practice";
    } else {
      strategy = "Structured review: systematic coverage with spaced repetition";
    }

    return {
      id: crypto.randomUUID(),
      projectId: "",
      examDate: input.examDate,
      daysRemaining,
      highFrequencyTopics,
      dailyPlan,
      strategy,
    };
  }

  extractHighFrequencyTopics(
    sources: Array<{ id: string; content: string }>,
  ): HighFrequencyTopic[] {
    const topicMap = new Map<string, { count: number; sourceIds: Set<string> }>();

    for (const source of sources) {
      const words = source.content
        .toLowerCase()
        .split(/[\s,.;:!?，。；：！？\n]+/)
        .filter((w) => w.length >= 3);

      const uniqueWords = new Set(words);
      for (const word of uniqueWords) {
        const occurrences = words.filter((w) => w === word).length;
        const existing = topicMap.get(word);
        if (existing) {
          existing.count += occurrences;
          existing.sourceIds.add(source.id);
        } else {
          topicMap.set(word, { count: occurrences, sourceIds: new Set([source.id]) });
        }
      }
    }

    const topics: HighFrequencyTopic[] = [];
    for (const [topic, data] of topicMap) {
      if (data.count >= 2 || data.sourceIds.size >= 2) {
        topics.push({
          topic,
          sourceIds: [...data.sourceIds],
          frequency: data.count,
          estimatedWeight: data.count * data.sourceIds.size,
        });
      }
    }

    return topics.sort((a, b) => b.estimatedWeight - a.estimatedWeight).slice(0, 20);
  }
}
