import type { KnowledgeGraph, ReviewPlan, DailyTask, StudyActivity } from "./types.js";

export class ReviewPlanner {
  createPlan(input: {
    projectId: string;
    examDate: string;
    knowledgeGraph: KnowledgeGraph;
    dailyMinutes?: number;
  }): ReviewPlan {
    const dailyMinutes = input.dailyMinutes ?? 120;
    const examDateObj = new Date(input.examDate);
    const today = new Date();
    const diffMs = examDateObj.getTime() - today.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const sortedNodes = [...input.knowledgeGraph.nodes]
      .filter((n) => n.type !== "mistake")
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    const activityTypes: Array<StudyActivity["type"]> = [
      "read",
      "practice",
      "review_mistakes",
      "flashcard",
      "quiz",
      "summarize",
    ];

    const dailyTasks: DailyTask[] = [];

    for (let day = 1; day <= totalDays; day++) {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() + day - 1);
      const dateStr = dayDate.toISOString().split("T")[0]!;

      const nodeStart = ((day - 1) * 2) % sortedNodes.length;
      const dayNodes = [
        sortedNodes[nodeStart],
        sortedNodes[(nodeStart + 1) % sortedNodes.length],
      ].filter((n): n is typeof sortedNodes[number] => n !== undefined);

      const topics = dayNodes.map((n) => n.label);
      const nodeIds = dayNodes.map((n) => n.id);

      const activities: StudyActivity[] = dayNodes.map((node, i) => {
        const actType = activityTypes[(day - 1 + i) % activityTypes.length]!;
        return {
          id: crypto.randomUUID(),
          type: actType,
          title: `${actType}: ${node!.label}`,
          content: node!.content,
          nodeIds: [node!.id],
          duration: Math.floor(dailyMinutes / dayNodes.length),
          completed: false,
        };
      });

      if (day % 3 === 0) {
        const mistakeNodes = input.knowledgeGraph.nodes.filter((n) => n.type === "mistake");
        if (mistakeNodes.length > 0) {
          activities.push({
            id: crypto.randomUUID(),
            type: "review_mistakes",
            title: `Review mistakes: ${mistakeNodes.map((m) => m.label).join(", ")}`,
            content: mistakeNodes.map((m) => m.content).join("; "),
            nodeIds: mistakeNodes.map((m) => m.id),
            duration: Math.floor(dailyMinutes * 0.2),
            completed: false,
          });
        }
      }

      dailyTasks.push({
        day,
        date: dateStr,
        topics,
        nodeIds,
        activities,
        estimatedMinutes: activities.reduce((sum, a) => sum + a.duration, 0),
        completed: false,
      });
    }

    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      examDate: input.examDate,
      totalDays,
      dailyTasks,
      knowledgeGraph: input.knowledgeGraph,
      progress: 0,
    };
  }

  updateProgress(plan: ReviewPlan, day: number, completedActivities: string[]): ReviewPlan {
    const task = plan.dailyTasks.find((t) => t.day === day);
    if (!task) return plan;

    for (const activity of task.activities) {
      if (completedActivities.includes(activity.id)) {
        activity.completed = true;
      }
    }

    const allCompleted = task.activities.every((a) => a.completed);
    if (allCompleted) {
      task.completed = true;
    }

    const completedDays = plan.dailyTasks.filter((t) => t.completed).length;
    plan.progress = completedDays / plan.dailyTasks.length;

    return plan;
  }

  adjustPlan(plan: ReviewPlan, performance: Map<string, number>): ReviewPlan {
    const sortedNodes = [...plan.knowledgeGraph.nodes]
      .filter((n) => n.type !== "mistake")
      .sort((a, b) => {
        const perfA = performance.get(a.id) ?? a.masteryLevel;
        const perfB = performance.get(b.id) ?? b.masteryLevel;
        return perfA - perfB;
      });

    for (const node of sortedNodes) {
      const perf = performance.get(node.id);
      if (perf !== undefined) {
        node.masteryLevel = perf;
      }
    }

    for (const task of plan.dailyTasks) {
      if (task.completed) continue;

      const nodeStart = ((task.day - 1) * 2) % sortedNodes.length;
      const dayNodes = [
        sortedNodes[nodeStart],
        sortedNodes[(nodeStart + 1) % sortedNodes.length],
      ].filter((n): n is typeof sortedNodes[number] => n !== undefined);

      task.topics = dayNodes.map((n) => n.label);
      task.nodeIds = dayNodes.map((n) => n.id);

      for (const activity of task.activities) {
        if (!activity.completed) {
          const node = dayNodes.find((n) => activity.nodeIds.includes(n.id));
          if (node) {
            activity.title = `${activity.type}: ${node.label}`;
            activity.content = node.content;
            activity.nodeIds = [node.id];
          }
        }
      }
    }

    return plan;
  }
}
