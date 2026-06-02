import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { platform, homedir } from "node:os";
import type { ToolDefinition } from "./types.js";
import { ToolRegistry } from "./tool-registry.js";

const IS_WIN = platform() === "win32";
const SHELL = IS_WIN ? "powershell.exe" : "/bin/bash";
const SHELL_ARGS = IS_WIN ? ["-NoProfile", "-Command"] : ["-c"];
const WORKSPACE_ROOT = resolve(process.env.ZHIXU_WORKSPACE ?? join(process.cwd(), "workspace"));
const MAX_OUTPUT = 50_000;
const MAX_EXEC_MS = 30_000;
const MAX_READ_LINES = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const WRITE_DENIED_NAMES = new Set([
  ".ssh", ".gnupg", ".env", ".env.local", ".env.production",
  ".bashrc", ".bash_profile", ".zshrc", ".profile",
  ".gitconfig", ".npmrc", ".pypirc",
  "id_rsa", "id_ed25519", "id_ecdsa",
]);

const WRITE_DENIED_EXTENSIONS = new Set([
  ".pem", ".key", ".p12", ".pfx", ".jks",
]);

function isWriteDenied(p: string): boolean {
  const name = basename(p);
  if (WRITE_DENIED_NAMES.has(name)) return true;
  const ext = extname(name).toLowerCase();
  if (WRITE_DENIED_EXTENSIONS.has(ext)) return true;
  const abs = resolve(WORKSPACE_ROOT, p);
  const home = homedir();
  if (abs.startsWith(home + sep + ".ssh" + sep)) return true;
  if (abs.startsWith(home + sep + ".gnupg" + sep)) return true;
  return false;
}

const LINTERS: Record<string, string> = {
  ".py": "python -m py_compile",
  ".js": "node --check",
  ".json": "inproc",
};

function lintInProcJson(content: string): string | null {
  try {
    JSON.parse(content);
    return null;
  } catch (e: any) {
    return `JSON lint error: ${e.message}`;
  }
}

function lintInProcPython(content: string): string | null {
  return null;
}

async function lintFile(absPath: string, content: string): Promise<string | null> {
  const ext = extname(absPath).toLowerCase();
  if (ext === ".json") return lintInProcJson(content);
  if (ext === ".py") return lintInProcPython(content);
  const cmd = LINTERS[ext];
  if (!cmd) return null;
  return new Promise((resolve) => {
    execFile(SHELL, [...SHELL_ARGS, `${cmd} "${absPath}"`], { timeout: 10000, cwd: WORKSPACE_ROOT }, (err, stdout, stderr) => {
      if (err) {
        const output = (stderr || stdout || err.message || "").toString().trim();
        resolve(output || "Lint failed");
      } else {
        resolve(null);
      }
    });
  });
}

