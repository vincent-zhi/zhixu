import type { MeetingBrief } from "./types.js";

const MEETING_TEMPLATES: Record<MeetingBrief["meetingType"], {
  keyPointTemplates: string[];
  slideTemplates: string[];
  questionTemplates: string[];
  checklistTemplates: string[];
}> = {
  group_meeting: {
    keyPointTemplates: [
      "Progress update since last meeting",
      "Current blockers and challenges",
      "Next steps and action items",
    ],
    slideTemplates: [
      "Progress Overview",
      "Key Results",
      "Challenges & Blockers",
      "Next Steps",
    ],
    questionTemplates: [
      "How does this relate to other group projects?",
      "What resources do you need?",
      "What is your timeline for the next milestone?",
    ],
    checklistTemplates: [
      "Prepare progress summary",
      "List current blockers",
      "Draft next steps",
      "Review previous meeting notes",
    ],
  },
  advising: {
    keyPointTemplates: [
      "Research direction and progress",
      "Feedback sought from advisor",
      "Decisions requiring advisor input",
    ],
    slideTemplates: [
      "Research Direction",
      "Recent Findings",
      "Questions for Advisor",
      "Proposed Next Steps",
    ],
    questionTemplates: [
      "Is my research direction appropriate?",
      "What literature should I prioritize?",
      "How should I interpret these results?",
    ],
    checklistTemplates: [
      "Summarize research progress",
      "Prepare specific questions",
      "Bring relevant data/results",
      "Review advisor's recent suggestions",
    ],
  },
  defense_prep: {
    keyPointTemplates: [
      "Core arguments and contributions",
      "Anticipated committee questions",
      "Weak areas to strengthen",
    ],
    slideTemplates: [
      "Research Motivation",
      "Methodology",
      "Key Results",
      "Contributions",
      "Future Work",
    ],
    questionTemplates: [
      "What is your main contribution?",
      "How does this advance the field?",
      "What are the limitations?",
      "How would you address concerns about your methodology?",
    ],
    checklistTemplates: [
      "Review thesis/dissertation thoroughly",
      "Practice presentation timing",
      "Prepare for common defense questions",
      "Review committee members' research areas",
      "Prepare backup slides for detailed questions",
    ],
  },
  progress_update: {
    keyPointTemplates: [
      "Milestone status",
      "Timeline adherence",
      "Risk items and mitigation",
    ],
    slideTemplates: [
      "Milestone Status",
      "Timeline & Gantt",
      "Risks & Mitigation",
      "Upcoming Deliverables",
    ],
    questionTemplates: [
      "Are we on track for the next milestone?",
      "What risks should we be aware of?",
      "Do we need to adjust the timeline?",
    ],
    checklistTemplates: [
      "Update project status",
      "Review timeline",
      "Identify new risks",
      "Prepare status metrics",
    ],
  },
};

export class MeetingBriefer {
  generateBrief(input: {
    projectId: string;
    meetingType: MeetingBrief["meetingType"];
    recentProgress: string[];
    upcomingDeadlines: string[];
  }): MeetingBrief {
    const template = MEETING_TEMPLATES[input.meetingType];

    const keyPoints = [...template.keyPointTemplates];
    for (const progress of input.recentProgress.slice(0, 3)) {
      keyPoints.push(`Recent: ${progress}`);
    }

    const suggestedSlides = [...template.slideTemplates];

    const anticipatedQuestions = [...template.questionTemplates];
    for (const deadline of input.upcomingDeadlines.slice(0, 2)) {
      anticipatedQuestions.push(`What is the status of the upcoming deadline: ${deadline}?`);
    }

    const preparationChecklist = [...template.checklistTemplates];
    if (input.upcomingDeadlines.length > 0) {
      preparationChecklist.push("Review upcoming deadlines and status");
    }

    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      meetingType: input.meetingType,
      keyPoints,
      suggestedSlides,
      anticipatedQuestions,
      preparationChecklist,
    };
  }
}
