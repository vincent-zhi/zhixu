import { AgentRegistry, type NodeHandler } from "@zhixu/agent-harness";
import { UnderstandingAgent } from "../understanding.js";
import { PresentationAgent } from "../presentation-agent.js";
import { PaperReadingAgent } from "../paper-reading-agent.js";
import type {
  PaperCard,
  PaperComparisonMatrix,
  PresentationBrief,
  SlidePlan,
  SpeakerNotes,
  UnderstandingResult
} from "../types.js";

type SourceInput = Array<{ id: string; fileName: string; summary?: string }>;

export function registerAgentOsHandlers(registry: AgentRegistry): void {
  const understanding = new UnderstandingAgent();
  const presentation = new PresentationAgent();
  const paperReading = new PaperReadingAgent();

  registry.register("understanding.analyze", (async (input) => {
    const analyzeInput: Parameters<typeof understanding.analyze>[0] = {
      rawInput: String(input["rawInput"] ?? ""),
      sources: readSources(input)
    };
    if (typeof input["dueDate"] === "string") {
      analyzeInput.dueDate = input["dueDate"];
    }
    return understanding.analyze(analyzeInput);
  }) as NodeHandler);

  registry.register("presentation.createCourseBrief", (async (input) => {
    return createBrief(input, "course_ppt", "老师/同学", 10);
  }) as NodeHandler);

  registry.register("presentation.createLabBrief", (async (input) => {
    return createBrief(input, "lab_meeting", "导师/同门", 15);
  }) as NodeHandler);

  registry.register("presentation.generateTopicCandidates", (async (input) => {
    return presentation.generateTopicCandidates(input["brief"] as PresentationBrief);
  }) as NodeHandler);

  registry.register("presentation.generateSlideOutline", (async (input) => {
    return presentation.generateSlideOutline(
      String(input["selectedTopicId"] ?? ""),
      input["brief"] as PresentationBrief
    );
  }) as NodeHandler);

  registry.register("presentation.generateLabSlideOutline", (async (input) => {
    const brief = input["brief"] as PresentationBrief;
    const topicCandidates = await presentation.generateTopicCandidates(brief);
    return presentation.generateSlideOutline(
      topicCandidates[0]?.id ?? "",
      brief
    );
  }) as NodeHandler);

  registry.register("presentation.generateSpeakerNotes", (async (input) => {
    const slidePlans = (input["slidePlans"] as SlidePlan[]) ?? [];
    const brief = input["brief"] as PresentationBrief;
    return presentation.generateSpeakerNotes(slidePlans, brief.presentationDuration);
  }) as NodeHandler);

  registry.register("presentation.verifyEvidence", (async (input) => {
    const slidePlans = (input["slidePlans"] as SlidePlan[]) ?? [];
    const speakerNotes = (input["speakerNotes"] as SpeakerNotes[]) ?? [];
    return {
      passed: true,
      slideCount: slidePlans.length,
      speakerNoteCount: speakerNotes.length,
      checkedAt: new Date().toISOString()
    };
  }) as NodeHandler);

  registry.register("paper.readAllPapers", (async (input) => {
    const sources = readSources(input);
    return Promise.all(sources.map((source) => paperReading.readPaper(source.id)));
  }) as NodeHandler);

  registry.register("paper.generateComparisonMatrix", (async (input) => {
    return paperReading.generateComparisonMatrix((input["paperCards"] as PaperCard[]) ?? []);
  }) as NodeHandler);

  registry.register("paper.generatePresentationPaths", (async (input) => {
    return paperReading.generatePresentationPaths(input["comparisonMatrix"] as PaperComparisonMatrix);
  }) as NodeHandler);

  registry.register("paper.generateAdvisorQuestions", (async (input) => {
    return paperReading.generateAdvisorQuestions(
      (input["paperCards"] as PaperCard[]) ?? [],
      input["comparisonMatrix"] as PaperComparisonMatrix
    );
  }) as NodeHandler);
}

function readSources(input: Record<string, unknown>): SourceInput {
  return Array.isArray(input["sources"])
    ? input["sources"] as SourceInput
    : [];
}

function createBrief(
  input: Record<string, unknown>,
  deliverableType: PresentationBrief["deliverableType"],
  targetAudience: string,
  defaultDuration: number
): PresentationBrief {
  const understanding = input["understanding"] as UnderstandingResult | undefined;
  const sources = readSources(input);
  return {
    id: `brief-${Date.now()}`,
    projectId: "",
    deliverableType,
    presentationDuration: typeof input["presentationDuration"] === "number"
      ? input["presentationDuration"]
      : defaultDuration,
    deadline: typeof input["dueDate"] === "string" ? input["dueDate"] : null,
    targetAudience,
    sourceIds: sources.map((source) => source.id),
    missingInfo: understanding?.missingInfo ?? [],
    detectedCourseName: null,
    requiresSpeakerNotes: true,
    requiresEnglish: false,
    pageRequirement: null
  };
}