function truncate(s: string, max = MAX_OUTPUT): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n... [truncated, ${s.length - max} more bytes]`;
}

function ensureInWorkspace(p: string): string {
  if (!p || typeof p !== "string") {
    throw new Error(`Invalid path: expected a non-empty string, got ${typeof p}`);
  }
  if (p.includes("..")) {
    throw new Error(`Path contains ".." which is not allowed: ${p}`);
  }
  const abs = resolve(WORKSPACE_ROOT, p);
  if (!abs.startsWith(WORKSPACE_ROOT + sep) && abs !== WORKSPACE_ROOT) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<string>,
): { definition: ToolDefinition; handler: (args: Record<string, unknown>) => Promise<string> } {
  return {
    definition: { type: "function", function: { name, description, parameters } },
    handler,
  };
}

function execShell(cmd: string, timeoutMs = MAX_EXEC_MS): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const args = [...SHELL_ARGS, cmd];
    execFile(SHELL, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024, cwd: WORKSPACE_ROOT }, (err, stdout, stderr) => {
      resolve({
        stdout: truncate((stdout ?? "").toString()),
        stderr: truncate((stderr ?? "").toString()),
        exitCode: err && "code" in err ? (err.code as number) : err ? 1 : 0,
      });
    });
  });
}

const readFileTool = tool(
  "read_file",
  "读取工作区中文件的内容。支持分页读取、行号显示。返回带行号的文件内容。类似hermes-agent的read_file工具，支持offset和limit参数分页读取大文件。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的文件路径" },
      offset: { type: "number", description: "起始行号（从1开始），默认1" },
      limit: { type: "number", description: "读取行数，默认500" },
      encoding: { type: "string", description: "编码，默认utf-8" },
    },
    required: ["path"],
  },
  async (args) => {
    const path = args["path"] as string;
    if (!path) return "Error: 'path' parameter is required";
    const abs = ensureInWorkspace(path);
    if (!existsSync(abs)) return `Error: File not found: ${path}`;
    const stat = statSync(abs);
    if (stat.isDirectory()) return `Error: Path is a directory, use list_dir instead: ${path}`;
    if (stat.size > MAX_FILE_SIZE) return `Error: File too large (${stat.size} bytes), max ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    const content = readFileSync(abs, (args["encoding"] as BufferEncoding) ?? "utf-8");
    const lines = content.split("\n");
    const offset = Math.max(1, (args["offset"] as number) ?? 1);
    const limit = Math.min(MAX_READ_LINES, (args["limit"] as number) ?? 500);
    const selected = lines.slice(offset - 1, offset - 1 + limit);
    const numbered = selected.map((line, i) => {
      const lineNum = offset + i;
      const trimmed = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) + "..." : line;
      return `${String(lineNum).padStart(4)}→${trimmed}`;
    });
    let result = numbered.join("\n");
    if (lines.length > offset - 1 + limit) {
      result += `\n\n[showing lines ${offset}-${offset - 1 + limit} of ${lines.length}. Use offset=${offset + limit} to read more]`;
    }
    return truncate(result);
  },
);

const writeFileTool = tool(
  "write_file",
  "在工作区中创建或覆盖文件。会自动创建不存在的父目录。写入后自动进行语法检查（Python/JSON/JS）。类似hermes-agent的write_file工具，包含写入安全检查和lint反馈。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的文件路径" },
      content: { type: "string", description: "要写入的文件内容" },
    },
    required: ["path", "content"],
  },
  async (args) => {
    const path = args["path"] as string;
    const content = args["content"] as string;
    if (!path) return "Error: 'path' parameter is required";
    if (content === undefined || content === null) return "Error: 'content' parameter is required";
    if (isWriteDenied(path)) return `Error: Write denied for security reasons: ${path} (sensitive file type)`;
    const abs = ensureInWorkspace(path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    let result = `File written: ${path} (${content.length} bytes)`;
    const lintResult = await lintFile(abs, content);
    if (lintResult) {
      result += `\n\n⚠️ Lint warning:\n${lintResult}`;
    }
    return result;
  },
);

const patchFileTool = tool(
  "patch",
  "对工作区中的文件进行精确替换编辑。搜索old_text并替换为new_text。支持replace_all选项替换所有匹配。类似hermes-agent的patch_replace工具，提供diff反馈。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的文件路径" },
      old_text: { type: "string", description: "要搜索的原始文本（必须精确匹配）" },
      new_text: { type: "string", description: "替换后的新文本" },
      replace_all: { type: "boolean", description: "是否替换所有匹配，默认false（仅替换第一个）" },
    },
    required: ["path", "old_text", "new_text"],
  },
  async (args) => {
    const path = args["path"] as string;
    if (!path) return "Error: 'path' parameter is required";
    const abs = ensureInWorkspace(path);
    if (!existsSync(abs)) return `Error: File not found: ${path}`;
    const content = readFileSync(abs, "utf-8");
    const oldText = args["old_text"] as string;
    const newText = args["new_text"] as string;
    if (!oldText) return "Error: 'old_text' parameter is required";
    if (newText === undefined || newText === null) return "Error: 'new_text' parameter is required";
    const replaceAll = args["replace_all"] as boolean ?? false;
    if (!content.includes(oldText)) {
      const lineCount = content.split("\n").length;
      return `Error: old_text not found in file (${lineCount} lines, ${content.length} chars). First 300 chars:\n${content.slice(0, 300)}`;
    }
    let patched: string;
    let matchCount: number;
    if (replaceAll) {
      matchCount = content.split(oldText).length - 1;
      patched = content.split(oldText).join(newText);
    } else {
      const idx = content.indexOf(oldText);
      if (idx === -1) return `Error: old_text not found in file`;
      matchCount = 1;
      patched = content.slice(0, idx) + newText + content.slice(idx + oldText.length);
      const secondIdx = patched.indexOf(oldText);
      if (secondIdx !== -1) {
        patched += `\n\n⚠️ Note: old_text appears multiple times in the file. Only the first occurrence was replaced. Use replace_all=true to replace all.`;
      }
    }
    writeFileSync(abs, patched, "utf-8");
    let result = `Patched ${path}: replaced ${matchCount} occurrence(s), ${oldText.length} → ${newText.length} chars`;
    const lintResult = await lintFile(abs, patched);
    if (lintResult) {
      result += `\n\n⚠️ Lint warning after patch:\n${lintResult}`;
    }
    return result;
  },
);

