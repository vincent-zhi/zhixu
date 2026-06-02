import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";
import { ProjectSharingManager, SharedKnowledgebaseManager, ProgressBoardManager, ContributionTracker } from "@zhixu/collab";
import type { ProjectShare, SharedKnowledgebase, ProgressBoard } from "@zhixu/collab";

// In-memory stores (per-project)
const shareStore = new Map<string, ProjectShare[]>();
const kbStore = new Map<string, SharedKnowledgebase>();
const boardStore = new Map<string, ProgressBoard>();

export async function registerCollabRoutes(fastify: FastifyInstance, store: ProjectStore, _gateway: ModelGateway): Promise<void> {
  const sharingManager = new ProjectSharingManager();
  const kbManager = new SharedKnowledgebaseManager();
  const boardManager = new ProgressBoardManager();
  const contributionTracker = new ContributionTracker();

  // ── Project Sharing ──────────────────────────────────────────

  fastify.post("/api/projects/:projectId/collab/shares", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as {
      sharedBy: string;
      shareType: "read_only" | "comment" | "edit";
      recipientIds: string[];
      expiresAt?: string;
    };
    const share = await sharingManager.createShare({
      projectId,
      sharedBy: body.sharedBy,
      shareType: body.shareType,
      recipientIds: body.recipientIds,
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
    });
    const existing = shareStore.get(projectId) ?? [];
    existing.push(share);
    shareStore.set(projectId, existing);
    return { data: share };
  });

  fastify.get("/api/projects/:projectId/collab/shares", async (req) => {
    const { projectId } = req.params as { projectId: string };
    return { data: shareStore.get(projectId) ?? [] };
  });

  fastify.delete("/api/projects/:projectId/collab/shares/:shareId", async (req, reply) => {
    const { projectId, shareId } = req.params as { projectId: string; shareId: string };
    const revoked = await sharingManager.revokeShare(shareId);
    if (!revoked) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Share not found" } });
    const existing = shareStore.get(projectId) ?? [];
    shareStore.set(projectId, existing.filter((s) => s.id !== shareId));
    return { data: { revoked: true } };
  });

  // ── Shared Knowledge Base ────────────────────────────────────

  fastify.post("/api/projects/:projectId/collab/knowledgebase", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as {
      action: "create" | "add_entry";
      name?: string;
      accessPolicy?: "lab_only" | "course_only" | "team_only" | "public";
      entry?: {
        title: string;
        content: string;
        category: string;
        contributedBy: string;
        sensitive: boolean;
      };
    };

    if (body.action === "create") {
      const kb = kbManager.createKnowledgebase({
        workspaceId: projectId,
        name: body.name ?? "Shared Knowledge Base",
        accessPolicy: body.accessPolicy ?? "team_only",
      });
      kbStore.set(projectId, kb);
      return { data: kb };
    }

    if (body.action === "add_entry") {
      const kb = kbStore.get(projectId);
      if (!kb) return { data: { error: "no_knowledgebase" } };
      const entry = kbManager.addEntry(kb, body.entry!);
      return { data: entry };
    }

    return { data: { error: "unknown_action" } };
  });

  fastify.get("/api/projects/:projectId/collab/knowledgebase", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const kb = kbStore.get(projectId);
    if (!kb) return { data: [] };
    return { data: kb.entries };
  });

  // ── Progress Board ───────────────────────────────────────────

  fastify.get("/api/projects/:projectId/collab/progress-board", async (req) => {
    const { projectId } = req.params as { projectId: string };
    let board = boardStore.get(projectId);
    if (!board) {
      board = boardManager.createBoard(projectId);
      boardStore.set(projectId, board);
    }
    return { data: board };
  });

  fastify.post("/api/projects/:projectId/collab/progress-board", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as {
      action: "add_column" | "move_task";
      title?: string;
      taskId?: string;
      targetColumnId?: string;
    };

    let board = boardStore.get(projectId);
    if (!board) {
      board = boardManager.createBoard(projectId);
      boardStore.set(projectId, board);
    }

    if (body.action === "add_column") {
      const column = boardManager.addColumn(board, body.title ?? "New Column");
      return { data: column };
    }

    if (body.action === "move_task") {
      boardManager.moveTask(board, body.taskId ?? "", body.targetColumnId ?? "");
      return { data: board };
    }

    return reply.status(400).send({ error: { code: "INVALID_ACTION", message: "Unknown action" } });
  });

  // ── Contribution Report ──────────────────────────────────────

  fastify.get("/api/projects/:projectId/collab/contributions", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const query = req.query as {
      start?: string;
      end?: string;
      members?: string;
      activities?: string;
    };

    const period = {
      start: query.start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: query.end ?? new Date().toISOString(),
    };

    const members = query.members ? JSON.parse(query.members) : [];
    const activities = query.activities ? JSON.parse(query.activities) : [];

    const report = contributionTracker.generateReport({
      projectId,
      period,
      members,
      activities,
    });
    return { data: report };
  });
}
