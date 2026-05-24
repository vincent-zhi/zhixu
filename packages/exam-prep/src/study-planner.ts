import type { CourseKnowledgeGraph, StudyPlan } from "./types.js";

export class StudyPlanner {
  generatePlan(projectId: string, graph: CourseKnowledgeGraph, examDate: string, dailyMinutes: number): StudyPlan {
    const examDateObj = new Date(examDate);
    const today = new Date();
    const diffMs = examDateObj.getTime() - today.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const sortedNodes = [...graph.nodes]
      .filter(n => n.type !== "mistake")
      .sort((a, b) => a.mastery - b.mastery);

    const taskTypes: Array<"review" | "practice" | "self_test" | "review_mistakes"> = ["review", "practice", "self_test", "review_mistakes"];

    const dailyTasks: StudyPlan["dailyTasks"] = [];

    for (let day = 1; day <= totalDays; day++) {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() + day - 1);
      const dateStr = dayDate.toISOString().split("T")[0];

      const nodeStart = ((day - 1) * 2) % sortedNodes.length;
      const dayNodes = [
        sortedNodes[nodeStart],
        sortedNodes[(nodeStart + 1) % sortedNodes.length]
      ].filter(Boolean);

      const topics = dayNodes.map(n => n.label);
      const tasks = dayNodes.map((node, i) => ({
        type: taskTypes[(day - 1 + i) % taskTypes.length],
        nodeId: node.id,
        description: `${taskTypes[(day - 1 + i) % taskTypes.length]}: ${node.label}`,
        estimatedMinutes: Math.floor(dailyMinutes / dayNodes.length)
      }));

      if (day % 3 === 0) {
        const mistakeNodes = graph.nodes.filter(n => n.type === "mistake");
        if (mistakeNodes.length > 0) {
          tasks.push({
            type: "review_mistakes",
            nodeId: mistakeNodes[0].id,
            description: `Review mistakes: ${mistakeNodes.map(m => m.label).join(", ")}`,
            estimatedMinutes: Math.floor(dailyMinutes * 0.2)
          });
        }
      }

      dailyTasks.push({
        day,
        date: dateStr,
        topics,
        tasks
      });
    }

    return {
      id: `plan-${projectId}-${Date.now()}`,
      projectId,
      examDate,
      totalDays,
      dailyTasks
    };
  }
}
