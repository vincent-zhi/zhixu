import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "./project-store.js";
import type { ModelGateway } from "./model-gateway.js";

export async function registerDomainRoutes(
  fastify: FastifyInstance,
  store: ProjectStore,
  gateway: ModelGateway
): Promise<void> {
  const { registerCoachingRoutes } = await import("./routes/coaching.js");
  const { registerGradRoutes } = await import("./routes/grad.js");
  const { registerResearchRoutes } = await import("./routes/research.js");
  const { registerUndergradRoutes } = await import("./routes/undergrad.js");
  const { registerEfficiencyRoutes } = await import("./routes/efficiency.js");

  await registerCoachingRoutes(fastify, store, gateway);
  await registerGradRoutes(fastify, store, gateway);
  await registerResearchRoutes(fastify, store, gateway);
  await registerUndergradRoutes(fastify, store, gateway);
  await registerEfficiencyRoutes(fastify, store, gateway);
}