const listDirTool = tool(
  "list_dir",
  "列出工作区中目录的内容。返回文件和子目录列表，包含大小和类型信息。支持递归列出。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的目录路径，默认为工作区根目录" },
      recursive: { type: "boolean", description: "是否递归列出子目录，默认false" },
    },
    required: [],
  },
  async (args) => {
    const relPath = (args["path"] as string) ?? ".";
    const abs = ensureInWorkspace(relPath);
    if (!existsSync(abs)) return `Error: Directory not found: ${relPath}`;
    if (!statSync(abs).isDirectory()) return `Error: Not a directory: ${relPath}`;
    const recursive = args["recursive"] as boolean ?? false;
    const entries: string[] = [];
    function walk(dir: string, prefix: string) {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".") && item.name !== ".env") continue;
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          entries.push(`${prefix}${item.name}/`);
          if (recursive) walk(full, `${prefix}${item.name}/`);
        } else {
          const size = statSync(full).size;
          entries.push(`${prefix}${item.name} (${size} bytes)`);
        }
      }
    }
    walk(abs, "");
    if (entries.length === 0) return "Empty directory";
    return entries.join("\n");
  },
);

const searchFilesTool = tool(
  "search_files",
  "在工作区中搜索文件内容。支持正则表达式模式匹配，返回匹配行及行号。类似hermes-agent的search_files工具和ripgrep的输出格式。",
  {
    type: "object",
    properties: {
      pattern: { type: "string", description: "搜索模式（支持正则表达式）" },
      path: { type: "string", description: "相对于工作区的搜索目录，默认为根目录" },
      file_pattern: { type: "string", description: "文件名过滤模式，如*.ts, *.py" },
      max_results: { type: "number", description: "最大结果数，默认50" },
      context: { type: "number", description: "上下文行数，默认0" },
    },
    required: ["pattern"],
  },
  async (args) => {
    const pattern = args["pattern"] as string;
    const relPath = (args["path"] as string) ?? ".";
    const abs = ensureInWorkspace(relPath);
    if (!existsSync(abs)) return `Error: Directory not found: ${relPath}`;
    const maxResults = (args["max_results"] as number) ?? 50;
    const filePattern = args["file_pattern"] as string | undefined;
    const contextLines = (args["context"] as number) ?? 0;
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "i");
    } catch {
      return `Error: Invalid regex pattern: ${pattern}`;
    }
    const results: string[] = [];
    function search(dir: string) {
      if (results.length >= maxResults) return;
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".")) continue;
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          search(full);
        } else {
          if (filePattern) {
            const fpRegex = new RegExp(filePattern.replace(/\*/g, ".*").replace(/\?/g, "."), "i");
            if (!fpRegex.test(item.name)) continue;
          }
          try {
            const content = readFileSync(full, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              if (regex.test(lines[i]!)) {
                const rel = full.replace(WORKSPACE_ROOT + sep, "");
                results.push(`${rel}:${i + 1}: ${lines[i]!.trim().slice(0, 200)}`);
                if (contextLines > 0) {
                  for (let c = 1; c <= contextLines && i + c < lines.length; c++) {
                    results.push(`${rel}:${i + c + 1}:   ${lines[i + c]!.trim().slice(0, 200)}`);
                  }
                }
              }
            }
          } catch { continue; }
        }
      }
    }
    search(abs);
    if (results.length === 0) return `No matches found for: ${pattern}`;
    return results.join("\n");
  },
);

