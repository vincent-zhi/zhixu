import type { TraceabilityReport, TraceabilitySection } from "./types.js";

export class TraceabilityReporter {
  generateReport(input: {
    projectId: string;
    artifactId: string;
    blocks: Array<{
      responsibilityColor: string;
      verificationStatus: string;
      evidenceRefs: string[];
    }>;
    citations: Array<{ verificationStatus: string }>;
  }): TraceabilityReport {
    const { projectId, artifactId, blocks, citations } = input;

    const totalBlocks = blocks.length;
    const greenBlocks = blocks.filter((b) => b.responsibilityColor === "green").length;
    const yellowBlocks = blocks.filter((b) => b.responsibilityColor === "yellow").length;
    const grayBlocks = blocks.filter((b) => b.responsibilityColor === "gray").length;

    const greenRatio = totalBlocks > 0 ? greenBlocks / totalBlocks : 0;
    const yellowRatio = totalBlocks > 0 ? yellowBlocks / totalBlocks : 0;
    const grayRatio = totalBlocks > 0 ? grayBlocks / totalBlocks : 0;

    const unverifiedCitations = citations.filter(
      (c) => c.verificationStatus === "unverified" || c.verificationStatus === "failed"
    ).length;

    const highRiskItems = blocks.filter(
      (b) => b.responsibilityColor === "gray" && b.verificationStatus !== "verified"
    ).length;

    const unverifiedBlocks = blocks.filter((b) => b.verificationStatus !== "verified").length;
    const lowEvidenceBlocks = blocks.filter((b) => b.evidenceRefs.length === 0).length;

    const overallCompliance = totalBlocks > 0
      ? (greenBlocks * 1 + yellowBlocks * 0.5 + grayBlocks * 0) / totalBlocks
      : 0;

    const sections: TraceabilitySection[] = [
      {
        title: "Responsibility Distribution",
        content: `Green: ${greenBlocks}, Yellow: ${yellowBlocks}, Gray: ${grayBlocks}`,
        data: { green: greenBlocks, yellow: yellowBlocks, gray: grayBlocks, total: totalBlocks },
      },
      {
        title: "Verification Status",
        content: `Verified blocks: ${totalBlocks - unverifiedBlocks}, Unverified: ${unverifiedBlocks}`,
        data: { verified: totalBlocks - unverifiedBlocks, unverified: unverifiedBlocks },
      },
      {
        title: "Evidence Coverage",
        content: `Blocks with evidence: ${totalBlocks - lowEvidenceBlocks}, Without evidence: ${lowEvidenceBlocks}`,
        data: { withEvidence: totalBlocks - lowEvidenceBlocks, withoutEvidence: lowEvidenceBlocks },
      },
      {
        title: "Citation Status",
        content: `Total citations: ${citations.length}, Unverified: ${unverifiedCitations}`,
        data: { total: citations.length, unverified: unverifiedCitations },
      },
    ];

    return {
      id: crypto.randomUUID(),
      projectId,
      artifactId,
      generatedAt: new Date().toISOString(),
      sections,
      overallCompliance,
      greenRatio,
      yellowRatio,
      grayRatio,
      unverifiedCitations,
      highRiskItems,
    };
  }
}
