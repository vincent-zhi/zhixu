export interface NodeSpan {
  nodeId: string;
  nodeRef: string;
  startedAtMs: number;
  endedAtMs?: number;
  durationMs?: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

export interface TraceSummary {
  runId: string;
  traceId: string;
  spans: NodeSpan[];
  errors: Array<{ nodeId: string; message: string }>;
}

export class TraceRecorder {
  private readonly spans = new Map<string, NodeSpan>();

  constructor(
    private readonly runId: string,
    private readonly traceId: string,
    private readonly nowMs: () => number = () => Date.now()
  ) {}

  startNode(nodeId: string, nodeRef: string, nowMs: () => number = this.nowMs): void {
    this.spans.set(nodeId, {
      nodeId,
      nodeRef,
      startedAtMs: nowMs(),
      status: "running"
    });
  }

  completeNode(nodeId: string, nowMs: () => number = this.nowMs): void {
    this.finishNode(nodeId, "completed", undefined, nowMs);
  }

  failNode(nodeId: string, error: unknown, nowMs: () => number = this.nowMs): void {
    const message = error instanceof Error ? error.message : String(error);
    this.finishNode(nodeId, "failed", message, nowMs);
  }

  summary(): TraceSummary {
    const spans = Array.from(this.spans.values());
    return {
      runId: this.runId,
      traceId: this.traceId,
      spans,
      errors: spans
        .filter((span) => span.status === "failed" && span.error)
        .map((span) => ({ nodeId: span.nodeId, message: span.error! }))
    };
  }

  private finishNode(
    nodeId: string,
    status: "completed" | "failed",
    error: string | undefined,
    nowMs: () => number
  ): void {
    const span = this.spans.get(nodeId);
    if (!span) return;

    const endedAtMs = nowMs();
    this.spans.set(nodeId, {
      ...span,
      endedAtMs,
      durationMs: endedAtMs - span.startedAtMs,
      status,
      ...(error ? { error } : {})
    });
  }
}
