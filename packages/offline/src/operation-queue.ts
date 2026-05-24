import type { PendingOperation } from "./types.js";

export class OperationQueue {
  private operations: PendingOperation[] = [];

  enqueue(operation: Omit<PendingOperation, "id" | "retryCount" | "status">): PendingOperation {
    const entry: PendingOperation = {
      ...operation,
      id: crypto.randomUUID(),
      retryCount: 0,
      status: "pending",
    };
    this.operations.push(entry);
    this.operations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return entry;
  }

  dequeue(): PendingOperation | null {
    const pending = this.operations.find((op) => op.status === "pending");
    if (!pending) return null;
    pending.status = "syncing";
    return pending;
  }

  peek(): PendingOperation | null {
    return this.operations.find((op) => op.status === "pending") ?? null;
  }

  markApplied(id: string): boolean {
    const op = this.operations.find((o) => o.id === id);
    if (!op) return false;
    op.status = "applied";
    return true;
  }

  markFailed(id: string): boolean {
    const op = this.operations.find((o) => o.id === id);
    if (!op) return false;
    op.status = "failed";
    return true;
  }

  markConflicted(id: string): boolean {
    const op = this.operations.find((o) => o.id === id);
    if (!op) return false;
    op.status = "conflicted";
    return true;
  }

  getPending(): PendingOperation[] {
    return this.operations.filter((op) => op.status === "pending");
  }

  getConflicted(): PendingOperation[] {
    return this.operations.filter((op) => op.status === "conflicted");
  }

  retry(id: string): PendingOperation | null {
    const op = this.operations.find((o) => o.id === id);
    if (!op || op.status !== "failed") return null;
    op.retryCount++;
    op.status = "pending";
    return op;
  }

  clear(): void {
    this.operations = [];
  }
}
