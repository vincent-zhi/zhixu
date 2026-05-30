import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { SemesterPlanner, ClassNotesProcessor, SelfChecker, ExamCrashPlanner, PPTBeautifier, GroupDivider } from "@zhixu/undergrad";
import type { LLMCallable } from "@zhixu/undergrad";

function asLLMCallable(gateway: ModelGateway): LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(params) {
      const result = await gateway.chatWithTools!({
        messages: [{ role: "system", content: params.system }, ...params.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))],
        systemPrompt: params.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}

export async function registerUndergradRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const semesterPlanner = new SemesterPlanner();
  const notesProcessor = new ClassNotesProcessor();
  const selfChecker = new SelfChecker();
  const examPlanner = new ExamCrashPlanner();
  const pptBeautifier = new PPTBeautifier();
  const groupDivider = new GroupDivider();
  const llm = asLLMCallable(gateway);

  fastify.post("/api/projects/:projectId/undergrad/semester-plan", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { courses: any[]; semesterStart: string; semesterEnd: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });
    if (llm) return semesterPlanner.createPlanEnhanced(body.courses, body.semesterStart, body.semesterEnd, llm);
    return semesterPlanner.createPlan({
      semesterName: "Semester",
      startDate: body.semesterStart,
      endDate: body.semesterEnd,
      courses: body.courses,
      exams: [],
      assignments: [],
    });
  });

  fastify.post("/api/projects/:projectId/undergrad/class-notes", async (req, reply) => {
    const body = req.body as { rawTranscript: string; courseInfo?: { name: string; type: string; topics: string[] } };
    if (body.courseInfo && llm) return notesProcessor.processTranscriptEnhanced(body.rawTranscript, body.courseInfo, llm);
    const notes = notesProcessor.processTranscript(body.rawTranscript, body.courseInfo?.name ?? "Unknown", new Date().toISOString().split("T")[0]!);
    return { ...notes, actionItems: notesProcessor.extractActionItems(notes) };
  });

  fastify.post("/api/projects/:projectId/undergrad/self-check", async (req, reply) => {
    const body = req.body as { content: string; options?: { minWords?: number; maxWords?: number; requiredSections?: string[] } };
    if (llm) return selfChecker.checkArtifactEnhanced(body.content, body.options ?? {}, llm);
    return selfChecker.checkArtifact({ content: body.content, requirements: body.options ?? {} });
  });

  fastify.post("/api/projects/:projectId/undergrad/exam-crash", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { sources: string[]; pastExams?: string[]; examDate: string; dailyHours: number };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, { gateType: "skill_invocation", reason: "期末速成计划生成需确认", riskLevel: "L2" });
    let topics;
    if (body.pastExams && llm) { topics = await examPlanner.extractTopicsEnhanced(body.sources, body.pastExams, llm); }
    else { topics = examPlanner.extractHighFrequencyTopics(body.sources.map((content, i) => ({ id: `source-${i}`, content }))); }
    const plan = examPlanner.createCrashPlan({
      examDate: body.examDate,
      sources: body.sources.map((content, i) => ({ id: `source-${i}`, content })),
    });
    return { ...plan, gateId: gate.id };
  });

  fastify.post("/api/projects/:projectId/undergrad/ppt-beautify", async (req, reply) => {
    const body = req.body as { slides: string[] };
    const slideObjects = body.slides.map((content, i) => ({
      index: i,
      title: "",
      content,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
    }));
    return pptBeautifier.beautify("", slideObjects);
  });

  fastify.post("/api/projects/:projectId/undergrad/group-divide", async (req, reply) => {
    const body = req.body as { members: any[]; taskDescriptions: string[]; totalHours: number };
    const members = body.members.map((m, i) => ({
      id: m.id ?? `member-${i}`,
      name: m.name ?? `Member ${i + 1}`,
      role: m.role ?? "member",
      strengths: m.strengths ?? [],
      assignedWeight: m.weight ?? 1,
    }));
    const division = groupDivider.divideTask({
      taskTitle: body.taskDescriptions.join(", "),
      members,
      totalDifficulty: body.totalHours,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
    });
    return division;
  });
}
