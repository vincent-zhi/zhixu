import type { ProcrastinationAdapter, MicroTask } from "./types.js";

export class ProcrastinationAdapterEngine {
  analyze(input: { projectId: string; currentDelay: number; taskTitle: string }): ProcrastinationAdapter {
    const { projectId, currentDelay, taskTitle } = input;

    let suggestedApproach: ProcrastinationAdapter["suggestedApproach"];
    let motivationMessage: string;

    if (currentDelay <= 1) {
      suggestedApproach = "gentle_nudge";
      motivationMessage = "You're only slightly behind. A small push now will get you back on track!";
    } else if (currentDelay <= 3) {
      suggestedApproach = "micro_task";
      motivationMessage = "Let's break this into tiny steps. Just start with the first one!";
    } else if (currentDelay <= 7) {
      suggestedApproach = "break_down";
      motivationMessage = "The task may feel overwhelming. Let's decompose it into manageable pieces.";
    } else if (currentDelay <= 14) {
      suggestedApproach = "deadline_reframe";
      motivationMessage = "Let's reframe the deadline to create urgency without panic.";
    } else {
      suggestedApproach = "accountability";
      motivationMessage = "It's time to bring in accountability. Share your commitment with someone.";
    }

    const microTasks = this.generateMicroTasks(taskTitle, currentDelay);

    return {
      id: crypto.randomUUID(),
      projectId,
      currentDelay,
      suggestedApproach,
      microTasks,
      motivationMessage,
    };
  }

  generateMicroTasks(taskTitle: string, delay: number): MicroTask[] {
    const tasks: MicroTask[] = [];
    const steps = [
      { title: `Open the document for "${taskTitle}"`, minutes: 5 },
      { title: `List key requirements for "${taskTitle}"`, minutes: 10 },
      { title: `Draft an outline for "${taskTitle}"`, minutes: 10 },
      { title: `Write the first section`, minutes: 15 },
      { title: `Review and refine the first section`, minutes: 10 },
    ];

    if (delay > 3) {
      steps.splice(1, 0, { title: `Set a 15-minute timer for "${taskTitle}"`, minutes: 5 });
    }

    if (delay > 7) {
      steps.push({ title: `Share progress with accountability partner`, minutes: 5 });
    }

    for (const step of steps) {
      tasks.push({
        id: crypto.randomUUID(),
        title: step.title,
        estimatedMinutes: step.minutes,
        completed: false,
      });
    }

    return tasks;
  }
}
