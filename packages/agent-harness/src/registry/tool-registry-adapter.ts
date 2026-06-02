import type { NodeHandler } from "../types.js";

export interface ToolRegistryLike {
  callTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  listTools(): string[];
}

export class ToolRegistryAdapter {
  constructor(private readonly toolRegistry: ToolRegistryLike) {}

  has(ref: string): boolean {
    const toolName = this.parseToolRef(ref);
    return toolName !== null && this.toolRegistry.listTools().includes(toolName);
  }

  get(ref: string): NodeHandler {
    const toolName = this.parseToolRef(ref);
    if (!toolName || !this.toolRegistry.listTools().includes(toolName)) {
      throw new Error(`Tool handler not found: ${ref}`);
    }

    return async (input) => this.toolRegistry.callTool(toolName, input);
  }

  refs(): string[] {
    return this.toolRegistry.listTools().map((toolName) => `tool.${toolName}`);
  }

  private parseToolRef(ref: string): string | null {
    return ref.startsWith("tool.") ? ref.slice("tool.".length) : null;
  }
}
