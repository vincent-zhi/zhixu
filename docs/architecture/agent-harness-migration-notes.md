# Agent Harness Migration Notes

## Migrated in P0

- Created `@zhixu/agent-harness` as the workflow runtime/control-plane package.
- Added typed workflow definitions for course presentation and lab meeting flows in `@zhixu/agent-os`.
- Added `registerAgentOsHandlers` to bind existing domain agents to harness node refs.
- Delegated `AgentPipeline.runCoursePresentation` and `AgentPipeline.runLabMeeting` to the harness executor while preserving legacy result shapes.
- Preserved existing Fastify workflow route request shapes and SSE event names.
- Added AgentSession checkpoint persistence through `saveWorkflowCheckpoint`, stored in existing AgentSession JSON columns without a new database table.
- Added regression coverage for human gate resume, parallel failure handling, workflow contracts, handler coverage, and route SSE compatibility.
- Added workflow definition validation helpers, runtime node context injection, model-gateway tool registry adapter, trace span recording, checkpoint trace ids, and checkpoint rollback primitives.

## Not Migrated in P0

- General `AgentPipeline.run`.
- Long-term memory store.
- YAML/JSON workflow loading.
- Visual workflow editor.
- Advanced cost scheduler.
- Full cross-request workflow resume endpoint execution from an AgentSession checkpoint.

## Operational Notes

- Existing frontend SSE clients do not need endpoint changes.
- Existing domain agent classes remain in `@zhixu/agent-os`.
- Failed parallel nodes are recorded and are not rescheduled by the harness scheduler.
- AgentSession checkpoints are persisted under `canvasStateJson.workflowCheckpoint` alongside progress and agent status JSON.
- Lab meeting paper reading is represented as a parallel-capable workflow node and currently fans out through the `paper.readAllPapers` handler.
- Harness checkpoint stores can load or roll back to a named checkpoint; persistent stores can provide their own rollback operation through `AgentSessionCheckpointStore`.
