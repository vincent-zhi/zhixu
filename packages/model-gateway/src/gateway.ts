import type { AgentOutput } from "@zhixu/core";
import type { ChatMessage, LLMResponse, ToolCallResult } from "./types.js";
import { LLMClient } from "./client.js";
import { ToolRegistry } from "./tool-registry.js";

const ZHIXU_SYSTEM_PROMPT =
  "你是知序AI学习科研管家的智能助手。知序以项目为核心，帮助用户理解任务、拆解任务、规划路径、追踪进度、产出成果。所有AI输出必须标注三色权责：绿色（可溯源）、黄色（需核验）、灰色（AI推断）。高风险操作必须经过Human Gate确认。";

const PLAN_SYSTEM_PROMPT =
  "你是知序的任务规划Agent。根据用户的项目目标和资料，生成三方案规划（推荐方案、加急方案、稳妥方案）。每个方案包含任务列表、风险评估和AI参与比例。请使用提供的工具查询项目信息。";

const VERIFY_SYSTEM_PROMPT =
  "你是知序的验证Agent。检查产物的事实准确性、引用完整性、三色权责合规和格式规范。请使用提供的工具查询证据和引用信息。";

export interface ModelGateway {
  generatePlan(input: { projectTitle: string; goal: string }): Promise<AgentOutput>;
  verifyOutput(input: { outputType: string; text: string; evidenceRefs: string[] }): Promise<AgentOutput>;
  chatWithTools(input: {
    messages: ChatMessage[];
    systemPrompt?: string;
  }): Promise<{ response: LLMResponse; toolResults: ToolCallResult[] }>;
}

function buildChatInput(messages: ChatMessage[], toolDefinitions: ToolRegistry) {
  const defs = toolDefinitions.getToolDefinitions();
  const base = { messages };
  if (defs.length > 0) {
    return { ...base, tools: defs, toolChoice: "auto" as const };
  }
  return base;
}

export class LLMModelGateway implements ModelGateway {
  private readonly maxToolRounds: number;

  constructor(
    private readonly client: LLMClient,
    private readonly toolRegistry: ToolRegistry,
    config?: { maxToolRounds?: number },
  ) {
    this.maxToolRounds = config?.maxToolRounds ?? 10;
  }

  async generatePlan(input: { projectTitle: string; goal: string }): Promise<AgentOutput> {
    const systemPrompt = `${ZHIXU_SYSTEM_PROMPT}\n\n${PLAN_SYSTEM_PROMPT}`;
    const userMessage: ChatMessage = {
      role: "user",
      content: `项目标题：${input.projectTitle}\n目标：${input.goal}`,
    };

    const { response, toolResults } = await this.chatWithTools({
      messages: [userMessage],
      systemPrompt,
    });

    const content = response.content ?? "";
    let structuredResult: Record<string, unknown>;

    try {
      structuredResult = JSON.parse(content);
    } catch {
      structuredResult = {
        projectTitle: input.projectTitle,
        goal: input.goal,
        rawResponse: content,
        toolResultsUsed: toolResults.map((tr) => tr.functionName),
      };
    }

    return {
      outputType: "agent.plan",
      structuredResult,
      confidence: 0.75,
      requiredConfirmations: ["plan_selection"],
      evidenceRefs: [],
      riskFlags: [],
      nextActions: ["select_plan", "register_missing_sources"],
      costEstimate: {
        provider: "dashscope",
        model: response.model,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        estimatedUsd: (response.usage.totalTokens / 1_000_000) * 0.5,
      },
    };
  }

  async verifyOutput(input: {
    outputType: string;
    text: string;
    evidenceRefs: string[];
  }): Promise<AgentOutput> {
    const systemPrompt = `${ZHIXU_SYSTEM_PROMPT}\n\n${VERIFY_SYSTEM_PROMPT}`;
    const userMessage: ChatMessage = {
      role: "user",
      content: `产物类型：${input.outputType}\n内容：${input.text}\n证据引用：${input.evidenceRefs.join(", ") || "无"}`,
    };

    const { response, toolResults } = await this.chatWithTools({
      messages: [userMessage],
      systemPrompt,
    });

    const content = response.content ?? "";
    let structuredResult: Record<string, unknown>;

    try {
      structuredResult = JSON.parse(content);
    } catch {
      const hasEvidence = input.evidenceRefs.length > 0;
      structuredResult = {
        checkedOutputType: input.outputType,
        textLength: input.text.length,
        evidenceCoverage: hasEvidence ? 1 : 0,
        verdict: hasEvidence ? "pass_with_sources" : "needs_evidence",
        rawResponse: content,
        toolResultsUsed: toolResults.map((tr) => tr.functionName),
      };
    }

    const hasEvidence = input.evidenceRefs.length > 0;

    return {
      outputType: "agent.verification",
      structuredResult,
      confidence: hasEvidence ? 0.85 : 0.6,
      requiredConfirmations: hasEvidence ? [] : ["evidence_review"],
      evidenceRefs: input.evidenceRefs,
      riskFlags: hasEvidence ? [] : ["missing_evidence"],
      nextActions: hasEvidence ? ["continue_editing"] : ["attach_source_or_mark_gray"],
      costEstimate: {
        provider: "dashscope",
        model: response.model,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        estimatedUsd: (response.usage.totalTokens / 1_000_000) * 0.5,
      },
    };
  }

  async chatWithTools(input: {
    messages: ChatMessage[];
    systemPrompt?: string;
  }): Promise<{ response: LLMResponse; toolResults: ToolCallResult[] }> {
    const messages: ChatMessage[] = [];

    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }

    messages.push(...input.messages);

    const allToolResults: ToolCallResult[] = [];
    let round = 0;

    let response = await this.client.chat(buildChatInput(messages, this.toolRegistry));

    while (response.toolCalls && response.toolCalls.length > 0 && round < this.maxToolRounds) {
      round++;

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      };
      messages.push(assistantMessage);

      for (const toolCall of response.toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await this.toolRegistry.executeTool(toolCall.function.name, args);

        allToolResults.push({
          toolCallId: toolCall.id,
          functionName: toolCall.function.name,
          arguments: args,
          result,
        });

        messages.push({
          role: "tool",
          content: result,
          toolCallId: toolCall.id,
        });
      }

      response = await this.client.chat(buildChatInput(messages, this.toolRegistry));
    }

    return { response, toolResults: allToolResults };
  }
}
