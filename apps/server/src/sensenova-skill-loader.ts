import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SenseNovaSkillMeta {
  name: string;
  description: string;
  skillDir: string;
  skillMdPath: string;
  body: string; // full markdown body after frontmatter
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Simple parser — does not use a YAML library for speed.
 * Extracts `name` and `description` fields from between --- delimiters.
 */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: {}, body: content };

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (let i = 1; i < endIndex; i++) {
    const line = lines[i]!;
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      meta[key] = value;
    }
  }

  const body = lines.slice(endIndex + 1).join("\n").trim();
  return { meta, body };
}

/**
 * Discover all SenseNova skills from the skills/sensenova directory.
 * Returns metadata + full SKILL.md body for each skill.
 */
export function loadSenseNovaSkills(skillsRoot?: string): SenseNovaSkillMeta[] {
  const root = skillsRoot ?? join(process.cwd(), "skills", "sensenova");
  if (!existsSync(root)) return [];

  const skills: SenseNovaSkillMeta[] = [];
  const dirs = readdirSync(root, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const skillMdPath = join(root, dir.name, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    try {
      const content = readFileSync(skillMdPath, "utf-8");
      const { meta, body } = parseFrontmatter(content);
      if (!meta.name) continue;

      skills.push({
        name: meta.name,
        description: meta.description ?? "",
        skillDir: join(root, dir.name),
        skillMdPath,
        body,
      });
    } catch {
      // skip unreadable files
    }
  }

  return skills;
}

/**
 * Get a summary of all available SenseNova skills (name + description only).
 * Suitable for passing to LLM as tool context without loading full content.
 */
export function getSenseNovaSkillsSummary(skillsRoot?: string): Array<{ name: string; description: string }> {
  return loadSenseNovaSkills(skillsRoot).map(s => ({
    name: s.name,
    description: s.description,
  }));
}

/**
 * Get full skill content by name.
 * Returns the complete SKILL.md body for the specified skill.
 */
export function getSenseNovaSkillDetail(skillName: string, skillsRoot?: string): SenseNovaSkillMeta | undefined {
  return loadSenseNovaSkills(skillsRoot).find(s => s.name === skillName);
}
