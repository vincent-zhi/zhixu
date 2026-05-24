import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("parses required infrastructure settings", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/zhixu"
    });

    expect(env.API_PORT).toBe(4000);
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.S3_BUCKET).toBe("zhixu-local");
  });

  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
