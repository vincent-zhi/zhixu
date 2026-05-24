import { describe, expect, it } from "vitest";
import { QuotaManager } from "./quota-manager.js";

describe("QuotaManager", () => {
  it("uses default quotas for new users", () => {
    const manager = new QuotaManager();
    const result = manager.checkQuota("user1", "parse_source", 1);

    expect(result.allowed).toBe(true);
    expect(result.limitAmount).toBe(50);
    expect(result.usedAmount).toBe(0);
    expect(result.remainingAmount).toBe(50);
    expect(result.degradationOptions).toEqual([]);
  });

  it("allows consuming quota within limits", () => {
    const manager = new QuotaManager();
    const result = manager.consumeQuota("user1", "parse_source", 5);

    expect(result.allowed).toBe(true);
    expect(result.usedAmount).toBe(5);
    expect(result.remainingAmount).toBe(45);
  });

  it("rejects consuming quota beyond limits", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 50);
    const result = manager.consumeQuota("user1", "parse_source", 1);

    expect(result.allowed).toBe(false);
    expect(result.usedAmount).toBe(50);
    expect(result.remainingAmount).toBe(0);
    expect(result.degradationOptions).toEqual([
      "light_parse",
      "selected_files_only",
      "defer_processing",
      "upgrade_plan",
      "manual_summary",
    ]);
  });

  it("returns degradation options when quota exceeded on check", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "long_context", 20);
    const result = manager.checkQuota("user1", "long_context", 1);

    expect(result.allowed).toBe(false);
    expect(result.degradationOptions).toEqual([
      "shorter_context",
      "split_document",
      "upgrade_plan",
    ]);
  });

  it("allows setting custom quota limits", () => {
    const manager = new QuotaManager();
    manager.setQuota("user1", "parse_source", 10);

    const result = manager.checkQuota("user1", "parse_source", 1);
    expect(result.limitAmount).toBe(10);
    expect(result.remainingAmount).toBe(10);
  });

  it("preserves used amount when setting new limit", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 5);
    manager.setQuota("user1", "parse_source", 100);

    const result = manager.checkQuota("user1", "parse_source", 1);
    expect(result.usedAmount).toBe(5);
    expect(result.limitAmount).toBe(100);
    expect(result.remainingAmount).toBe(95);
  });

  it("resets quota used amount", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 30);
    manager.resetQuota("user1", "parse_source");

    const result = manager.checkQuota("user1", "parse_source", 1);
    expect(result.usedAmount).toBe(0);
    expect(result.remainingAmount).toBe(50);
  });

  it("isolates quotas per user", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 50);

    const result = manager.checkQuota("user2", "parse_source", 1);
    expect(result.allowed).toBe(true);
    expect(result.remainingAmount).toBe(50);
  });

  it("isolates quotas per type", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 50);

    const result = manager.checkQuota("user1", "export", 1);
    expect(result.allowed).toBe(true);
    expect(result.remainingAmount).toBe(30);
  });

  it("returns empty degradation options for unknown quota type", () => {
    const manager = new QuotaManager();
    const options = manager.getDegradationOptions("unknown_type");
    expect(options).toEqual([]);
  });

  it("returns correct degradation options for export", () => {
    const manager = new QuotaManager();
    const options = manager.getDegradationOptions("export");
    expect(options).toEqual(["reduce_format_options", "upgrade_plan"]);
  });

  it("returns correct degradation options for skill_invocation", () => {
    const manager = new QuotaManager();
    const options = manager.getDegradationOptions("skill_invocation");
    expect(options).toEqual(["use_basic_skill", "defer_to_off_peak", "upgrade_plan"]);
  });

  it("supports setQuota with resetAt", () => {
    const manager = new QuotaManager();
    const resetAt = "2026-06-01T00:00:00.000Z";
    manager.setQuota("user1", "parse_source", 100, resetAt);
    manager.consumeQuota("user1", "parse_source", 10);
    manager.resetQuota("user1", "parse_source");

    const result = manager.checkQuota("user1", "parse_source", 1);
    expect(result.usedAmount).toBe(0);
    expect(result.limitAmount).toBe(100);
  });

  it("does not deduct quota when consume is not allowed", () => {
    const manager = new QuotaManager();
    manager.consumeQuota("user1", "parse_source", 50);
    const result = manager.consumeQuota("user1", "parse_source", 5);

    expect(result.allowed).toBe(false);
    expect(result.usedAmount).toBe(50);
  });
});