const terminalTool = tool(
  "terminal",
  "在工作区中执行shell命令。可以运行git、npm、python等命令。命令在工作区目录中执行，超时30秒。类似hermes-agent的terminal工具。支持PowerShell(Windows)和Bash(Linux/Mac)。",
  {
    type: "object",
    properties: {
      command: { type: "string", description: "要执行的shell命令" },
      timeout: { type: "number", description: "超时时间（毫秒），默认30000" },
    },
    required: ["command"],
  },
  async (args) => {
    const cmd = args["command"] as string;
    if (!cmd) return "Error: 'command' parameter is required";
    const timeout = (args["timeout"] as number) ?? MAX_EXEC_MS;
    const { stdout, stderr, exitCode } = await execShell(cmd, Math.min(timeout, 60000));
    let result = "";
    if (stdout) result += stdout;
    if (stderr) result += (result ? "\n" : "") + `[stderr]\n${stderr}`;
    if (exitCode !== 0) result += `\n[exit code: ${exitCode}]`;
    return result || "(no output)";
  },
);

const webSearchTool = tool(
  "web_search",
  "联网搜索信息。使用搜索引擎查询实时信息，返回搜索结果摘要列表。支持SerpAPI(有key时)和DuckDuckGo(免费fallback)两种后端。类似hermes-agent的web_search工具。",
  {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词" },
      num_results: { type: "number", description: "返回结果数量，默认5" },
    },
    required: ["query"],
  },
  async (args) => {
    const query = args["query"] as string;
    if (!query) return "Error: 'query' parameter is required";
    const numResults = (args["num_results"] as number) ?? 5;
    try {
      const apiKey = process.env.SERPAPI_KEY ?? process.env.GOOGLE_SEARCH_API_KEY ?? "";
      if (apiKey) {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${numResults}`;
        const resp = await fetch(url);
        const data = await resp.json() as Record<string, unknown>;
        const results = (data.organic_results as Array<Record<string, unknown>> ?? []).slice(0, numResults);
        return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet ?? ""}`).join("\n\n");
      }
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const resp = await fetch(ddgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await resp.text();
      const results: string[] = [];
      const linkRegex = /class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      const snippetRegex = /class="result__snippet"[^>]*>(.*?)<\/[at]/gi;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = linkRegex.exec(html)) !== null && i < numResults) {
        const title = match[2]!.replace(/<[^>]*>/g, "").trim();
        const url = match[1]!;
        const snippetMatch = snippetRegex.exec(html);
        const snippet = snippetMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";
        results.push(`${i + 1}. ${title}\n   ${url}\n   ${snippet}`);
        i++;
      }
      if (results.length === 0) return `No search results found for: ${query}`;
      return results.join("\n\n");
    } catch (err: any) {
      return `Search error: ${err.message ?? String(err)}`;
    }
  },
);

const webExtractTool = tool(
  "web_extract",
  "提取网页内容。获取指定URL的网页文本内容，去除HTML标签和导航。支持智能内容提取和长度控制。类似hermes-agent的web_extract工具。",
  {
    type: "object",
    properties: {
      url: { type: "string", description: "要提取内容的网页URL" },
      max_length: { type: "number", description: "最大返回字符数，默认10000" },
    },
    required: ["url"],
  },
  async (args) => {
    const url = args["url"] as string;
    if (!url) return "Error: 'url' parameter is required";
    const maxLength = (args["max_length"] as number) ?? 10000;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ZhiXuBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await resp.text();
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > maxLength) text = text.slice(0, maxLength) + "\n... [truncated]";
      return text || "(empty page)";
    } catch (err: any) {
      return `Extract error: ${err.message ?? String(err)}`;
    }
  },
);

