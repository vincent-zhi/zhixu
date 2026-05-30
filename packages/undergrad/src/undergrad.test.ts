import { describe, expect, it } from "vitest";
import { SemesterPlanner } from "./semester-planner.js";
import { GroupDivider } from "./group-divider.js";
import { ClassNotesProcessor } from "./class-notes-processor.js";
import { SelfChecker } from "./self-checker.js";
import { ExamCrashPlanner } from "./exam-crash.js";
import { PPTBeautifier } from "./ppt-beautifier.js";
import type { CourseEntry, ExamEntry, AssignmentEntry, GroupMember, LLMCallable } from "./types.js";

describe("SemesterPlanner", () => {
  const planner = new SemesterPlanner();

  const courses: CourseEntry[] = [
    { id: "c1", name: "Math", credits: 4, assessmentType: "exam", difficulty: 8, priorityWeight: 0.4 },
    { id: "c2", name: "English", credits: 3, assessmentType: "exam", difficulty: 5, priorityWeight: 0.3 },
  ];

  const exams: ExamEntry[] = [
    { id: "e1", courseId: "c1", examDate: "2025-06-15", examType: "final", weight: 0.6 },
    { id: "e2", courseId: "c2", examDate: "2025-06-20", examType: "final", weight: 0.5 },
  ];

  const assignments: AssignmentEntry[] = [
    { id: "a1", courseId: "c1", title: "Problem Set 1", dueDate: "2025-04-01", weight: 0.1, type: "homework" },
  ];

  it("creates a semester plan", () => {
    const plan = planner.createPlan({
      semesterName: "Spring 2025",
      startDate: "2025-02-01",
      endDate: "2025-06-30",
      courses,
      exams,
      assignments,
    });

    expect(plan.id).toBeTruthy();
    expect(plan.semesterName).toBe("Spring 2025");
    expect(plan.courses).toHaveLength(2);
    expect(plan.examSchedule).toHaveLength(2);
    expect(plan.weeklyPlan.length).toBeGreaterThan(0);
    expect(plan.overallStrategy).toBeTruthy();
  });

  it("generates weekly plans with focus courses", () => {
    const plan = planner.createPlan({
      semesterName: "Spring 2025",
      startDate: "2025-02-01",
      endDate: "2025-06-30",
      courses,
      exams,
      assignments,
    });

    for (const week of plan.weeklyPlan) {
      expect(week.focusCourses.length).toBeGreaterThan(0);
    }
  });

  it("adjusts for exam week", () => {
    const plan = planner.createPlan({
      semesterName: "Spring 2025",
      startDate: "2025-02-01",
      endDate: "2025-06-30",
      courses,
      exams,
      assignments,
    });

    const adjusted = planner.adjustForExamWeek(plan, 10);
    const examWeekPlan = adjusted.weeklyPlan.find((w) => w.week === 10);
    expect(examWeekPlan!.reviewSessions.length).toBeGreaterThan(0);
  });
});

describe("GroupDivider", () => {
  const divider = new GroupDivider();

  const members: GroupMember[] = [
    { id: "m1", name: "Alice", role: "leader", strengths: ["coding"], assignedWeight: 0.4 },
    { id: "m2", name: "Bob", role: "member", strengths: ["writing"], assignedWeight: 0.3 },
    { id: "m3", name: "Carol", role: "member", strengths: ["design"], assignedWeight: 0.3 },
  ];

  it("divides a task among members", () => {
    const division = divider.divideTask({
      taskTitle: "Final Project",
      members,
      totalDifficulty: 9,
      deadline: "2025-06-01",
    });

    expect(division.id).toBeTruthy();
    expect(division.taskTitle).toBe("Final Project");
    expect(division.members).toHaveLength(3);
    expect(division.assignments).toHaveLength(3);
  });

  it("assigns more tasks to members with higher weight", () => {
    const division = divider.divideTask({
      taskTitle: "Project",
      members,
      totalDifficulty: 9,
      deadline: "2025-06-01",
    });

    const leaderAssignment = division.assignments.find((a) => a.memberId === "m1")!;
    const memberAssignment = division.assignments.find((a) => a.memberId === "m2")!;
    expect(leaderAssignment.difficulty).toBeGreaterThanOrEqual(memberAssignment.difficulty);
  });

  it("generates contribution report", () => {
    const division = divider.divideTask({
      taskTitle: "Project",
      members,
      totalDifficulty: 9,
      deadline: "2025-06-01",
    });

    const completedTasks = new Map<string, { hours: number; quality: number }>();
    completedTasks.set("m1", { hours: 10, quality: 0.9 });
    completedTasks.set("m2", { hours: 6, quality: 0.7 });
    completedTasks.set("m3", { hours: 8, quality: 0.8 });

    const report = divider.generateContributionReport(division, completedTasks);
    expect(report).toHaveLength(3);

    const totalPercent = report.reduce((sum, e) => sum + e.contributionPercent, 0);
    expect(totalPercent).toBeGreaterThan(0);
  });
});

