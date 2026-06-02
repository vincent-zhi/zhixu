import { describe, expect, it } from "vitest";
import { ToolRegistryAdapter } from "./tool-registry-adapter.js";

describe("ToolRegistryAdapter", () => {
  it("adapts existing model-gateway style tools into node handlers", async () => {
    const adapter = new ToolRegistryAdapter({
      async callTool(name, input) {
        return { name, input };
      },
      listTools() {
        return ["create_artifact"];
      }
    });

    expect(adapter.has("tool.create_artifact")).toBe(true);
    await expect(adapter.get("tool.create_artifact")({ title: "Deck" })).resolves.toEqual({
      name: "create_artifact",
      input: { title: "Deck" }
    });
  });

  it("throws a clear error for unsupported tool refs", () => {
    const adapter = new ToolRegistryAdapter({
      async callTool() {
        return null;
      },
      listTools() {
        return [];
      }
    });

    expect(() => adapter.get("tool.missing")).toThrow("Tool handler not found: tool.missing");
  });
});
