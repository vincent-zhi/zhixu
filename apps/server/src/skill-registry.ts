import { BUILTIN_SKILLS, type SkillManifest } from "@zhixu/skill-runtime";

export class SkillRegistry {
  private skills: Map<string, SkillManifest>;

  constructor() {
    this.skills = new Map(BUILTIN_SKILLS.map((s) => [s.id, s]));
  }

  listSkills(): SkillManifest[] {
    return BUILTIN_SKILLS.map((skill) => ({ ...skill }));
  }

  getSkill(skillId: string): SkillManifest | undefined {
    const skill = this.skills.get(skillId);
    return skill ? { ...skill } : undefined;
  }

  getSkillManifest(id: string): SkillManifest | undefined {
    const skill = this.skills.get(id);
    return skill ? { ...skill } : undefined;
  }
}
