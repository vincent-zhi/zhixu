import { describe, expect, it } from "vitest";
import { TraceRecorder } from "./trace.js";

describe("TraceRecorder", () => {
  it("records node spans, timings, and error summaries", () => {
    const recorder = new TraceRecorder("run-1", "trace-1", () => 1000);

    recorder.startNode("node-1", "agent.node");
    recorder.completeNode("node-1", () => 1050);
    recorder.startNode("node-2", "agent.fail", () => 1100);
    recorder.failNode("node-2", new Error("boom"), () => 1133);

    expect(recorder.summary()).toEqual({
      runId: "run-1",
      traceId: "trace-1",
      spans: [
        {
          nodeId: "node-1",
          nodeRef: "agent.node",
          startedAtMs: 1000,
          endedAtMs: 1050,
          durationMs: 50,
          status: "completed"
        },
        {
          nodeId: "node-2",
          nodeRef: "agent.fail",
          startedAtMs: 1100,
          endedAtMs: 1133,
          durationMs: 33,
          status: "failed",
          error: "boom"
        }
      ],
      errors: [{ nodeId: "node-2", message: "boom" }]
    });
  });
});
