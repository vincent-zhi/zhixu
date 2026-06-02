import type { WorkflowDefinition } from "@zhixu/agent-harness";

export const labMeetingWorkflow: WorkflowDefinition = {
  id: "lab_meeting",
  name: "硕士组会论文汇报",
  version: 1,
  startNodeId: "understanding",
  stateSchemaVersion: 1,
  nodes: [
    {
      id: "understanding",
      type: "agent",
      ref: "understanding.analyze",
      inputKeys: ["rawInput", "sources", "dueDate"],
      outputKey: "understanding",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L0" }
    },
    {
      id: "brief",
      type: "agent",
      ref: "presentation.createLabBrief",
      inputKeys: ["understanding", "sources", "dueDate", "presentationDuration"],
      outputKey: "brief",
      policy: { timeoutMs: 10000, maxAttempts: 1, riskLevel: "L0" }
    },
    {
      id: "paper_reading_group",
      type: "parallel",
      ref: "paper.readAllPapers",
      inputKeys: ["sources"],
      outputKey: "paperCards",
      policy: { timeoutMs: 120000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "matrix_generation",
      type: "agent",
      ref: "paper.generateComparisonMatrix",
      inputKeys: ["paperCards"],
      outputKey: "comparisonMatrix",
      policy: { timeoutMs: 45000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "presentation_paths",
      type: "agent",
      ref: "paper.generatePresentationPaths",
      inputKeys: ["comparisonMatrix"],
      outputKey: "presentationPaths",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "select_path",
      type: "human_gate",
      ref: "presentation.selectPath",
      inputKeys: ["presentationPaths"],
      outputKey: "selectedPathId",
      policy: { timeoutMs: 86400000, maxAttempts: 1, riskLevel: "L1" }
    },
    {
      id: "slide_outline",
      type: "agent",
      ref: "presentation.generateLabSlideOutline",
      inputKeys: ["selectedPathId", "presentationPaths", "brief"],
      outputKey: "slidePlans",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "speaker_notes",
      type: "agent",
      ref: "presentation.generateSpeakerNotes",
      inputKeys: ["slidePlans", "brief"],
      outputKey: "speakerNotes",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "advisor_questions",
      type: "agent",
      ref: "paper.generateAdvisorQuestions",
      inputKeys: ["paperCards", "comparisonMatrix"],
      outputKey: "advisorQuestions",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "verification",
      type: "verifier",
      ref: "presentation.verifyEvidence",
      inputKeys: ["slidePlans", "speakerNotes", "advisorQuestions"],
      outputKey: "verificationResult",
      policy: { timeoutMs: 15000, maxAttempts: 1, riskLevel: "L1" }
    }
  ],
  edges: [
    { from: "understanding", to: "brief" },
    { from: "brief", to: "paper_reading_group" },
    { from: "paper_reading_group", to: "matrix_generation" },
    { from: "matrix_generation", to: "presentation_paths" },
    { from: "presentation_paths", to: "select_path" },
    { from: "select_path", to: "slide_outline" },
    { from: "slide_outline", to: "speaker_notes" },
    { from: "speaker_notes", to: "advisor_questions" },
    { from: "advisor_questions", to: "verification" }
  ]
};
