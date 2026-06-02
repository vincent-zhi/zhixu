import type { WorkflowDefinition } from "@zhixu/agent-harness";

export const coursePresentationWorkflow: WorkflowDefinition = {
  id: "course_presentation",
  name: "课程 PPT 汇报",
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
      ref: "presentation.createCourseBrief",
      inputKeys: ["understanding", "sources", "dueDate", "presentationDuration"],
      outputKey: "brief",
      policy: { timeoutMs: 10000, maxAttempts: 1, riskLevel: "L0" }
    },
    {
      id: "topic_candidates",
      type: "agent",
      ref: "presentation.generateTopicCandidates",
      inputKeys: ["brief"],
      outputKey: "topicCandidates",
      policy: { timeoutMs: 30000, maxAttempts: 2, riskLevel: "L1" }
    },
    {
      id: "select_topic",
      type: "human_gate",
      ref: "presentation.selectTopic",
      inputKeys: ["topicCandidates"],
      outputKey: "selectedTopicId",
      policy: { timeoutMs: 86400000, maxAttempts: 1, riskLevel: "L1" }
    },
    {
      id: "slide_outline",
      type: "agent",
      ref: "presentation.generateSlideOutline",
      inputKeys: ["selectedTopicId", "brief"],
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
      id: "verification",
      type: "verifier",
      ref: "presentation.verifyEvidence",
      inputKeys: ["slidePlans", "speakerNotes"],
      outputKey: "verificationResult",
      policy: { timeoutMs: 15000, maxAttempts: 1, riskLevel: "L1" }
    }
  ],
  edges: [
    { from: "understanding", to: "brief" },
    { from: "brief", to: "topic_candidates" },
    { from: "topic_candidates", to: "select_topic" },
    { from: "select_topic", to: "slide_outline" },
    { from: "slide_outline", to: "speaker_notes" },
    { from: "speaker_notes", to: "verification" }
  ]
};
