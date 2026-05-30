import type { FastifyInstance } from "fastify";
import { loadSenseNovaSkills, getSenseNovaSkillsSummary, getSenseNovaSkillDetail } from "../sensenova-skill-loader.js";
import { generateImage, recognizeImage, SENSENOVA_IMAGE_SIZES, type SenseNovaImageConfig } from "../sensenova-image.js";

/**
 * Register SenseNova-specific API routes.
 * These routes expose SenseNova's image generation/recognition and skill system.
 */
export async function registerSenseNovaRoutes(fastify: FastifyInstance): Promise<void> {
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

    // Use LLM config if available for the API key
    const apiKey = process.env.SN_API_KEY ?? process.env.SENSENOVA_API_KEY;
    if (!apiKey) return reply.status(400).send({ error: "sensenova_not_configured", message: "请在环境变量中设置 SN_API_KEY 或 SENSENOVA_API_KEY" });

    const config: SenseNovaImageConfig = { apiKey };

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

    const apiKey = process.env.SN_API_KEY ?? process.env.SENSENOVA_API_KEY;
    if (!apiKey) return reply.status(400).send({ error: "sensenova_not_configured", message: "请在环境变量中设置 SN_API_KEY 或 SENSENOVA_API_KEY" });

    const config: SenseNovaImageConfig = { apiKey };
    const result = await recognizeImage(body.imageUrl, body.prompt ?? "请详细描述这张图片的内容", config);

    if (!result.success) return reply.status(500).send({ error: "recognition_failed", message: result.error });
    return { description: result.description };
  });

  // --- Image Sizes Reference ---
  fastify.get("/api/sensenova/image/sizes", async () => {
    return { sizes: SENSENOVA_IMAGE_SIZES };
  });
}
