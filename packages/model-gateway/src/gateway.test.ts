import { describe, expect, it, vi } from "vitest";
import type { LLMResponse, ChatMessage, ToolDefinition } from "./types.js";
import { LLMClient } from "./client.js";
import { ToolRegistry, createZhiXuToolRegistry } from "./tool-registry.js";
import type { ToolHandlerContext } from "./tool-registry.js";
import { LLMModelGateway } from "./gateway.js";

class FakeLLMClient extends LLMClient {
  private readonly responses: LLMResponse[];
  private callIndex = 0;

  constructor(responses: LLMResponse[]) {
    super({ apiKey: "fake", baseURL: "https://fake.example.com", model: "fake-model" });
    this.responses = responses;
  }

  override async chat(): Promise<LLMResponse> {
    const response = this.responses[this.callIndex] ?? this.responses[this.responses.length - 1]!;
    this.callIndex++;
    return response;
  }
}

function makeToolCallResponse(
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
): LLMResponse {
  return {
    content: null,
    toolCalls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments },
    })),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: "fake-model",
    finishReason: "tool_calls",
  };
}

function makeTextResponse(content: string): LLMResponse {
  return {
    content,
    toolCalls: null,
    usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    model: "fake-model",
    finishReason: "stop",
  };
}

describe("LLMClient", () => {
  it("constructs with config", () => {
    const client = new LLMClient({
      apiKey: "test-key",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
    });
    expect(client).toBeInstanceOf(LLMClient);
  });
});

describe("ToolRegistry", () => {
  it("registers and retrieves tool definitions", () => {
    const registry = new ToolRegistry();
    const definition: ToolDefinition = {
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool",
        parameters: { type: "object", properties: { input: { type: "string" } } },
      },
    };

    registry.register(definition, async () => "test result");

    expect(registry.hasTool("test_tool")).toBe(true);
    expect(registry.hasTool("nonexistent")).toBe(false);
    expect(registry.getToolDefinitions()).toHaveLength(1);
    expect(registry.getToolDefinitions()[0]!.function.name).toBe("test_tool");
  });

  it("executes a registered tool", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        type: "function",
        function: {
          name: "echo",
          description: "Echo input",
          parameters: { type: "object", properties: {} },
        },
      },
      async (args) => JSON.stringify(args),
    );

    const result = await registry.executeTool("echo", { hello: "world" });
    expect(JSON.parse(result)).toEqual({ hello: "world" });
  });

  it("throws for unknown tool", async () => {
    const registry = new ToolRegistry();
    await expect(registry.executeTool("unknown", {})).rejects.toThrow("Tool not found: unknown");
  });
});

