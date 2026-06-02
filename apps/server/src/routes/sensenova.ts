import type { FastifyInstance } from "fastify";
import { getSenseNovaSkillsSummary, getSenseNovaSkillDetail } from "../sensenova-skill-loader.js";
import { generateImage, recognizeImage, SENSENOVA_IMAGE_SIZES, type SenseNovaImageConfig } from "../sensenova-image.js";
import { invokeSenseNovaSkill, type SenseNovaSkillInvokeBody } from "../sensenova-agent-skill-runner.js";

/**
 * Register SenseNova-specific API routes.
 * @param getImageConfig - Function that returns the stored image config (from settings)
 */
export async function registerSenseNovaRoutes(
  fastify: FastifyInstance,
  getImageConfig?: () => SenseNovaImageConfig | undefined
): Promise<void> {
  // --- Skill Discovery ---
  fastify.get("/api/sensenova/skills", async () => {
    const skills = getSenseNovaSkillsSummary();
    return { skills, count: skills.length };
  });

  fastify.get("/api/sensenova/skills/:skillName", async (req, reply) => {
    const { skillName } = req.params as { skillName: string };
    const skill = getSenseNovaSkillDetail(skillName);
    if (!skill) return reply.status(404).send({ error: "skill_not_found" });
    return skill;
  });

  fastify.post("/api/sensenova/skills/:skillName/invoke", async (req, reply) => {
    const { skillName } = req.params as { skillName: string };
    const skill = getSenseNovaSkillDetail(skillName);
    if (!skill) return reply.status(404).send({ error: "skill_not_found" });

    try {
      return await invokeSenseNovaSkill(skill, (req.body ?? {}) as SenseNovaSkillInvokeBody);
    } catch (error) {
      return reply.status(400).send({
        error: "skill_invocation_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // --- Image Generation ---
  fastify.post("/api/sensenova/image/generate", async (req, reply) => {
    const body = req.body as {
      prompt: string;
      size?: string;
      aspectRatio?: keyof typeof SENSENOVA_IMAGE_SIZES;
      negativePrompt?: string;
      seed?: number;
    };

    if (!body.prompt) return reply.status(400).send({ error: "prompt_required" });

    // Try stored config first, then env vars
    const config = getImageConfig?.() ?? getEnvImageConfig();
    if (!config) return reply.status(400).send({ error: "image_not_configured", message: "请在设置中配置图像生成提供商" });

    const size = body.size ?? (body.aspectRatio ? SENSENOVA_IMAGE_SIZES[body.aspectRatio] : undefined) ?? "2752x1536";
    const opts: { size?: string; negativePrompt?: string; seed?: number } = { size };
    if (body.negativePrompt !== undefined) opts.negativePrompt = body.negativePrompt;
    if (body.seed !== undefined) opts.seed = body.seed;
    const result = await generateImage(body.prompt, config, opts);

    if (!result.success) return reply.status(500).send({ error: "generation_failed", message: result.error });
    return { imageUrl: result.imageUrl };
  });

  // --- Image Recognition ---
  fastify.post("/api/sensenova/image/recognize", async (req, reply) => {
    const body = req.body as { imageUrl: string; prompt?: string };

    if (!body.imageUrl) return reply.status(400).send({ error: "imageUrl_required" });

    const config = getImageConfig?.() ?? getEnvImageConfig();
    if (!config) return reply.status(400).send({ error: "image_not_configured", message: "请在设置中配置图像生成提供商" });

    const result = await recognizeImage(body.imageUrl, body.prompt ?? "请详细描述这张图片的内容", config);

    if (!result.success) return reply.status(500).send({ error: "recognition_failed", message: result.error });
    return { description: result.description };
  });

  // --- Image Sizes Reference ---
  fastify.get("/api/sensenova/image/sizes", async () => {
    return { sizes: SENSENOVA_IMAGE_SIZES };
  });
}

/** Fallback to env vars if no stored config */
function getEnvImageConfig(): SenseNovaImageConfig | undefined {
  const apiKey = process.env.SN_API_KEY ?? process.env.SENSENOVA_API_KEY;
  if (!apiKey) return undefined;
  return {
    apiKey,
    baseURL: process.env.SN_BASE_URL ?? "https://token.sensenova.cn/v1",
    imageModel: process.env.SN_IMAGE_MODEL ?? "sensenova-u1-fast",
    chatModel: process.env.SN_CHAT_MODEL ?? "sensenova-6.7-flash-lite",
  };
}
