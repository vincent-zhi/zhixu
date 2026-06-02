# ADR: ZhiXu Agent Harness

## Status

Proposed

## Context

ZhiXu already has concrete agent capabilities in `@zhixu/agent-os`, tool execution in `@zhixu/model-gateway` and `@zhixu/skill-runtime`, session persistence through `AgentSession`, and Fastify SSE workflow routes. The current orchestration for course PPT and lab meeting workflows is hard-coded in `AgentPipeline`, making checkpointing, replay, parallel execution, and consistent error policy difficult.

## Decision

Create `@zhixu/agent-harness` as a control-plane package. It owns workflow definitions, graph execution, checkpointing, event emission, retries, interrupts, policy enforcement, and trace collection. It does not own domain agent logic. Existing agents and tools are connected through registries and adapters.

`@zhixu/agent-harness` must not absorb `@zhixu/agent-os`, `@zhixu/skill-runtime`, `@zhixu/model-gateway`, `@zhixu/artifact-factory`, or database/project-store implementations. Domain workflow definitions and handler bindings live beside their domain agents, currently in `@zhixu/agent-os`, while the harness package remains reusable runtime infrastructure.

## Consequences

Course PPT and lab meeting workflows become declarative TypeScript workflow definitions. The server keeps existing SSE event names during migration. Future workflows can reuse checkpoint, policy, and observability behavior without duplicating pipeline code.

The preferred dependency direction is domain package -> harness. Harness must not import domain packages. This keeps the runtime testable in isolation and avoids circular dependencies during future migrations.