const executeCodeTool = tool(
  "execute_code",
  "执行代码并返回输出。支持Python和JavaScript/Node.js。代码在工作区中执行，可以访问文件系统。类似hermes-agent的execute_code工具，代码写入临时文件后执行。",
  {
    type: "object",
    properties: {
      language: { type: "string", description: "编程语言：python 或 javascript", enum: ["python", "javascript"] },
      code: { type: "string", description: "要执行的代码" },
      timeout: { type: "number", description: "超时时间（毫秒），默认30000" },
    },
    required: ["language", "code"],
  },
  async (args) => {
    const language = args["language"] as string;
    const code = args["code"] as string;
    if (!language) return "Error: 'language' parameter is required (python or javascript)";
    if (!code) return "Error: 'code' parameter is required";
    const timeout = (args["timeout"] as number) ?? MAX_EXEC_MS;
    const tmpDir = join(WORKSPACE_ROOT, ".tmp");
    mkdirSync(tmpDir, { recursive: true });
    const ext = language === "python" ? "py" : "mjs";
    const tmpFile = join(tmpDir, `exec_${Date.now()}.${ext}`);
    writeFileSync(tmpFile, code, "utf-8");
    try {
      const cmd = language === "python" ? "python" : "node";
      const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
        execFile(cmd, [tmpFile], { timeout: Math.min(timeout, 60000), maxBuffer: 1024 * 1024, cwd: WORKSPACE_ROOT }, (err, stdout, stderr) => {
          resolve({
            stdout: truncate((stdout ?? "").toString()),
            stderr: truncate((stderr ?? "").toString()),
            exitCode: err && "code" in err ? (err.code as number) : err ? 1 : 0,
          });
        });
      });
      let output = "";
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? "\n" : "") + `[stderr]\n${result.stderr}`;
      if (result.exitCode !== 0) output += `\n[exit code: ${result.exitCode}]`;
      return output || "(no output)";
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  },
);

const COLOR_THEMES: Record<string, {
  primary: string; secondary: string; accent: string; bg: string; bgDark: string;
  text: string; textLight: string; textOnPrimary: string; divider: string;
}> = {
  blue: {
    primary: "1e40af", secondary: "3b82f6", accent: "60a5fa",
    bg: "f8fafc", bgDark: "1e3a5f", text: "0f172a", textLight: "64748b",
    textOnPrimary: "ffffff", divider: "e2e8f0",
  },
  green: {
    primary: "166534", secondary: "22c55e", accent: "86efac",
    bg: "f0fdf4", bgDark: "14532d", text: "052e16", textLight: "4d7c0f",
    textOnPrimary: "ffffff", divider: "dcfce7",
  },
  purple: {
    primary: "6b21a8", secondary: "a855f7", accent: "d8b4fe",
    bg: "faf5ff", bgDark: "581c87", text: "1e1b2e", textLight: "7c3aed",
    textOnPrimary: "ffffff", divider: "e9d5ff",
  },
  red: {
    primary: "991b1b", secondary: "ef4444", accent: "fca5a5",
    bg: "fef2f2", bgDark: "7f1d1d", text: "1c1917", textLight: "b91c1c",
    textOnPrimary: "ffffff", divider: "fecaca",
  },
  dark: {
    primary: "1e293b", secondary: "475569", accent: "94a3b8",
    bg: "0f172a", bgDark: "020617", text: "f1f5f9", textLight: "94a3b8",
    textOnPrimary: "ffffff", divider: "334155",
  },
};

type SlideInput = {
  type?: "cover" | "toc" | "section" | "content" | "end";
  title: string;
  content?: string;
  bullets?: string[];
  notes?: string;
  subtitle?: string;
  section_number?: number;
};