describe("createZhiXuToolRegistry", () => {
  const mockContext: ToolHandlerContext = {
    listProjects: vi.fn(async () => [{ id: "p1", title: "Test Project" }]),
    getProject: vi.fn(async () => ({ id: "p1", title: "Test Project" })),
    createProject: vi.fn(async (input) => ({ id: "p2", ...input })),
    addSource: vi.fn(async (_projectId, input) => ({ id: "s1", ...input })),
    addTask: vi.fn(async (_projectId, input) => ({ id: "t1", ...input })),
    createArtifact: vi.fn(async (input) => ({ id: "a1", ...input })),
    updateArtifactBlock: vi.fn(async (_artifactId, _blockId, input) => ({ id: "b1", ...input })),
    createHumanGate: vi.fn(async (_projectId, input) => ({ id: "g1", ...input })),
    confirmHumanGate: vi.fn(async (_gateId, input) => ({ id: "g1", confirmed: true, ...input })),
    addEvidence: vi.fn(async (_projectId, input) => ({ id: "e1", ...input })),
    addCapsule: vi.fn(async (_projectId, input) => ({ id: "c1", ...input })),
    addMentorFeedback: vi.fn(async (_projectId, input) => ({ id: "mf1", ...input })),
    verifyCitations: vi.fn(async (citations) => ({ verified: true, count: citations.length })),
    checkWatcher: vi.fn(async () => ({ issues: [], reminders: [] })),
  };

  it("registers all 14 tools", () => {
    const registry = createZhiXuToolRegistry(mockContext);
    const definitions = registry.getToolDefinitions();
    expect(definitions).toHaveLength(14);

    const expectedNames = [
      "list_projects",
      "get_project",
      "create_project",
      "add_source",
      "add_task",
      "create_artifact",
      "update_artifact_block",
      "create_human_gate",
      "confirm_human_gate",
      "verify_citations",
      "check_watcher",
      "add_evidence",
      "create_capsule",
      "add_mentor_feedback",
    ];

    const actualNames = definitions.map((d) => d.function.name).sort();
    expect(actualNames).toEqual(expectedNames.sort());
  });

  it("executes list_projects tool", async () => {
    const registry = createZhiXuToolRegistry(mockContext);
    const result = await registry.executeTool("list_projects", {});
    expect(JSON.parse(result)).toEqual([{ id: "p1", title: "Test Project" }]);
  });

  it("executes create_project tool", async () => {
    const registry = createZhiXuToolRegistry(mockContext);
    const result = await registry.executeTool("create_project", {
      title: "New Project",
      type: "coursework",
    });
    const parsed = JSON.parse(result);
    expect(parsed.title).toBe("New Project");
    expect(parsed.type).toBe("coursework");
  });

  it("executes verify_citations tool", async () => {
    const registry = createZhiXuToolRegistry(mockContext);
    const result = await registry.executeTool("verify_citations", {
      citations: [{ rawText: "Smith et al. 2023", doi: "10.1234/test" }],
    });
    const parsed = JSON.parse(result);
    expect(parsed.verified).toBe(true);
    expect(parsed.count).toBe(1);
  });
});

describe("LLMModelGateway", () => {
  it("constructs with client and registry", () => {
    const client = new FakeLLMClient([]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);
    expect(gateway).toBeInstanceOf(LLMModelGateway);
  });

  it("chatWithTools handles no tool calls", async () => {
    const client = new FakeLLMClient([
      makeTextResponse("Hello, I can help with that."),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.chatWithTools({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.response.content).toBe("Hello, I can help with that.");
    expect(result.toolResults).toHaveLength(0);
  });

  it("chatWithTools handles one round of tool calls", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: { city: { type: "string" } } },
        },
      },
      async (args) => `Weather in ${args["city"] as string}: sunny`,
    );

    const client = new FakeLLMClient([
      makeToolCallResponse([
        { id: "call_1", name: "get_weather", arguments: '{"city":"Beijing"}' },
      ]),
      makeTextResponse("The weather in Beijing is sunny."),
    ]);

    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.chatWithTools({
      messages: [{ role: "user", content: "What's the weather in Beijing?" }],
    });

    expect(result.response.content).toBe("The weather in Beijing is sunny.");
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0]!.functionName).toBe("get_weather");
    expect(result.toolResults[0]!.result).toBe("Weather in Beijing: sunny");
  });

  it("chatWithTools handles multiple rounds of tool calls", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        type: "function",
        function: {
          name: "get_project",
          description: "Get project",
          parameters: { type: "object", properties: { projectId: { type: "string" } } },
        },
      },
      async (args) => JSON.stringify({ id: args["projectId"], title: "Test" }),
    );
    registry.register(
      {
        type: "function",
        function: {
          name: "list_projects",
          description: "List projects",
          parameters: { type: "object", properties: {} },
        },
      },
      async () => JSON.stringify([{ id: "p1" }]),
    );

    const client = new FakeLLMClient([
      makeToolCallResponse([
        { id: "call_1", name: "list_projects", arguments: "{}" },
      ]),
      makeToolCallResponse([
        { id: "call_2", name: "get_project", arguments: '{"projectId":"p1"}' },
      ]),
      makeTextResponse("Found the project."),
    ]);

    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.chatWithTools({
      messages: [{ role: "user", content: "Show me project p1" }],
    });

    expect(result.response.content).toBe("Found the project.");
    expect(result.toolResults).toHaveLength(2);
    expect(result.toolResults[0]!.functionName).toBe("list_projects");
    expect(result.toolResults[1]!.functionName).toBe("get_project");
  });

  it("chatWithTools respects maxToolRounds", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        type: "function",
        function: {
          name: "loop_tool",
          description: "Loop tool",
          parameters: { type: "object", properties: {} },
        },
      },
      async () => "looping",
    );

    const loopResponse = makeToolCallResponse([
      { id: "call_loop", name: "loop_tool", arguments: "{}" },
    ]);

    const client = new FakeLLMClient([loopResponse, loopResponse, loopResponse, loopResponse]);

    const gateway = new LLMModelGateway(client, registry, { maxToolRounds: 2 });

    const result = await gateway.chatWithTools({
      messages: [{ role: "user", content: "Loop" }],
    });

    expect(result.toolResults).toHaveLength(2);
  });

  it("chatWithTools includes system prompt", async () => {
    const client = new FakeLLMClient([
      makeTextResponse("Understood."),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.chatWithTools({
      messages: [{ role: "user", content: "Hello" }],
      systemPrompt: "You are a helpful assistant.",
    });

    expect(result.response.content).toBe("Understood.");
  });
});