describe("ClassNotesProcessor", () => {
  const processor = new ClassNotesProcessor();

  it("processes a transcript and extracts key points", () => {
    const transcript = "Today we cover the key concept of recursion. Remember that recursion needs a base case. Homework is due Friday. The exam will cover chapters 3-5.";
    const notes = processor.processTranscript(transcript, "CS101", "2025-04-01");

    expect(notes.id).toBeTruthy();
    expect(notes.courseName).toBe("CS101");
    expect(notes.date).toBe("2025-04-01");
    expect(notes.keyPoints.length).toBeGreaterThan(0);
    expect(notes.homeworkMentions.length).toBeGreaterThan(0);
    expect(notes.examHints.length).toBeGreaterThan(0);
  });

  it("extracts action items from notes", () => {
    const transcript = "重点：数据结构。作业：周五交。考试重点：第三章。";
    const notes = processor.processTranscript(transcript, "CS101", "2025-04-01");
    const actions = processor.extractActionItems(notes);

    expect(actions.length).toBeGreaterThan(0);
  });

  it("handles empty transcript", () => {
    const notes = processor.processTranscript("", "CS101", "2025-04-01");
    expect(notes.keyPoints).toEqual([]);
    expect(notes.homeworkMentions).toEqual([]);
    expect(notes.examHints).toEqual([]);
  });
});

