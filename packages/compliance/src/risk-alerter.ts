import type { RiskAlert } from "./types.js";

export class RiskAlerter {
  scanProject(project: {
    id: string;
    type: string;
    artifacts: Array<{
      blocks: Array<{
        responsibilityColor: string;
        contentJson: Record<string, unknown>;
      }>;
    }>;
    citations: Array<{ verificationStatus: string }>;
  }): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const now = new Date().toISOString();

    const unverifiedCitations = project.citations.filter(
      (c) => c.verificationStatus === "unverified" || c.verificationStatus === "failed"
    );
    if (unverifiedCitations.length > 0) {
      alerts.push({
        id: crypto.randomUUID(),
        projectId: project.id,
        riskType: "fabricated_citation",
        severity: unverifiedCitations.length >= 3 ? "L3" : "L2",
        description: `${unverifiedCitations.length} unverified or failed citation(s) detected`,
        evidence: unverifiedCitations.map((c) => `Citation with status: ${c.verificationStatus}`),
        timestamp: now,
        dismissed: false,
      });
    }

    for (const artifact of project.artifacts) {
      for (const block of artifact.blocks) {
        if (block.responsibilityColor === "gray") {
          const contentStr = JSON.stringify(block.contentJson);
          const hasData = contentStr.includes("data") || contentStr.includes("result") || contentStr.includes("figure") || contentStr.includes("table");
          if (hasData) {
            alerts.push({
              id: crypto.randomUUID(),
              projectId: project.id,
              riskType: "fabricated_data",
              severity: "L3",
              description: "Data block with gray (unverified) responsibility color detected",
              evidence: [`Block with responsibilityColor=gray contains data-related content`],
              timestamp: now,
              dismissed: false,
            });
          }
        }

        const contentStr = JSON.stringify(block.contentJson).toLowerCase();
        const sensitivePatterns = ["password", "secret", "api_key", "token", "private_key", "credential"];
        for (const pattern of sensitivePatterns) {
          if (contentStr.includes(pattern)) {
            alerts.push({
              id: crypto.randomUUID(),
              projectId: project.id,
              riskType: "sensitive_upload",
              severity: "L2",
              description: `Potentially sensitive content detected: ${pattern}`,
              evidence: [`Content contains pattern: ${pattern}`],
              timestamp: now,
              dismissed: false,
            });
            break;
          }
        }
      }
    }

    if (project.type === "exam" || project.type === "exam_prep") {
      const hasAutoSubmit = project.artifacts.some((a) =>
        a.blocks.some((b) => JSON.stringify(b.contentJson).toLowerCase().includes("auto_submit") || JSON.stringify(b.contentJson).toLowerCase().includes("auto submit"))
      );
      if (hasAutoSubmit) {
        alerts.push({
          id: crypto.randomUUID(),
          projectId: project.id,
          riskType: "auto_submission",
          severity: "L3",
          description: "Auto-submission detected in exam-related project",
          evidence: ["Artifact contains auto-submission trigger"],
          timestamp: now,
          dismissed: false,
        });
      }
    }

    return alerts;
  }
}