describe("LLMModelGateway generatePlan", () => {
  it("returns AgentOutput with plan structure", async () => {
    const client = new FakeLLMClient([
      makeTextResponse(
        JSON.stringify({
          projectTitle: "Test Project",
          goal: "Complete the project",
          recommendedPlan: ["Step 1", "Step 2"],
          urgentPlan: ["Quick step"],
          conservativePlan: ["Careful step"],
        }),
      ),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.generatePlan({
      projectTitle: "Test Project",
      goal: "Complete the project",
    });

    expect(result.outputType).toBe("agent.plan");
    expect(result.structuredResult.projectTitle).toBe("Test Project");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.requiredConfirmations).toContain("plan_selection");
    expect(result.costEstimate.provider).toBe("dashscope");
  });

  it("handles non-JSON response gracefully", async () => {
    const client = new FakeLLMClient([
      makeTextResponse("Here is my plan: Step 1, Step 2, Step 3"),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.generatePlan({
      projectTitle: "Test",
      goal: "Do something",
    });

    expect(result.outputType).toBe("agent.plan");
    expect(result.structuredResult.rawResponse).toBe("Here is my plan: Step 1, Step 2, Step 3");
  });
});

describe("LLMModelGateway verifyOutput", () => {
  it("returns AgentOutput with verification result when evidence present", async () => {
    const client = new FakeLLMClient([
      makeTextResponse(
        JSON.stringify({
          checkedOutputType: "report",
          verdict: "pass",
          evidenceCoverage: 0.9,
        }),
      ),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.verifyOutput({
      outputType: "report",
      text: "This is a report with citations.",
      evidenceRefs: ["ref1", "ref2"],
    });

    expect(result.outputType).toBe("agent.verification");
    expect(result.evidenceRefs).toEqual(["ref1", "ref2"]);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.riskFlags).toHaveLength(0);
  });

  it("flags missing evidence when no evidence refs provided", async () => {
    const client = new FakeLLMClient([
      makeTextResponse("The output lacks proper citations."),
    ]);
    const registry = new ToolRegistry();
    const gateway = new LLMModelGateway(client, registry);

    const result = await gateway.verifyOutput({
      outputType: "report",
      text: "Some text without citations.",
      evidenceRefs: [],
    });

    expect(result.outputType).toBe("agent.verification");
    expect(result.riskFlags).toContain("missing_evidence");
    expect(result.requiredConfirmations).toContain("evidence_review");
    expect(result.confidence).toBeLessThan(0.7);
  });
});
