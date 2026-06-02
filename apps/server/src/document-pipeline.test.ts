import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { DocumentPipeline } from "./document-pipeline.js";

describe("DocumentPipeline", () => {
  it("reads local storageUri content before parsing a source", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zhixu-doc-"));
    try {
      const filePath = join(dir, "notes.md");
      writeFileSync(filePath, "# Real Notes\n\n- Evidence from the uploaded file", "utf-8");

      const output = await new DocumentPipeline().parseSource({
        id: "source_local_md",
        projectId: "project_course_presentation",
        uploadedBy: "user_demo",
        fileName: "notes.md",
        fileType: "text/markdown",
        storageUri: filePath,
        parseStatus: "queued",
        ocrStatus: "pending",
        indexStatus: "pending",
        sensitivityLevel: "normal",
        createdAt: new Date().toISOString()
      });

      expect(output.structuredResult).toMatchObject({
        document: {
          title: "Real Notes",
          nodes: expect.arrayContaining([
            expect.objectContaining({ text: "Real Notes" }),
            expect.objectContaining({ text: "Evidence from the uploaded file" })
          ])
        }
      });
      expect(JSON.stringify(output.structuredResult)).not.toContain("Parsed placeholder");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