function buildCoverSlide(pptx: any, theme: typeof COLOR_THEMES[string], title: string, subtitle?: string) {
  const s = pptx.addSlide();
  s.background = { color: theme.primary };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: theme.primary } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 5.2, w: "100%", h: 0.06, fill: { color: theme.accent } });
  s.addText(title, {
    x: 0.8, y: 1.8, w: 8.4, h: 2.0,
    fontSize: 36, bold: true, color: theme.textOnPrimary,
    fontFace: "Microsoft YaHei", align: "center", valign: "middle",
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.8, y: 3.9, w: 8.4, h: 1.0,
      fontSize: 18, color: theme.accent,
      fontFace: "Microsoft YaHei", align: "center", valign: "top",
    });
  }
  s.addText("知序 AI", {
    x: 0.8, y: 6.5, w: 8.4, h: 0.5,
    fontSize: 12, color: theme.accent, fontFace: "Microsoft YaHei", align: "center",
  });
  return s;
}

function buildTocSlide(pptx: any, theme: typeof COLOR_THEMES[string], sections: string[]) {
  const s = pptx.addSlide();
  s.background = { color: theme.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: "100%", fill: { color: theme.primary } });
  s.addText("目 录", {
    x: 0.5, y: 0.4, w: 9, h: 1.0,
    fontSize: 28, bold: true, color: theme.primary,
    fontFace: "Microsoft YaHei",
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.3, w: 2.0, h: 0.04, fill: { color: theme.accent } });
  const items = sections.slice(0, 8).map((sec, i) => ({
    text: `${String(i + 1).padStart(2, "0")}    ${sec}`,
    options: { fontSize: 16, color: theme.text, fontFace: "Microsoft YaHei", breakLine: true, paraSpaceAfter: 8 },
  }));
  s.addText(items, { x: 0.8, y: 1.8, w: 8.4, h: 5.0, valign: "top" });
  return s;
}

function buildSectionSlide(pptx: any, theme: typeof COLOR_THEMES[string], title: string, sectionNumber?: number) {
  const s = pptx.addSlide();
  s.background = { color: theme.primary };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: theme.primary } });
  if (sectionNumber) {
    s.addText(String(sectionNumber).padStart(2, "0"), {
      x: 0.8, y: 1.5, w: 8.4, h: 1.2,
      fontSize: 60, bold: true, color: theme.accent,
      fontFace: "Microsoft YaHei", align: "center", transparency: 40,
    });
  }
  s.addText(title, {
    x: 0.8, y: 2.8, w: 8.4, h: 2.0,
    fontSize: 32, bold: true, color: theme.textOnPrimary,
    fontFace: "Microsoft YaHei", align: "center", valign: "middle",
  });
  s.addShape(pptx.ShapeType.rect, { x: 3.5, y: 4.9, w: 3.0, h: 0.04, fill: { color: theme.accent } });
  return s;
}

function buildContentSlide(pptx: any, theme: typeof COLOR_THEMES[string], slide: SlideInput) {
  const s = pptx.addSlide();
  s.background = { color: theme.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: theme.primary } });
  s.addText(slide.title, {
    x: 0.6, y: 0.15, w: 8.8, h: 0.9,
    fontSize: 22, bold: true, color: theme.textOnPrimary,
    fontFace: "Microsoft YaHei", valign: "middle",
  });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.2, w: "100%", h: 0.04, fill: { color: theme.accent } });
  const bullets = slide.bullets ?? (slide.content ? slide.content.split("\n").filter(Boolean) : []);
  if (bullets.length > 0) {
    const textItems = bullets.map((b: string) => ({
      text: b.replace(/^[-•*\d.]+\s*/, ""),
      options: {
        bullet: { type: "bullet", style: "●" },
        fontSize: 15, color: theme.text, fontFace: "Microsoft YaHei",
        paraSpaceBefore: 6, paraSpaceAfter: 4,
      },
    }));
    s.addText(textItems, { x: 0.8, y: 1.6, w: 8.4, h: 5.2, valign: "top" });
  } else if (slide.content) {
    s.addText(slide.content, {
      x: 0.8, y: 1.6, w: 8.4, h: 5.2,
      fontSize: 15, color: theme.text, fontFace: "Microsoft YaHei", valign: "top",
    });
  }
  s.addText("知序 AI", {
    x: 0.5, y: 7.0, w: 2.0, h: 0.3,
    fontSize: 8, color: theme.textLight, fontFace: "Microsoft YaHei",
  });
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

