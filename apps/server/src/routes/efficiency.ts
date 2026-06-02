import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { TermbaseManager, FragmentCollector, CrossProjectLinker, StyleUnifier, FormatConverter, ContentDeduplicator } from "@zhixu/efficiency";
import { asLLMCallable } from "../llm-adapter.js";

const termbaseStore = new Map<string, import("@zhixu/efficiency").Termbase>();
const fragmentStore = new Map<string, import("@zhixu/efficiency").FragmentNote[]>();

export async function registerEfficiencyRoutes(fastify: FastifyInstance, store: ProjectStore, gateway: ModelGateway): Promise<void> {
  const termbaseManager = new TermbaseManager();
  const fragmentCollector = new FragmentCollector();
  const crossProjectLinker = new CrossProjectLinker();
  const styleUnifier = new StyleUnifier();
  const formatConverter = new FormatConverter();
  const deduplicator = new ContentDeduplicator();
  const llm = asLLMCallable(gateway);

  fastify.post("/api/projects/:projectId/efficiency/termbase", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "create": {
        const tb = termbaseManager.createTermbase(projectId);
        termbaseStore.set(projectId, tb);
        return tb;
      }
      case "add": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return termbaseManager.addEntry(tb, { term: body.term, aliases: body.aliases ?? [], definition: body.definition ?? "", domain: body.domain ?? "", sourceProjectId: projectId });
      }
      case "lookup": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return termbaseManager.lookup(tb, body.query ?? "") ?? null;
      }
      case "unify": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return { result: termbaseManager.unifyTerms(tb, body.text ?? "") };
      }
      case "export": {
        const tb = termbaseStore.get(projectId);
        if (!tb) return reply.status(400).send({ error: "no_termbase" });
        return { csv: termbaseManager.exportTermbase(tb) };
      }
      case "extract": {
        if (!llm) return { terms: [] };
        const terms = await termbaseManager.extractTerms(body.content ?? "", llm);
        return { terms };
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/fragments", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "collect": {
        const fragment = fragmentCollector.collect({ content: body.content ?? "", source: body.source ?? "", projectId, tags: body.tags });
        const existing = fragmentStore.get(projectId) ?? [];
        existing.push(fragment);
        fragmentStore.set(projectId, existing);
        return fragment;
      }
      case "organize": {
        const existing = fragmentStore.get(projectId) ?? [];
        const organized: Record<string, any[]> = {};
        for (const [tag, frags] of fragmentCollector.organizeByTag(existing)) {
          organized[tag || "(untagged)"] = frags;
        }
        return organized;
      }
      case "link": {
        const existing = fragmentStore.get(projectId) ?? [];
        const linked = existing.map(f => fragmentCollector.linkToProject(f, projectId));
        fragmentStore.set(projectId, linked);
        return linked;
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/cross-project", async (req, reply) => {
    const body = req.body as { action: string; [key: string]: any };
    switch (body.action) {
      case "suggest": {
        if (llm && body.projects) return crossProjectLinker.suggestLinksEnhanced(body.projects, llm);
        return crossProjectLinker.suggestLinks(body.projectId ?? "", body.projects ?? []);
      }
      case "create": {
        return crossProjectLinker.createLink({ sourceProjectId: body.source ?? "", targetProjectId: body.target ?? "", linkType: body.linkType ?? "shared_knowledge", description: body.description ?? "" });
      }
      case "find-related": {
        return crossProjectLinker.findRelatedProjects(body.targetId ?? "", body.links ?? []);
      }
      default:
        return reply.status(400).send({ error: "unknown_action" });
    }
  });

  fastify.post("/api/projects/:projectId/efficiency/style-unify", async (req, reply) => {
    const body = req.body as { text: string; profile?: any };
    const profile = styleUnifier.createProfile(body.profile ?? {
      userId: "",
      academicLevel: "master",
      domain: "",
      preferences: {
        formalityLevel: 3,
        citationStyle: "APA",
        preferredTense: "present",
        avoidFirstPerson: true,
        sentenceLengthPreference: "medium",
      },
    });
    if (llm) return styleUnifier.unifyStyleEnhanced(body.text, profile, llm);
    const unified = styleUnifier.unifyStyle(body.text, profile);
    const issues = styleUnifier.checkConsistency(body.text, profile);
    return { unified, changes: [], issues };
  });

  fastify.post("/api/projects/:projectId/efficiency/deduplicate", async (req, reply) => {
    const body = req.body as { items: string[]; threshold?: number };
    return deduplicator.deduplicate(body.items, body.threshold ?? 0.8);
  });

  fastify.post("/api/projects/:projectId/efficiency/format-convert", async (req, reply) => {
    const body = req.body as { content: string; from: string; to: string };
    return formatConverter.convert({ content: body.content, sourceFormat: body.from, targetFormat: body.to });
  });
}
