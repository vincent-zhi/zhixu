import { describe, expect, it } from "vitest";
import { createServerApp } from "./app.js";

describe("server app", () => {
  it("returns a liveness response", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "zhixu-server" });

    await app.close();
  });

  it("returns seed project summaries", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api/projects" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          title: "Course Presentation",
          status: "planned",
          riskLevel: "L1"
        }
      ]
    });

    await app.close();
  });

  it("validates project creation input", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" }
    });

    await app.close();
  });

  it("returns a project detail with PRD workspace sections", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/projects/project_course_presentation"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        id: "project_course_presentation",
        sources: [],
        tasks: [],
        artifacts: [],
        humanGates: [],
        auditLogs: []
      }
    });

    await app.close();
  });

  it("registers project sources and writes an audit log", async () => {
    const app = await createServerApp({ logger: false });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/sources",
      payload: {
        uploadedBy: "user_demo",
        fileName: "assignment.pdf",
        fileType: "application/pdf",
        storageUri: "s3://zhixu-local/project/assignment.pdf",
        sensitivityLevel: "course_internal"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      data: {
        fileName: "assignment.pdf",
        parseStatus: "queued",
        sensitivityLevel: "course_internal"
      }
    });

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/projects/project_course_presentation"
    });
    expect(detailResponse.json().data.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "source.registered",
          targetType: "Source"
        })
      ])
    );

    await app.close();
  });

  it("queues file parsing jobs when a source is registered", async () => {
    const app = await createServerApp({ logger: false });
    const sourceResponse = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/sources",
      payload: {
        uploadedBy: "user_demo",
        fileName: "paper.pdf",
        fileType: "application/pdf",
        storageUri: "s3://zhixu-local/project/paper.pdf",
        sensitivityLevel: "unpublished_paper"
      }
    });
    const source = sourceResponse.json().data;

    const jobsResponse = await app.inject({
      method: "GET",
      url: "/api/agent-jobs"
    });

    expect(jobsResponse.statusCode).toBe(200);
    expect(jobsResponse.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "project_course_presentation",
          jobType: "parse_source",
          status: "queued",
          inputRef: { sourceId: source.id }
        })
      ])
    );

    await app.close();
  });

  it("creates project tasks with risk and responsibility metadata", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/tasks",
      payload: {
        title: "Confirm outline",
        description: "User must approve the slide-level plan",
        assigneeType: "human",
        responsibilityLabel: "user_confirm",
        riskLevel: "L2"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      data: {
        title: "Confirm outline",
        status: "captured",
        riskLevel: "L2"
      }
    });

    await app.close();
  });

  it("creates artifacts and updates blocks with evidence responsibility", async () => {
    const app = await createServerApp({ logger: false });
    const artifactResponse = await app.inject({
      method: "POST",
      url: "/api/artifacts",
      payload: {
        projectId: "project_course_presentation",
        type: "presentation",
        title: "Group report deck",
        firstBlock: {
          blockType: "slide",
          contentJson: { title: "Opening" },
          createdBy: "user_demo"
        }
      }
    });

    expect(artifactResponse.statusCode).toBe(201);
    const artifact = artifactResponse.json().data;
    expect(artifact.blocks[0]).toMatchObject({
      blockType: "slide",
      responsibilityColor: "gray",
      verificationStatus: "unverified"
    });

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/artifacts/${artifact.id}/blocks/${artifact.blocks[0].id}`,
      payload: {
        contentJson: { title: "Opening", speakerNote: "Introduce task scope" },
        responsibilityColor: "yellow",
        verificationStatus: "pending",
        updatedBy: "user_demo"
      }
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      data: {
        contentJson: {
          speakerNote: "Introduce task scope"
        },
        responsibilityColor: "yellow",
        verificationStatus: "pending"
      }
    });

    await app.close();
  });

  it("confirms human gates and records the decision", async () => {
    const app = await createServerApp({ logger: false });
    const gateResponse = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/human-gates",
      payload: {
        gateType: "sensitive_cloud_processing",
        reason: "Course internal material requires explicit confirmation",
        riskLevel: "L2"
      }
    });
    const gate = gateResponse.json().data;

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/api/human-gates/${gate.id}/confirm`,
      payload: {
        confirmedBy: "user_demo"
      }
    });

    expect(confirmResponse.statusCode).toBe(200);
    expect(confirmResponse.json()).toMatchObject({
      data: {
        status: "confirmed",
        confirmedBy: "user_demo"
      }
    });

    await app.close();
  });

  it("runs Agent Planner through the model gateway and returns governed output", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/agent/plan",
      payload: {
        goal: "Prepare a 10-minute presentation from uploaded course material"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      data: {
        jobType: "generate_plan",
        status: "completed",
        output: {
          outputType: "agent.plan",
          structuredResult: {
            recommendedPlan: expect.any(Array)
          },
          requiredConfirmations: ["plan_selection"],
          evidenceRefs: [],
          riskFlags: [],
          costEstimate: {
            provider: "mock"
          }
        }
      }
    });

    await app.close();
  });

  it("runs Agent Verifier and flags unsupported AI output", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/agent/verify",
      payload: {
        outputType: "artifact.block",
        text: "This conclusion has no source attached.",
        evidenceRefs: []
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      data: {
        jobType: "verify_output",
        status: "completed",
        output: {
          outputType: "agent.verification",
          riskFlags: ["missing_evidence"],
          requiredConfirmations: ["evidence_review"]
        }
      }
    });

    await app.close();
  });

  it("runs a smooth steward workflow for sensitive source intake", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "source_intake_requested",
        actorId: "user_demo",
        payload: {
          fileName: "unpublished-paper.pdf",
          fileType: "application/pdf",
          storageUri: "s3://zhixu-local/project/unpublished-paper.pdf",
          sensitivityLevel: "unpublished_paper"
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      data: {
        projectId: "project_course_presentation",
        status: "waiting_human",
        routedTo: "SourceAgent",
        steps: [
          { name: "gateway.accept_event", status: "completed" },
          { name: "source.register", status: "completed" },
          { name: "human_gate.require_sensitive_processing", status: "completed" },
          { name: "agent.enqueue_parse_source", status: "completed" }
        ],
        requiredConfirmations: ["sensitive_cloud_processing"],
        riskFlags: ["sensitive_source"]
      }
    });

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/projects/project_course_presentation"
    });
    expect(detailResponse.json().data.humanGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateType: "sensitive_cloud_processing",
          status: "pending"
        })
      ])
    );

    await app.close();
  });

  it("runs a smooth steward workflow for user goal planning", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "user_goal_submitted",
        actorId: "user_demo",
        payload: {
          goal: "Make a presentation with outline, speaker notes and evidence checks."
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      data: {
        status: "completed",
        routedTo: "PlannerAgent",
        steps: [
          { name: "gateway.accept_event", status: "completed" },
          { name: "planner.generate_three_options", status: "completed" },
          { name: "task.create_plan_confirmation", status: "completed" }
        ],
        agentJobs: [
          expect.objectContaining({
            jobType: "generate_plan",
            status: "completed"
          })
        ],
        requiredConfirmations: ["plan_selection"]
      }
    });

    await app.close();
  });

  it("auto-parses normal source intake and indexes evidence anchors", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "source_intake_requested",
        actorId: "user_demo",
        payload: {
          fileName: "lecture-notes.md",
          fileType: "text/markdown",
          storageUri: "s3://zhixu-local/project/lecture-notes.md",
          sensitivityLevel: "normal"
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      data: {
        status: "completed",
        routedTo: "SourceAgent",
        steps: [
          { name: "gateway.accept_event", status: "completed" },
          { name: "source.register", status: "completed" },
          { name: "source.parse_with_provider", status: "completed" },
          { name: "evidence.index", status: "completed" }
        ],
        agentJobs: [
          expect.objectContaining({
            jobType: "parse_source",
            status: "completed",
            output: expect.objectContaining({
              outputType: "source.parse"
            })
          })
        ],
        requiredConfirmations: []
      }
    });

    await app.close();
  });

  it("resumes sensitive parse jobs after Human Gate confirmation event", async () => {
    const app = await createServerApp({ logger: false });
    await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "source_intake_requested",
        actorId: "user_demo",
        payload: {
          fileName: "mentor-feedback.docx",
          fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          storageUri: "s3://zhixu-local/project/mentor-feedback.docx",
          sensitivityLevel: "mentor_feedback"
        }
      }
    });
    const projectResponse = await app.inject({
      method: "GET",
      url: "/api/projects/project_course_presentation"
    });
    const gate = projectResponse.json().data.humanGates.at(-1);

    const resumeResponse = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "human_gate_confirmed",
        actorId: "user_demo",
        payload: { gateId: gate.id }
      }
    });

    expect(resumeResponse.statusCode).toBe(202);
    expect(resumeResponse.json()).toMatchObject({
      data: {
        status: "completed",
        routedTo: "WatcherAgent",
        steps: [
          { name: "gateway.accept_event", status: "completed" },
          { name: "human_gate.confirm", status: "completed" },
          { name: "watcher.resume_waiting_jobs", status: "completed" }
        ],
        agentJobs: [
          expect.objectContaining({
            jobType: "parse_source",
            status: "completed"
          })
        ]
      }
    });

    await app.close();
  });

  it("verifies artifact block updates and creates evidence review gates", async () => {
    const app = await createServerApp({ logger: false });
    const artifactResponse = await app.inject({
      method: "POST",
      url: "/api/artifacts",
      payload: {
        projectId: "project_course_presentation",
        type: "report",
        title: "Course Report",
        firstBlock: {
          blockType: "paragraph",
          contentJson: { text: "Unsupported claim" },
          createdBy: "user_demo"
        }
      }
    });
    const artifact = artifactResponse.json().data;
    const block = artifact.blocks[0];

    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "artifact_block_updated",
        actorId: "user_demo",
        payload: {
          artifactId: artifact.id,
          blockId: block.id,
          text: "Unsupported claim",
          evidenceRefs: []
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      data: {
        status: "waiting_human",
        routedTo: "VerifierAgent",
        riskFlags: ["missing_evidence"],
        requiredConfirmations: ["evidence_review"]
      }
    });

    await app.close();
  });

  it("reflects completed projects into memory candidates", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/project_course_presentation/events",
      payload: {
        eventType: "project_completed",
        actorId: "user_demo",
        payload: {
          summary: "Finished course presentation workflow with evidence checks."
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      data: {
        status: "waiting_human",
        routedTo: "ReflectionEngine",
        steps: [
          { name: "gateway.accept_event", status: "completed" },
          { name: "reflection.extract_memory_candidate", status: "completed" },
          { name: "human_gate.require_memory_save", status: "completed" }
        ],
        requiredConfirmations: ["save_knowledge_capsule"]
      }
    });

    const memoryResponse = await app.inject({
      method: "GET",
      url: "/api/projects/project_course_presentation/memory-candidates"
    });
    expect(memoryResponse.statusCode).toBe(200);
    expect(memoryResponse.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "project_course_presentation",
          status: "pending_confirmation",
          memoryType: "knowledge_capsule"
        })
      ])
    );

    await app.close();
  });

  it("lists built-in governed skills", async () => {
    const app = await createServerApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/skills"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "source.parse", riskLevel: "L1" }),
        expect.objectContaining({ name: "artifact.verify", riskLevel: "L2" }),
        expect.objectContaining({ name: "memory.reflect", riskLevel: "L2" })
      ])
    );

    await app.close();
  });
});
