import type { FastifyInstance } from "fastify";
import type { ProjectStore } from "../project-store.js";
import type { ModelGateway } from "../model-gateway.js";

export async function registerEfficiencyRoutes(_fastify: FastifyInstance, _store: ProjectStore, _gateway: ModelGateway): Promise<void> {
  // Stub — to be replaced by efficiency agent
}
