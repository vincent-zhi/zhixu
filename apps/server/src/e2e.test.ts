import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServerApp } from "./app.js";

describe("E2E API Integration", () => {
  let app: FastifyInstance;
  let projectId: string;
  let sourceId: string;
  let taskId: string;
  let artifactId: string;
  let blockId: string;
  let gateId: string;
  let versionId: string;
  let feedbackId: string;
  let capsuleId: string;
  let evidenceId: string;

  beforeAll(async () => {
    app = await createServerApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Health & Readiness", () => {
    it("GET /health returns ok", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok", service: "zhixu-server" });
    });

    it("GET /ready returns ok", async () => {
      const res = await app.inject({ method: "GET", url: "/ready" });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("ok");
    });
  });

  describe("Project CRUD", () => {
    it("POST /api/projects creates a project", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          workspaceId: "ws_e2e",
          ownerId: "user_e2e",
          title: "E2E Test Project",
          type: "presentation",
          priority: 1,
          riskLevel: "L1",
          privacyMode: "cloud"
        }
      });
      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.title).toBe("E2E Test Project");
      expect(data.status).toBe("captured");
      projectId = data.id;
    });

    it("GET /api/projects lists projects", async () => {
      const res = await app.inject({ method: "GET", url: "/api/projects" });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it("GET /api/projects/:id returns project detail", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(projectId);
    });

    it("GET /api/projects/:id returns 404 for missing", async () => {
      const res = await app.inject({ method: "GET", url: "/api/projects/nonexistent" });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("State Machine", () => {
    it("GET /api/projects/:id/state returns state definition", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/state` });
      expect(res.statusCode).toBe(200);
      const def = res.json().data;
      expect(def.status).toBe("captured");
      expect(def.allowedActions).toContain("add_sources");
    });

    it("POST /api/projects/:id/transition triggers start_understanding", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/transition`,
        payload: { trigger: "start_understanding" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.from).toBe("captured");
      expect(res.json().data.to).toBe("understanding");
    });

    it("POST /api/projects/:id/transition triggers understanding_complete", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/transition`,
        payload: { trigger: "understanding_complete" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.to).toBe("planned");
    });

    it("POST /api/projects/:id/transition rejects invalid trigger", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/transition`,
        payload: { trigger: "nonexistent_trigger" }
      });
      expect(res.statusCode).toBe(422);
    });

    it("POST /api/projects/:id/transition requires confirmations for plan_selected", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/transition`,
        payload: { trigger: "plan_selected" }
      });
      expect(res.statusCode).toBe(422);
    });

    it("POST /api/projects/:id/transition succeeds with confirmations", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/transition`,
        payload: { trigger: "plan_selected", confirmations: ["plan_confirmation"] }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.to).toBe("preparing");
    });
  });

  describe("Source Management", () => {
    it("POST /api/projects/:id/sources adds a source", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/sources`,
        payload: {
          uploadedBy: "user_e2e",
          fileName: "test.pdf",
          fileType: "pdf",
          storageUri: "s3://test/test.pdf",
          sensitivityLevel: "normal"
        }
      });
      expect(res.statusCode).toBe(201);
      sourceId = res.json().data.id;
    });
  });

  describe("Task Management", () => {
    it("POST /api/projects/:id/tasks adds a task", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/tasks`,
        payload: {
          title: "Write introduction",
          assigneeType: "human_ai",
          responsibilityLabel: "human_ai_co_create",
          priority: 1,
          riskLevel: "L1"
        }
      });
      expect(res.statusCode).toBe(201);
      taskId = res.json().data.id;
    });
  });

  describe("Artifact & Block Management", () => {
    it("POST /api/artifacts creates an artifact", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/artifacts",
        payload: {
          projectId,
          type: "presentation",
          title: "Test Presentation",
          firstBlock: {
            blockType: "slide",
            contentJson: { title: "Opening", text: "Welcome to the presentation" },
            createdBy: "user_e2e"
          }
        }
      });
      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      artifactId = data.id;
      blockId = data.blocks[0].id;
    });

    it("PATCH /api/artifacts/:id/blocks/:blockId updates block", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/artifacts/${artifactId}/blocks/${blockId}`,
        payload: {
          contentJson: { title: "Updated Opening", text: "Updated welcome" },
          responsibilityColor: "green",
          verificationStatus: "verified",
          updatedBy: "user_e2e"
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.responsibilityColor).toBe("green");
    });
  });

  describe("Human Gate", () => {
    it("POST /api/projects/:id/human-gates creates a gate", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/human-gates`,
        payload: {
          gateType: "artifact_export",
          reason: "High risk content requires confirmation",
          riskLevel: "L2"
        }
      });
      expect(res.statusCode).toBe(201);
      gateId = res.json().data.id;
    });

    it("POST /api/human-gates/:id/confirm confirms gate", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/human-gates/${gateId}/confirm`,
        payload: { confirmedBy: "user_e2e" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("confirmed");
    });
  });

  describe("Evidence", () => {
    it("POST /api/projects/:id/evidence adds evidence", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/evidence`,
        payload: {
          sourceId,
          evidenceType: "quote",
          quoteText: "Test quote from source",
          confidence: 0.9
        }
      });
      expect(res.statusCode).toBe(201);
      evidenceId = res.json().data.id;
    });

    it("GET /api/projects/:id/evidence lists evidence", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/evidence` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });
  });

  describe("Knowledge Capsule", () => {
    it("POST /api/projects/:id/capsules creates capsule", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/capsules`,
        payload: {
          title: "E2E Capsule",
          summary: "Test capsule from E2E run",
          capsuleType: "general"
        }
      });
      expect(res.statusCode).toBe(201);
      capsuleId = res.json().data.id;
    });

    it("GET /api/projects/:id/capsules lists capsules", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/capsules` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });
  });

  describe("Citation Verification", () => {
    it("POST /api/citations/verify verifies citations", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/citations/verify",
        payload: {
          citations: [
            { rawText: "Smith et al. 2023", doi: "10.1234/test", title: "Test Paper", year: 2023 },
            { rawText: "Invalid ref", year: 1800 }
          ]
        }
      });
      expect(res.statusCode).toBe(200);
      const results = res.json().data;
      expect(results.length).toBe(2);
      expect(results[0].status).toBe("verified");
      expect(results[1].status).toBe("rejected");
    });
  });

  describe("Watcher", () => {
    it("GET /api/watcher/check checks all projects", async () => {
      const res = await app.inject({ method: "GET", url: "/api/watcher/check" });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it("GET /api/projects/:id/reminders checks project reminders", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/reminders` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.projectId).toBe(projectId);
    });
  });

  describe("Version Management", () => {
    it("POST /api/projects/:id/versions creates version", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/versions`,
        payload: {
          entityType: "Artifact",
          entityId: artifactId,
          snapshotJson: { title: "Test Presentation", blocks: 1 },
          createdBy: "user_e2e",
          createdReason: "Before major edit"
        }
      });
      expect(res.statusCode).toBe(201);
      versionId = res.json().data.id;
    });

    it("GET /api/versions/:entityType/:entityId lists versions", async () => {
      const res = await app.inject({ method: "GET", url: `/api/versions/Artifact/${artifactId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it("GET /api/versions/:versionId gets version", async () => {
      const res = await app.inject({ method: "GET", url: `/api/versions/${versionId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(versionId);
    });

    it("POST /api/versions/:versionId/rollback creates rollback version", async () => {
      const res = await app.inject({ method: "POST", url: `/api/versions/${versionId}/rollback` });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.snapshotJson).toBeDefined();
    });
  });

  describe("Mentor Feedback", () => {
    it("POST /api/projects/:id/mentor-feedback adds feedback", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/mentor-feedback`,
        payload: {
          sourceType: "advisor_comment",
          rawContent: "需要加强文献综述部分。建议增加更多近期文献。必须补充方法论描述。"
        }
      });
      expect(res.statusCode).toBe(201);
      feedbackId = res.json().data.id;
      expect(res.json().data.actionItems.length).toBeGreaterThan(0);
    });

    it("GET /api/projects/:id/mentor-feedback lists feedback", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/mentor-feedback` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it("PATCH /api/mentor-feedback/:id/bind binds action item", async () => {
      const feedbackList = (await app.inject({ method: "GET", url: `/api/projects/${projectId}/mentor-feedback` })).json().data;
      const firstFeedback = feedbackList[0];
      const firstActionItem = firstFeedback.actionItems[0];
      const res = await app.inject({
        method: "PATCH",
        url: `/api/mentor-feedback/${feedbackId}/bind`,
        payload: {
          actionItemId: firstActionItem.id,
          entityType: "ArtifactBlock",
          entityId: blockId
        }
      });
      expect(res.statusCode).toBe(200);
    });

    it("POST /api/mentor-feedback/:id/resolve resolves feedback", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/mentor-feedback/${feedbackId}/resolve`,
        payload: { resolvedBy: "user_e2e" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.resolutionStatus).toBe("resolved");
    });
  });

  describe("Quota Management", () => {
    it("GET /api/quota/:userId returns quota status", async () => {
      const res = await app.inject({ method: "GET", url: "/api/quota/user_e2e" });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(4);
    });

    it("POST /api/quota/:userId/check checks quota", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/quota/user_e2e/check",
        payload: { quotaType: "parse_source", requestedAmount: 1 }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.allowed).toBe(true);
    });
  });

  describe("Agent Operations", () => {
    it("GET /api/agent-jobs lists jobs", async () => {
      const res = await app.inject({ method: "GET", url: "/api/agent-jobs" });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it("POST /api/projects/:id/agent/plan generates plan", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/agent/plan`,
        payload: { goal: "Create a 10-minute presentation about machine learning" }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.output).toBeDefined();
    });

    it("POST /api/projects/:id/agent/verify verifies output", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/agent/verify`,
        payload: {
          outputType: "presentation",
          text: "Test output content",
          evidenceRefs: [evidenceId]
        }
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("Skills", () => {
    it("GET /api/skills lists all skills", async () => {
      const res = await app.inject({ method: "GET", url: "/api/skills" });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThanOrEqual(28);
    });
  });

  describe("Export", () => {
    it("POST /api/artifacts/:id/export/markdown exports markdown", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/artifacts/${artifactId}/export/markdown`,
        payload: { userId: "user_e2e" }
      });
      expect(res.statusCode).toBe(200);
    });

    it("POST /api/artifacts/:id/export/pptx exports pptx", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/artifacts/${artifactId}/export/pptx`,
        payload: { userId: "user_e2e" }
      });
      expect(res.statusCode).toBe(200);
    });

    it("POST /api/artifacts/:id/export/docx exports docx", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/artifacts/${artifactId}/export/docx`,
        payload: { userId: "user_e2e" }
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("Chat (Mock Mode)", () => {
    it("POST /api/chat returns 501 without LLM config", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          messages: [{ role: "user", content: "Hello" }]
        }
      });
      expect(res.statusCode).toBe(501);
      expect(res.json().error.code).toBe("NOT_IMPLEMENTED");
    });
  });

  describe("Trace & Feedback", () => {
    it("GET /api/traces/:traceId returns 404 for missing", async () => {
      const res = await app.inject({ method: "GET", url: "/api/traces/nonexistent" });
      expect(res.statusCode).toBe(404);
    });

    it("POST /api/feedback/parse acknowledges feedback", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/feedback/parse",
        payload: { sourceId, feedbackType: "incorrect", comment: "Parse result was wrong" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.received).toBe(true);
    });
  });

  describe("Memory Candidates", () => {
    it("GET /api/projects/:id/memory-candidates lists candidates", async () => {
      const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}/memory-candidates` });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });
  });

  describe("Project Events", () => {
    it("POST /api/projects/:id/events handles project event", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/events`,
        payload: {
          eventType: "project_completed",
          actorId: "user_e2e",
          payload: { summary: "E2E test project completed successfully" }
        }
      });
      expect(res.statusCode).toBe(202);
    });
  });
});
