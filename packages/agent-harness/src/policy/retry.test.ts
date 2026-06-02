import { describe, expect, it } from "vitest";
import { runWithRetry, runWithTimeout, TimeoutError } from "./retry.js";

describe("runWithTimeout", () => {
  it("resolves within timeout", async () => {
    const result = await runWithTimeout(async () => 42, 1000);
    expect(result).toBe(42);
  });

  it("rejects with TimeoutError when operation exceeds timeout", async () => {
    await expect(
      runWithTimeout(
        () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 200)),
        50
      )
    ).rejects.toThrow(TimeoutError);
  });

  it("passes through non-timeout errors", async () => {
    await expect(
      runWithTimeout(async () => {
        throw new Error("inner");
      }, 1000)
    ).rejects.toThrow("inner");
  });

  it("skips timeout when timeoutMs is 0", async () => {
    const result = await runWithTimeout(async () => "ok", 0);
    expect(result).toBe("ok");
  });
});

describe("runWithRetry", () => {
  it("succeeds on first attempt", async () => {
    let calls = 0;
    const result = await runWithRetry(
      async () => {
        calls++;
        return "success";
      },
      { maxAttempts: 3, timeoutMs: 1000 }
    );
    expect(result).toBe("success");
    expect(calls).toBe(1);
  });

  it("retries and succeeds on second attempt", async () => {
    let calls = 0;
    const result = await runWithRetry(
      async () => {
        calls++;
        if (calls === 1) throw new Error("first fail");
        return "recovered";
      },
      { maxAttempts: 3, timeoutMs: 1000 }
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("throws after exhausting all attempts", async () => {
    let calls = 0;
    await expect(
      runWithRetry(
        async () => {
          calls++;
          throw new Error(`fail ${calls}`);
        },
        { maxAttempts: 2, timeoutMs: 1000 }
      )
    ).rejects.toThrow("fail 2");
    expect(calls).toBe(2);
  });

  it("wraps non-Error throws", async () => {
    await expect(
      runWithRetry(
        async () => {
          throw "string error";
        },
        { maxAttempts: 1, timeoutMs: 1000 }
      )
    ).rejects.toThrow("string error");
  });
});
