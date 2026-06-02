import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { SenseNovaSkillMeta } from "./sensenova-skill-loader.js";

export interface SenseNovaSkillInvokeBody {
  script?: string;
  args?: unknown[];
  query?: string;
  platforms?: string[];
  limit?: number;
}

export interface SenseNovaScriptResult {
  mode: "python_script";
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  json?: unknown;
}

export interface SenseNovaSkillInvocationResult {
  skill: {
    name: string;
    description: string;
    skillDir: string;
    skillMdPath: string;
  };
  explicitContext: {
    agentSkillsFramework: "SKILL.md";
    skillName: string;
    description: string;
    instructionExcerpt: string;
  };
  execution:
    | SenseNovaScriptResult
    | {
        mode: "agent_skill_instructions";
        status: "ready";
        message: string;
      }
    | {
        mode: "academic_search";
        query: string;
        results: SenseNovaScriptResult[];
      };
}

export async function invokeSenseNovaSkill(
  skill: SenseNovaSkillMeta,
  body: SenseNovaSkillInvokeBody
): Promise<SenseNovaSkillInvocationResult> {
  const explicitContext = {
    agentSkillsFramework: "SKILL.md" as const,
    skillName: skill.name,
    description: skill.description,
    instructionExcerpt: skill.body.slice(0, 4000),
  };

  let execution: SenseNovaSkillInvocationResult["execution"];

  if (body.script) {
    execution = await runSkillPythonScript(skill, body.script, normalizeArgs(body.args));
  } else if (skill.name === "sn-search-academic" && typeof body.query === "string" && body.query.trim()) {
    execution = await runAcademicSearch(skill, body.query, body.platforms, body.limit);
  } else {
    execution = {
      mode: "agent_skill_instructions",
      status: "ready",
      message: "Skill instructions are loaded explicitly. Invoke again with `script` and `args`, or use a supported adapter such as sn-search-academic with `query`.",
    };
  }

  return {
    skill: {
      name: skill.name,
      description: skill.description,
      skillDir: skill.skillDir,
      skillMdPath: skill.skillMdPath,
    },
    explicitContext,
    execution,
  };
}

async function runAcademicSearch(
  skill: SenseNovaSkillMeta,
  query: string,
  platforms: string[] | undefined,
  limit: number | undefined
): Promise<{ mode: "academic_search"; query: string; results: SenseNovaScriptResult[] }> {
  const wanted = new Set((platforms?.length ? platforms : ["arxiv"]).map((p) => p.toLowerCase()));
  const scriptByPlatform: Array<[string, string]> = [
    ["arxiv", "scripts/arxiv_search.py"],
    ["semantic_scholar", "scripts/semantic_scholar_search.py"],
    ["semantic-scholar", "scripts/semantic_scholar_search.py"],
    ["pubmed", "scripts/pubmed_search.py"],
    ["wikipedia", "scripts/wikipedia_search.py"],
  ];

  const scripts = scriptByPlatform
    .filter(([platform]) => wanted.has(platform))
    .map(([, script]) => script);
  const uniqueScripts = Array.from(new Set(scripts.length > 0 ? scripts : ["scripts/arxiv_search.py"]));
  const args = [query, "--limit", String(Math.max(1, Math.min(limit ?? 5, 20)))];

  const results = [];
  for (const script of uniqueScripts) {
    results.push(await runSkillPythonScript(skill, script, args));
  }

  return { mode: "academic_search", query, results };
}

function normalizeArgs(args: unknown[] | undefined): string[] {
  return (args ?? []).map((arg) => {
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
    return JSON.stringify(arg);
  });
}

function resolveScriptPath(skill: SenseNovaSkillMeta, script: string): string {
  if (isAbsolute(script)) {
    throw new Error("Absolute script paths are not allowed");
  }

  const skillDir = resolve(skill.skillDir);
  const scriptPath = resolve(skillDir, script);
  const rel = relative(skillDir, scriptPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Script path must stay inside the skill directory");
  }
  if (!existsSync(scriptPath)) {
    throw new Error(`Script not found: ${script}`);
  }
  if (!scriptPath.endsWith(".py")) {
    throw new Error("Only Python skill scripts are supported for direct invocation");
  }
  return scriptPath;
}

function runSkillPythonScript(
  skill: SenseNovaSkillMeta,
  script: string,
  args: string[]
): Promise<SenseNovaScriptResult> {
  const scriptPath = resolveScriptPath(skill, script);
  const command = process.env.PYTHON ?? "python";

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, [scriptPath, ...args], {
      cwd: skill.skillDir,
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const result: SenseNovaScriptResult = {
        mode: "python_script",
        command,
        args: [scriptPath, ...args],
        cwd: skill.skillDir,
        exitCode,
        stdout,
        stderr,
      };
      try {
        result.json = JSON.parse(stdout);
      } catch {
        // Plain-text scripts are still valid skill executions.
      }
      resolvePromise(result);
    });
  });
}
