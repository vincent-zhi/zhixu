import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { DefenseSimulator, SocraticCoach, MeetingBriefer, DiagnosticEngine, ProcrastinationAdapterEngine } from "@zhixu/coaching";
import { asLLMCallable } from "../llm-adapter.js";

export async function registerCoachingRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const defenseSim = new DefenseSimulator();
  const socraticCoach = new SocraticCoach();
  const meetingBriefer = new MeetingBriefer();
  const diagnosticEngine = new DiagnosticEngine();
  const procrastinationEngine = new ProcrastinationAdapterEngine();
  const llm = asLLMCallable(gateway);

  // --- Defense Simulation ---
  fastify.post("/api/projects/:projectId/coaching/defense/start", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { paperContent?: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    let questions;
    if (body.paperContent && llm) {
      questions = await defenseSim.generateQuestionsFromPaper(body.paperContent, llm);
    } else {
      questions = defenseSim.generateQuestions({
        projectTitle: project.title,
        projectType: project.type,
        content: body.paperContent ?? "",
      });
    }

    // Create HumanGate for L2 defense simulation
    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "答辩模拟需要确认",
      riskLevel: "L2",
    });

    return { questions, gateId: gate.id, source: llm ? "llm_enhanced" : "heuristic" };
  });

  fastify.post("/api/projects/:projectId/coaching/defense/answer", async (req, reply) => {
    const body = req.body as { questionId: string; question: string; expectedPoints: string[]; answer: string };
    const question = { id: body.questionId, category: "methodology" as const, question: body.question, expectedPoints: body.expectedPoints, difficulty: 0.5 };
    if (llm) {
      const result = await defenseSim.evaluateAnswerWithRubric(question, body.answer, llm);
      return result;
    }
    return defenseSim.evaluateAnswer(question, body.answer);
  });

  // --- Socratic Coach ---
  fastify.post("/api/projects/:projectId/coaching/socratic", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { topic: string; depth?: number; conversationHistory?: string[] };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    if (body.conversationHistory && body.conversationHistory.length > 0 && llm) {
      return socraticCoach.generateContextualQuestionsEnhanced(body.conversationHistory, { title: project.title, type: project.type, sources: [] }, llm);
    }
    return socraticCoach.generateQuestions(body.topic, body.depth ?? 2);
  });

  // --- Meeting Brief ---
  fastify.post("/api/projects/:projectId/coaching/meeting-brief", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const recentProgress = project.tasks.filter((t: any) => t.status === "completed").map((t: any) => t.title);
    const upcomingDeadlines = project.tasks.filter((t: any) => t.dueAt && t.status !== "completed").map((t: any) => `${t.title}: ${t.dueAt}`);

    if (llm) {
      return meetingBriefer.generateProjectBrief({
        projectTitle: project.title, projectType: project.type,
        recentProgress, upcomingDeadlines,
        sourceCount: project.sources.length, taskCount: project.tasks.length, llm,
      });
    }
    return meetingBriefer.generateBrief({
      projectId,
      meetingType: "group_meeting",
      recentProgress,
      upcomingDeadlines,
    });
  });

  // --- Diagnostic ---
  fastify.post("/api/projects/:projectId/coaching/diagnostic", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const tasks = project.tasks.map((t: any) => ({
      id: t.id, projectId, title: t.title, status: t.status,
      assigneeType: "user" as const, responsibilityLabel: "user_responsible" as const,
      priority: 1, riskLevel: "L0" as const,
      ...(t.dueAt ? { dueAt: new Date(t.dueAt) } : {}),
    }));

    if (llm) {
      return diagnosticEngine.generateInsightReportEnhanced({
        title: project.title,
        type: project.type,
        tasks: project.tasks.map((t: any) => ({ status: t.status, title: t.title })),
        artifacts: [],
      }, llm);
    }
    return diagnosticEngine.generateReport({
      projectId,
      period: { start: "", end: "" },
      tasks: tasks.map((t: any) => ({
        status: t.status,
        dueAt: t.dueAt ? String(t.dueAt) : null,
        completedAt: t.completedAt ? String(t.completedAt) : null,
      })),
      artifacts: [],
    });
  });

  // --- Procrastination ---
  fastify.post("/api/projects/:projectId/coaching/procrastination", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { delayDays: number; taskTitle?: string };
    const taskTitle = body.taskTitle ?? "current task";
    const analysis = procrastinationEngine.analyze({
      projectId,
      currentDelay: body.delayDays,
      taskTitle,
    });
    const microTasks = procrastinationEngine.generateMicroTasks(taskTitle, body.delayDays);
    return { ...analysis, microTasks };
  });
}
