import type { NodeHandler } from "../types.js";

export class AgentRegistry {
  private readonly handlers = new Map<string, NodeHandler>();

  register(ref: string, handler: NodeHandler): void {
    this.handlers.set(ref, handler);
  }

  get(ref: string): NodeHandler {
    const handler = this.handlers.get(ref);
    if (!handler) throw new Error(`Agent handler not found: ${ref}`);
    return handler;
  }

  has(ref: string): boolean {
    return this.handlers.has(ref);
  }

  refs(): string[] {
    return Array.from(this.handlers.keys());
  }
}
