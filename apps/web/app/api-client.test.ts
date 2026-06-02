import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "./api-client";

describe("api client authentication", () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key)
      }
    });
    localStorage.setItem("zhixu_token", "token_123");
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage
    });
    vi.restoreAllMocks();
  });

  it("sends the stored bearer token on API requests", async () => {
    await listProjects();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token_123"
        })
      })
    );
  });
});
