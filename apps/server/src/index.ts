import { loadEnv } from "@zhixu/config";
import { createServerApp } from "./app.js";

const env = loadEnv();
const storeType = process.env.STORE_TYPE === "prisma" ? "prisma" as const : "memory" as const;
const app = await createServerApp({ storeType });

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error, "failed to start server");
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
