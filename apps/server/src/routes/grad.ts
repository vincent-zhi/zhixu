import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import {
  SubmissionChecker,
  ReviewResponseEngine,
  ExperimentLogManager,
  GrantApplicationHelper,
  ResearchGapAnalyzer,
  CitationFixer,
  AcademicTrackerManager,
} from "@zhixu/grad";
import type { ExperimentLog, GrantApplication } from "@zhixu/grad";
import { asLLMCallable } from "../llm-adapter.js";

export async function registerGradRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const submissionChecker = new SubmissionChecker();
  const reviewEngine = new ReviewResponseEngine();
  const experimentManager = new ExperimentLogManager();
  const grantHelper = new GrantApplicationHelper();
  const gapAnalyzer = new ResearchGapAnalyzer();
  const citationFixer = new CitationFixer();
  const trackerManager = new AcademicTrackerManager();
  const llm = asLLMCallable(gateway);

  // --- Submission Check ---
  fastify.post("/api/projects/:projectId/grad/submission-check", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { venue: string; content?: string; customRequirements?: string[] };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const content = body.content ?? "";

    if (llm) {
      return submissionChecker.checkSubmissionEnhanced(content, body.venue, body.customRequirements, llm);
    }
    return submissionChecker.checkSubmission({ targetVenue: body.venue, artifactContent: content });
  });

  // --- Review Response ---
  fastify.post("/api/projects/:projectId/grad/review-response", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { rawReview: string; paperContent?: string };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "审稿意见返修需要确认",
      riskLevel: "L3",
    });

    let result;
    if (llm && body.paperContent) {
      result = await reviewEngine.createReviewResponseEnhanced(body.rawReview, body.paperContent, llm);
    } else {
      result = { ...reviewEngine.createReviewResponse(body.rawReview), aiDraftSections: [] };
    }

    return { ...result, gateId: gate.id };
  });

  // --- Experiment Log Analysis ---
  fastify.post("/api/projects/:projectId/grad/experiment-log", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { log: ExperimentLog };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "实验异常分析需要确认",
      riskLevel: "L2",
    });

    if (llm) {
      const result = await experimentManager.analyzeAnomalyEnhanced(body.log, llm);
      return { ...result, gateId: gate.id };
    }
    const result = experimentManager.analyzeAnomaly(body.log);
    return { ...result, hypotheses: [], nextSteps: [], gateId: gate.id };
  });

  // --- Grant Analysis ---
  fastify.post("/api/projects/:projectId/grad/grant-analysis", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { application: GrantApplication };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "基金申报分析需要确认",
      riskLevel: "L3",
    });

    if (llm) {
      const result = await grantHelper.analyzeGrantEnhanced(body.application, llm);
      return { ...result, gateId: gate.id };
    }
    const basic = grantHelper.analyzeGrant({ grantType: body.application.grantType, sections: body.application.sections });
    return { ...basic, aiReview: [], gateId: gate.id };
  });

  // --- Research Gaps ---
  fastify.post("/api/projects/:projectId/grad/research-gaps", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { papers: Array<{ title: string; limitations: string; futureWork: string }> };
    const project = await store.getProject(projectId);
    if (!project) return reply.status(404).send({ error: "project_not_found" });

    const gate = await store.createHumanGate(projectId, {
      gateType: "skill_invocation",
      reason: "研究空白分析需要确认",
      riskLevel: "L2",
    });

    if (llm) {
      const paperTexts = body.papers.map((p: { title: string; limitations: string; futureWork: string }) => `${p.title}: ${p.limitations} ${p.futureWork}`);
      const result = await gapAnalyzer.analyzeGapsEnhanced(paperTexts, llm);
      return { ...result, gateId: gate.id };
    }
    const gaps = gapAnalyzer.analyzeGaps(body.papers);
    return { gaps, aiDirections: [], gateId: gate.id };
  });

  // --- Citation Fix ---
  fastify.post("/api/projects/:projectId/grad/citation-fix", async (req, reply) => {
    const body = req.body as { citations: string[] };

    if (llm) {
      const results = await citationFixer.fixCitationsEnhanced(body.citations, llm);
      return { results };
    }
    const citationObjects = body.citations.map(raw => ({ raw, style: "APA" as const }));
    const formatted = citationFixer.formatCitations(citationObjects);
    const results = formatted.map((f, i) => ({
      original: body.citations[i] ?? "",
      fixed: f.formatted,
      style: "APA",
      confidence: 0.8,
    }));
    return { results };
  });

  // --- Academic Tracker ---
  fastify.post("/api/projects/:projectId/grad/academic-tracker", async (req, reply) => {
    const body = req.body as {
      keywords: string[];
      authors: string[];
      venues: string[];
      papers: Array<{ title: string; abstract: string; year: number }>;
    };

    const tracker = trackerManager.createTracker({
      keywords: body.keywords,
      authors: body.authors,
      venues: body.venues,
    });

    const digest = trackerManager.generateDigest(tracker, body.papers);
    return { digest: [digest], trends: digest.trends };
  });
}
