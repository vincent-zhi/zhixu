import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional().default("file:./dev.db"),
  REDIS_URL: z.string().url().optional().default("redis://localhost:6379"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("zhixu-local"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("zhixu"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("zhixu_dev_password"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  return parsed.data;
}

export function loadEnv(): AppEnv {
  return parseEnv(process.env);
}
