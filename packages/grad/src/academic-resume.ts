import type { AcademicResume, ResumeSection } from "./types.js";

const SCENE_PRIORITIES: Record<string, ResumeSection["type"][]> = {
  job: ["education", "publications", "experiments", "skills", "competitions", "awards", "grants", "presentations"],
  grad_school: ["education", "publications", "experiments", "awards", "grants", "skills", "presentations", "competitions"],
  scholarship: ["education", "publications", "awards", "grants", "experiments", "skills", "presentations", "competitions"],
  conference: ["publications", "presentations", "experiments", "education", "skills", "awards", "grants", "competitions"],
};

export class AcademicResumeBuilder {
  createResume(userId: string): AcademicResume {
    return {
      id: crypto.randomUUID(),
      userId,
      sections: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  addSection(resume: AcademicResume, section: ResumeSection): AcademicResume {
    const existing = resume.sections.findIndex((s) => s.type === section.type);
    if (existing >= 0) {
      const updated = { ...resume };
      updated.sections = [...updated.sections];
      updated.sections[existing] = section;
      updated.lastUpdated = new Date().toISOString();
      return updated;
    }

    return {
      ...resume,
      sections: [...resume.sections, section],
      lastUpdated: new Date().toISOString(),
    };
  }

  generateForScene(
    resume: AcademicResume,
    scene: "job" | "grad_school" | "scholarship" | "conference",
  ): ResumeSection[] {
    const priorities = SCENE_PRIORITIES[scene] ?? SCENE_PRIORITIES["job"]!;
    const sectionMap = new Map(resume.sections.map((s) => [s.type, s]));

    const result: ResumeSection[] = [];
    for (const type of priorities) {
      const section = sectionMap.get(type);
      if (section) {
        result.push(section);
      }
    }

    for (const section of resume.sections) {
      if (!result.some((r) => r.type === section.type)) {
        result.push(section);
      }
    }

    return result;
  }
}