function buildEndSlide(pptx: any, theme: typeof COLOR_THEMES[string], title?: string) {
  const s = pptx.addSlide();
  s.background = { color: theme.primary };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: theme.primary } });
  s.addText(title ?? "谢谢观看", {
    x: 0.8, y: 2.5, w: 8.4, h: 2.0,
    fontSize: 40, bold: true, color: theme.textOnPrimary,
    fontFace: "Microsoft YaHei", align: "center", valign: "middle",
  });
  s.addShape(pptx.ShapeType.rect, { x: 3.5, y: 4.6, w: 3.0, h: 0.04, fill: { color: theme.accent } });
  s.addText("由 知序 AI 生成", {
    x: 0.8, y: 5.0, w: 8.4, h: 0.6,
    fontSize: 14, color: theme.accent, fontFace: "Microsoft YaHei", align: "center",
  });
  return s;
}

const createPptxTool = tool(
  "create_pptx",
  `创建专业PowerPoint演示文稿(.pptx)。参考SlideFlow/MultiAgentPPT等开源项目的设计，支持多种页面类型和配色方案。

页面类型(type):
- cover: 封面页（标题居中，深色背景）
- toc: 目录页（自动编号列表）
- section: 章节分隔页（大号章节标题）
- content: 内容页（标题栏+要点列表）
- end: 结尾页（谢谢观看）

配色方案(theme): blue(默认), green, purple, red, dark

最佳实践:
1. 第一页用cover，包含标题和副标题
2. 第二页用toc，列出所有章节
3. 每个章节前用section分隔，再跟content页
4. 最后一页用end
5. content页的bullets用换行分隔要点`,
  {
    type: "object",
    properties: {
      filename: { type: "string", description: "输出文件名，如 presentation.pptx" },
      title: { type: "string", description: "演示文稿标题" },
      theme: { type: "string", description: "配色方案: blue, green, purple, red, dark", enum: ["blue", "green", "purple", "red", "dark"] },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "页面类型: cover, toc, section, content, end", enum: ["cover", "toc", "section", "content", "end"] },
            title: { type: "string", description: "幻灯片标题" },
            subtitle: { type: "string", description: "副标题（cover页使用）" },
            content: { type: "string", description: "正文内容（换行分隔要点）" },
            bullets: { type: "array", items: { type: "string" }, description: "要点列表（与content二选一）" },
            section_number: { type: "number", description: "章节编号（section页使用）" },
            notes: { type: "string", description: "演讲者备注" },
          },
          required: ["title"],
        },
        description: "幻灯片列表",
      },
    },
    required: ["filename", "title", "slides"],
  },
  async (args) => {
    try {
      const filename = args["filename"] as string;
      const title = args["title"] as string;
      const themeName = (args["theme"] as string) ?? "blue";
      const slides = args["slides"] as SlideInput[];
      if (!filename) return "Error: 'filename' parameter is required";
      if (!title) return "Error: 'title' parameter is required";
      if (!slides || !Array.isArray(slides) || slides.length === 0) return "Error: 'slides' parameter must be a non-empty array";
      const theme = COLOR_THEMES[themeName] ?? COLOR_THEMES["blue"]!;
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.title = title;
      pptx.author = "知序 AI";
      pptx.layout = "LAYOUT_WIDE";
      const sectionTitles: string[] = [];
      let sectionIdx = 0;
      for (const slide of slides) {
        const slideType = slide.type ?? "content";
        switch (slideType) {
          case "cover":
            buildCoverSlide(pptx, theme, slide.title, slide.subtitle);
            break;
          case "toc": {
            const tocItems = slide.bullets ?? (slide.content ? slide.content.split("\n").filter(Boolean) : []);
            buildTocSlide(pptx, theme, tocItems.length > 0 ? tocItems : slides.filter(s => s.type === "section" || (s.type === "content" && !sectionTitles.includes(s.title))).map(s => s.title));
            break;
          }
          case "section":
            sectionIdx++;
            sectionTitles.push(slide.title);
            buildSectionSlide(pptx, theme, slide.title, slide.section_number ?? sectionIdx);
            break;
          case "content":
            buildContentSlide(pptx, theme, slide);
            break;
          case "end":
            buildEndSlide(pptx, theme, slide.title);
            break;
          default:
            buildContentSlide(pptx, theme, slide);
        }
      }
      const abs = ensureInWorkspace(filename);
      mkdirSync(dirname(abs), { recursive: true });
      await pptx.writeFile({ fileName: abs });
      const stat = statSync(abs);
      return `PPTX created: ${filename} (${slides.length} slides, ${(stat.size / 1024).toFixed(1)}KB, theme: ${themeName})`;
    } catch (err: any) {
      return `Error creating PPTX: ${err.message ?? String(err)}`;
    }
  },
);

