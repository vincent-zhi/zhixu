import { describe, expect, it } from "vitest";
import { QuotaManager } from "./quota-manager.js";
import type { QuotaType } from "./types.js";

describe("QuotaManager", () => {
  it("allows consumption within free plan limits", async () => {
    const manager = new QuotaManager();
    const result = await manager.checkQuota("user1", "file_parse", 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.limitAmount).toBe(10);
  });

  it("denies consumption exceeding quota", async () => {
    const manager = new QuotaManager();
    for (let i = 0; i < 10; i++) {
      await manager.consumeQuota("user1", "file_parse", 1);
    }
    const result = await manager.checkQuota("user1", "file_parse", 1);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks used amount after consumption", async () => {
    const manager = new QuotaManager();
    await manager.consumeQuota("user1", "model_call", 25);
    const result = await manager.checkQuota("user1", "model_call", 1);
    expect(result.usedAmount).toBe(25);
    expect(result.remaining).toBe(25);
  });

  it("returns degradation options when quota exceeded", async () => {
    const manager = new QuotaManager();
    for (let i = 0; i < 10; i++) {
      await manager.consumeQuota("user1", "file_parse", 1);
    }
    const result = await manager.checkQuota("user1", "file_parse", 1);
    expect(result.allowed).toBe(false);
    expect(result.degradationOptions.length).toBe(3);
    expect(result.degradationOptions[0].label).toBe("轻解析 (只提取标题和摘要)");
    expect(result.degradationOptions[0].savingsPercent).toBe(50);
  });

  it("returns empty degradation options when quota is sufficient", async () => {
    const manager = new QuotaManager();
    const result = await manager.checkQuota("user1", "file_parse", 1);
    expect(result.degradationOptions).toEqual([]);
  });

  it("provides degradation options for each quota type", () => {
    const manager = new QuotaManager();
    expect(manager.getDegradationOptions("file_parse").length).toBe(3);
    expect(manager.getDegradationOptions("long_context_call").length).toBe(2);
    expect(manager.getDegradationOptions("export").length).toBe(1);
    expect(manager.getDegradationOptions("skill_invocation").length).toBe(1);
    expect(manager.getDegradationOptions("model_call").length).toBe(0);
    expect(manager.getDegradationOptions("storage").length).toBe(0);
  });

  it("isolates quotas per user", async () => {
    const manager = new QuotaManager();
    await manager.consumeQuota("user1", "file_parse", 10);
    const result = await manager.checkQuota("user2", "file_parse", 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it("applies student_pro plan limits", async () => {
    const manager = new QuotaManager();
    manager.setPlan("user1", "student_pro");
    const result = await manager.checkQuota("user1", "file_parse", 1);
    expect(result.limitAmount).toBe(100);
    expect(result.remaining).toBe(100);
  });

  it("applies research_pro plan limits", async () => {
    const manager = new QuotaManager();
    manager.setPlan("user1", "research_pro");
    const result = await manager.checkQuota("user1", "model_call", 1);
    expect(result.limitAmount).toBe(2000);
  });

  it("defaults unspecified quota types to zero limit", async () => {
    const manager = new QuotaManager();
    const result = await manager.checkQuota("user1", "storage", 1);
    expect(result.limitAmount).toBe(0);
    expect(result.allowed).toBe(false);
  });
});
