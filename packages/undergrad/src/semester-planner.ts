import type { SemesterPlan, CourseEntry, ExamEntry, AssignmentEntry, WeeklyPlan, LLMCallable } from "./types.js";

export class SemesterPlanner {
  createPlan(input: {
    semesterName: string;
    startDate: string;
    endDate: string;
    courses: CourseEntry[];
    exams: ExamEntry[];
    assignments: AssignmentEntry[];
  }): SemesterPlan {
    const weeklyPlan = this.generateWeeklyPlan({
      id: crypto.randomUUID(),
      projectId: "",
      semesterName: input.semesterName,
      startDate: input.startDate,
      endDate: input.endDate,
      courses: input.courses,
      examSchedule: input.exams,
      assignmentDeadlines: input.assignments,
      weeklyPlan: [],
      overallStrategy: "",
    });

    const totalCredits = input.courses.reduce((sum, c) => sum + c.credits, 0);
    const avgDifficulty = input.courses.length > 0
      ? input.courses.reduce((sum, c) => sum + c.difficulty, 0) / input.courses.length
      : 0;

    let overallStrategy: string;
    if (avgDifficulty > 7) {
      overallStrategy = "Heavy workload semester: prioritize core courses, start early on projects";
    } else if (avgDifficulty > 4) {
      overallStrategy = "Moderate workload: balance across courses with focused exam prep";
    } else {
      overallStrategy = "Manageable workload: aim for depth in key subjects";
    }

    return {
      id: crypto.randomUUID(),
      projectId: "",
      semesterName: input.semesterName,
      startDate: input.startDate,
      endDate: input.endDate,
      courses: input.courses,
      examSchedule: input.exams,
      assignmentDeadlines: input.assignments,
      weeklyPlan,
      overallStrategy,
    };
  }

  generateWeeklyPlan(plan: SemesterPlan): WeeklyPlan[] {
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const weekCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const weeklyPlans: WeeklyPlan[] = [];

    for (let week = 1; week <= weekCount; week++) {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

      const focusCourses: string[] = [];
      const tasks: string[] = [];
      const reviewSessions: string[] = [];

      for (const course of plan.courses) {
        focusCourses.push(course.id);

        const courseExams = plan.examSchedule.filter(
          (e) => e.courseId === course.id,
        );
        for (const exam of courseExams) {
          const examDate = new Date(exam.examDate);
          const daysToExam = Math.ceil(
            (examDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (daysToExam > 0 && daysToExam <= 14) {
            reviewSessions.push(`Review for ${exam.examType} (${course.name})`);
          }
        }

        const courseAssignments = plan.assignmentDeadlines.filter(
          (a) => a.courseId === course.id,
        );
        for (const assignment of courseAssignments) {
          const dueDate = new Date(assignment.dueDate);
          const daysToDue = Math.ceil(
            (dueDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (daysToDue > 0 && daysToDue <= 7) {
            tasks.push(`Submit: ${assignment.title} (${course.name})`);
          }
        }
      }

      weeklyPlans.push({
        week,
        startDate: weekStart.toISOString().split("T")[0]!,
        focusCourses,
        tasks,
        reviewSessions,
      });
    }

    return weeklyPlans;
  }

  adjustForExamWeek(plan: SemesterPlan, examWeek: number): SemesterPlan {
    const adjusted = { ...plan, weeklyPlan: [...plan.weeklyPlan] };

    for (let i = 0; i < adjusted.weeklyPlan.length; i++) {
      const wp = { ...adjusted.weeklyPlan[i]! };
      if (wp.week >= examWeek - 1 && wp.week <= examWeek + 1) {
        wp.reviewSessions = [
          ...wp.reviewSessions,
          ...wp.focusCourses.map((cId) => {
            const course = plan.courses.find((c) => c.id === cId);
            return `Intensive review: ${course?.name ?? cId}`;
          }),
        ];
      }
      adjusted.weeklyPlan[i] = wp;
    }

    return adjusted;
  }

  async createPlanEnhanced(
    courses: CourseEntry[],
    semesterStart: string,
    semesterEnd: string,
    llm: LLMCallable
  ): Promise<SemesterPlan & { aiStrategy: string; aiTips: string[] }> {
    const basic = this.createPlan({
      semesterName: "Semester",
      startDate: semesterStart,
      endDate: semesterEnd,
      courses,
      exams: [],
      assignments: [],
    });
    try {
      const result = await llm.chat({
        system: `你是一位大学学业规划助手。根据课程信息生成个性化学期学习策略。
返回 JSON：{"strategy": "总体策略描述", "tips": ["第1周建议：...", "第2周建议：...", ...]}`,
        messages: [{ role: "user", content: `课程列表：\n${courses.map(c => `${c.name}（${c.credits}学分，难度${c.difficulty}/5，考核：${c.assessmentType}）`).join("\n")}\n学期：${semesterStart} ~ ${semesterEnd}` }],
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(result.content);
      return { ...basic, aiStrategy: parsed.strategy ?? "", aiTips: parsed.tips ?? [] };
    } catch {
      return { ...basic, aiStrategy: "", aiTips: [] };
    }
  }
}