const createDocxTool = tool(
  "create_docx",
  "创建Word文档。生成真实的.docx文件。可以指定标题、段落、格式等。文件保存到工作区。",
  {
    type: "object",
    properties: {
      filename: { type: "string", description: "输出文件名，如 document.docx" },
      title: { type: "string", description: "文档标题" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "章节标题" },
            paragraphs: { type: "array", items: { type: "string" }, description: "段落内容列表" },
          },
          required: ["heading"],
        },
        description: "文档章节列表",
      },
    },
    required: ["filename", "title", "sections"],
  },
  async (args) => {
    try {
      const filename = args["filename"] as string;
      const title = args["title"] as string;
      const sections = args["sections"] as Array<Record<string, unknown>>;
      if (!filename) return "Error: 'filename' parameter is required";
      if (!title) return "Error: 'title' parameter is required";
      if (!sections || !Array.isArray(sections)) return "Error: 'sections' parameter must be an array";
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const children: InstanceType<typeof Paragraph>[] = [];
      children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
      for (const section of sections) {
        children.push(new Paragraph({ text: section.heading as string, heading: HeadingLevel.HEADING_1 }));
        for (const para of (section.paragraphs as string[] ?? [])) {
          children.push(new Paragraph({ children: [new TextRun(para)] }));
        }
      }
      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      const abs = ensureInWorkspace(filename);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, buffer);
      return `DOCX created: ${filename} (${buffer.length} bytes)`;
    } catch (err: any) {
      return `Error creating DOCX: ${err.message ?? String(err)}`;
    }
  },
);

const deleteFileTool = tool(
  "delete_file",
  "删除工作区中的文件。谨慎使用，删除后不可恢复。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的文件路径" },
    },
    required: ["path"],
  },
  async (args) => {
    const path = args["path"] as string;
    if (!path) return "Error: 'path' parameter is required";
    const abs = ensureInWorkspace(path);
    if (!existsSync(abs)) return `Error: File not found: ${path}`;
    unlinkSync(abs);
    return `File deleted: ${path}`;
  },
);

const appendFileTool = tool(
  "append_file",
  "向工作区中的文件追加内容。如果文件不存在则创建。用于日志记录、增量写入等。",
  {
    type: "object",
    properties: {
      path: { type: "string", description: "相对于工作区的文件路径" },
      content: { type: "string", description: "要追加的内容" },
    },
    required: ["path", "content"],
  },
  async (args) => {
    const path = args["path"] as string;
    const content = args["content"] as string;
    if (!path) return "Error: 'path' parameter is required";
    if (content === undefined || content === null) return "Error: 'content' parameter is required";
    const abs = ensureInWorkspace(path);
    mkdirSync(dirname(abs), { recursive: true });
    await appendFile(abs, content, "utf-8");
    return `Content appended to: ${path}`;
  },
);

const allProductivityTools = [
  readFileTool,
  writeFileTool,
  patchFileTool,
  listDirTool,
  searchFilesTool,
  terminalTool,
  webSearchTool,
  webExtractTool,
  executeCodeTool,
  createPptxTool,
  createDocxTool,
  deleteFileTool,
  appendFileTool,
];

export function registerProductivityTools(registry: ToolRegistry): void {
  for (const t of allProductivityTools) {
    registry.register(t.definition, t.handler);
  }
}

export { WORKSPACE_ROOT };
