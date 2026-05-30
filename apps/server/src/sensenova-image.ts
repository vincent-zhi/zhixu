/**
 * SenseNova Image Generation Adapter
 *
 * Provides text-to-image generation via SenseNova U1 Fast model
 * and image understanding via SenseNova 6.7 Flash-Lite VLM.
 *
 * API: OpenAI-compatible at https://token.sensenova.cn/v1
 */

export interface SenseNovaImageConfig {
  apiKey: string;
  baseURL?: string; // default: https://token.sensenova.cn/v1
  imageModel?: string; // default: sensenova-u1-fast
  chatModel?: string; // default: sensenova-6.7-flash-lite
}

interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface ImageRecognitionResult {
  success: boolean;
  description?: string;
  error?: string;
}

/**
 * Generate an image from a text prompt using SenseNova U1 Fast.
 */
export async function generateImage(
  prompt: string,
  config: SenseNovaImageConfig,
  options?: {
    size?: string; // e.g. "2752x1536" (16:9), "2048x2048" (1:1)
    negativePrompt?: string;
    seed?: number;
  }
): Promise<ImageGenerationResult> {
  const baseURL = config.baseURL ?? "https://token.sensenova.cn/v1";
  const model = config.imageModel ?? "sensenova-u1-fast";

  try {
    const response = await fetch(`${baseURL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: options?.size ?? "2752x1536",
        n: 1,
        ...(options?.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
        ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json() as { data?: Array<{ url?: string }> };
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return { success: false, error: "No image URL in response" };
    }

    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Analyze an image using SenseNova 6.7 Flash-Lite VLM.
 * Supports both URL and base64 image input.
 */
export async function recognizeImage(
  imageUrlOrBase64: string,
  prompt: string,
  config: SenseNovaImageConfig
): Promise<ImageRecognitionResult> {
  const baseURL = config.baseURL ?? "https://token.sensenova.cn/v1";
  const model = config.chatModel ?? "sensenova-6.7-flash-lite";

  const isBase64 = imageUrlOrBase64.startsWith("data:") || imageUrlOrBase64.length > 1000;

  const imageContent = isBase64
    ? {
        type: "image_url" as const,
        image_url: { url: imageUrlOrBase64.startsWith("data:") ? imageUrlOrBase64 : `data:image/png;base64,${imageUrlOrBase64}` },
      }
    : {
        type: "image_url" as const,
        image_url: { url: imageUrlOrBase64 },
      };

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              imageContent,
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const description = data?.choices?.[0]?.message?.content;
    if (!description) {
      return { success: false, error: "No content in response" };
    }

    return { success: true, description };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Available image sizes for SenseNova U1 Fast.
 */
export const SENSENOVA_IMAGE_SIZES = {
  "16:9": "2752x1536",
  "9:16": "1536x2752",
  "1:1": "2048x2048",
  "3:2": "2496x1664",
  "2:3": "1664x2496",
  "4:3": "2368x1760",
  "3:4": "1760x2368",
  "5:4": "2272x1824",
  "4:5": "1824x2272",
  "21:9": "3072x1376",
  "9:21": "1344x3136",
} as const;