describe("SelfChecker", () => {
  const checker = new SelfChecker();

  it("checks word count against requirements", () => {
    const result = checker.checkArtifact({
      content: "Short text",
      requirements: { minWords: 100 },
    });

    expect(result.wordCount).toBe(2);
    const wordCountIssues = result.issues.filter((i) => i.type === "word_count");
    expect(wordCountIssues.length).toBeGreaterThan(0);
  });

  it("checks for required sections", () => {
    const content = "Introduction\n\nThis is the intro.\n\nMethodology\n\nWe used surveys.";
    const result = checker.checkArtifact({
      content,
      requirements: { requiredSections: ["Introduction", "Methodology", "Conclusion"] },
    });

    const structureIssues = result.issues.filter((i) => i.type === "structure");
    expect(structureIssues.length).toBeGreaterThan(0);
    expect(structureIssues.some((i) => i.message.includes("Conclusion"))).toBe(true);
  });

  it("detects colloquial language", () => {
    const result = checker.checkArtifact({
      content: "Basically, the results kinda show that the thing works. You know, it's like really good.",
      requirements: {},
    });

    expect(result.formalityScore).toBeLessThan(100);
    const formalityIssues = result.issues.filter((i) => i.type === "formality");
    expect(formalityIssues.length).toBeGreaterThan(0);
  });

  it("detects potential contradictions", () => {
    const result = checker.checkArtifact({
      content: "The results demonstrate a significant improvement in performance. However, the data also contradict this finding entirely.",
      requirements: {},
    });

    const logicIssues = result.issues.filter((i) => i.type === "logic");
    expect(logicIssues.length).toBeGreaterThan(0);
  });

  it("produces an overall score", () => {
    const result = checker.checkArtifact({
      content: "A well-structured academic paper with proper citations [1] and formal language throughout the document.",
      requirements: { minWords: 5, requiredSections: [] },
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});

describe("ExamCrashPlanner", () => {
  const crashPlanner = new ExamCrashPlanner();

  it("creates a crash plan", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const examDate = futureDate.toISOString().split("T")[0]!;

    const plan = crashPlanner.createCrashPlan({
      examDate,
      sources: [
        { id: "s1", content: "Recursion is important. Recursion appears frequently. Base cases are key." },
        { id: "s2", content: "Sorting algorithms. Recursion is used in merge sort." },
      ],
    });

    expect(plan.id).toBeTruthy();
    expect(plan.daysRemaining).toBeGreaterThan(0);
    expect(plan.dailyPlan.length).toBeGreaterThan(0);
    expect(plan.strategy).toBeTruthy();
  });

  it("extracts high frequency topics", () => {
    const topics = crashPlanner.extractHighFrequencyTopics([
      { id: "s1", content: "Recursion is important. Recursion is key. Recursion appears often." },
      { id: "s2", content: "Recursion in practice. Arrays are useful." },
    ]);

    expect(topics.length).toBeGreaterThan(0);
    const recursionTopic = topics.find((t) => t.topic.includes("recursion"));
    expect(recursionTopic).toBeTruthy();
    expect(recursionTopic!.frequency).toBeGreaterThan(1);
  });

  it("handles existing mistakes in plan", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const examDate = futureDate.toISOString().split("T")[0]!;

    const plan = crashPlanner.createCrashPlan({
      examDate,
      sources: [{ id: "s1", content: "Topic A. Topic A again." }],
      existingMistakes: ["Mistake 1", "Mistake 2"],
    });

    const hasMistakeReview = plan.dailyPlan.some((d) =>
      d.activities.some((a) => a.includes("mistakes")),
    );
    expect(hasMistakeReview).toBe(true);
  });
});

describe("PPTBeautifier", () => {
  const beautifier = new PPTBeautifier();

  it("detects text overload", () => {
    const slides = [
      {
        index: 1,
        title: "Introduction",
        content: "A".repeat(150),
        wordCount: 150,
      },
    ];

    const issues = beautifier.analyze(slides);
    const overloadIssues = issues.filter((i) => i.type === "text_overload");
    expect(overloadIssues.length).toBeGreaterThan(0);
  });

  it("detects missing visuals on sparse slides", () => {
    const slides = [
      { index: 1, title: "Title", content: "Hi", wordCount: 1 },
    ];

    const issues = beautifier.analyze(slides);
    const visualIssues = issues.filter((i) => i.type === "missing_visual");
    expect(visualIssues.length).toBeGreaterThan(0);
  });

  it("beautifies slides and returns result", () => {
    const slides = [
      { index: 1, title: "Introduction", content: "Welcome", wordCount: 1 },
      { index: 2, title: "Content", content: "A ".repeat(120).trim(), wordCount: 120 },
    ];

    const result = beautifier.beautify("artifact-1", slides);
    expect(result.id).toBeTruthy();
    expect(result.artifactId).toBe("artifact-1");
    expect(result.beforeScore).toBeGreaterThanOrEqual(0);
    expect(result.afterScore).toBeGreaterThanOrEqual(result.beforeScore);
  });

  it("returns no issues for clean slides", () => {
    const slides = [
      { index: 1, title: "Introduction", content: "Brief intro content here", wordCount: 4 },
    ];

    const issues = beautifier.analyze(slides);
    expect(issues.filter((i) => i.type === "text_overload")).toHaveLength(0);
  });
});

// --- LLM-Enhanced Method Tests ---

const mockLLM: LLMCallable = {
  async chat() {
    return {
      content: JSON.stringify({
        strategy: "Focus on high-credit courses first",
        tips: ["Week 1: Review fundamentals", "Week 2: Start assignments early"],
        summary: "Course covered recursion and sorting",
        examHints: ["Know the difference between merge sort and quicksort"],
        keyConcepts: ["Recursion", "Base case", "Divide and conquer"],
        feedback: [{ section: "Introduction", issue: "Too brief", suggestion: "Expand the intro" }],
        topics: [
          { term: "Recursion", frequency: 5, weight: 0.8, relatedTopics: ["Base case"] },
        ],
      }),
    };
  },
};

describe("SemesterPlanner LLM enhanced", () => {
  it("createPlanEnhanced returns LLM strategy", async () => {
    const planner = new SemesterPlanner();
    const courses: CourseEntry[] = [
      { id: "c1", name: "Math", credits: 4, assessmentType: "exam", difficulty: 8, priorityWeight: 0.4 },
    ];
    const result = await planner.createPlanEnhanced(courses, "2025-02-01", "2025-06-30", mockLLM);
    expect(result.aiStrategy).toBeTruthy();
    expect(result.aiTips.length).toBeGreaterThan(0);
    expect(result.id).toBeTruthy();
  });

  it("createPlanEnhanced falls back on LLM error", async () => {
    const planner = new SemesterPlanner();
    const courses: CourseEntry[] = [
      { id: "c1", name: "Math", credits: 4, assessmentType: "exam", difficulty: 8, priorityWeight: 0.4 },
    ];
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await planner.createPlanEnhanced(courses, "2025-02-01", "2025-06-30", badLLM);
    expect(result.aiStrategy).toBe("");
    expect(result.aiTips).toEqual([]);
    expect(result.id).toBeTruthy();
  });
});

describe("ClassNotesProcessor LLM enhanced", () => {
  it("processTranscriptEnhanced returns LLM summary and concepts", async () => {
    const processor = new ClassNotesProcessor();
    const result = await processor.processTranscriptEnhanced(
      "Today we cover recursion. Remember that recursion needs a base case.",
      { name: "CS101", type: "lecture", topics: ["recursion", "sorting"] },
      mockLLM,
    );
    expect(result.aiSummary).toBeTruthy();
    expect(result.keyConcepts.length).toBeGreaterThan(0);
    expect(result.examHints.length).toBeGreaterThan(0);
  });

  it("processTranscriptEnhanced falls back on LLM error", async () => {
    const processor = new ClassNotesProcessor();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await processor.processTranscriptEnhanced(
      "今天我们学习了递归算法的基本概念。重点理解递归的基本原理。作业是完成第三章的练习题。",
      { name: "CS101", type: "lecture", topics: ["recursion"] },
      badLLM,
    );
    expect(result.aiSummary).toBe("");
    expect(result.keyConcepts).toEqual([]);
    expect(result.keyPoints.length).toBeGreaterThan(0);
  });
});

describe("SelfChecker LLM enhanced", () => {
  it("checkArtifactEnhanced returns LLM feedback", async () => {
    const checker = new SelfChecker();
    const result = await checker.checkArtifactEnhanced(
      "This is a test document with enough words to check.",
      { minWords: 5 },
      mockLLM,
    );
    expect(result.aiFeedback.length).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("checkArtifactEnhanced falls back on LLM error", async () => {
    const checker = new SelfChecker();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await checker.checkArtifactEnhanced("Test content.", {}, badLLM);
    expect(result.aiFeedback).toEqual([]);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});

describe("ExamCrashPlanner LLM enhanced", () => {
  it("extractTopicsEnhanced returns LLM topics", async () => {
    const planner = new ExamCrashPlanner();
    const result = await planner.extractTopicsEnhanced(
      ["Recursion is important. Sorting algorithms are key."],
      ["Past exam: What is recursion?"],
      mockLLM,
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.topic).toBeTruthy();
  });

  it("extractTopicsEnhanced falls back on LLM error", async () => {
    const planner = new ExamCrashPlanner();
    const badLLM: LLMCallable = { async chat() { throw new Error("fail"); } };
    const result = await planner.extractTopicsEnhanced(
      ["Recursion is important. Recursion is key."],
      [],
      badLLM,
    );
    expect(result.length).toBeGreaterThan(0);
  });
});
