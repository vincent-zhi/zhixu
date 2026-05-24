import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles.css";

declare global {
  interface Window {
    zhixuDesktop?: {
      platformStatus: () => Promise<string>;
    };
  }
}

interface ProjectSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  riskLevel: string;
  nextAction: string;
  dueDate: string | null;
}

const API_BASE = "http://localhost:4000";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Desktop root element not found");
}

app.innerHTML = `
  <main class="desktop-shell">
    <nav class="nav-bar">
      <span class="nav-brand">知序</span>
      <span class="nav-subtitle">Desktop</span>
    </nav>
    <section class="brand-panel">
      <p class="eyebrow">ZhiXu Desktop</p>
      <h1>知序</h1>
      <p>桌面端连接服务器，展示项目数据，支持本地文件选择与敏感资料确认。</p>
      <div class="action-bar">
        <button id="status-button" type="button">检查运行时</button>
        <button id="select-file-button" type="button">选择本地文件</button>
      </div>
    </section>
    <section class="status-panel" aria-live="polite">
      <span class="status-dot"></span>
      <strong id="runtime-status">等待检查</strong>
      <p id="connection-status">正在连接服务器...</p>
    </section>
    <section class="projects-panel">
      <div class="panel-heading">
        <p class="eyebrow">Project Space</p>
        <h2>项目列表</h2>
      </div>
      <div id="project-list" class="project-list"></div>
    </section>
    <section class="trace-panel">
      <p class="eyebrow">Evidence Trace</p>
      <h2>三色权责</h2>
      <div class="trace-row green">
        <strong>绿色</strong>
        <span>可溯源内容</span>
      </div>
      <div class="trace-row yellow">
        <strong>黄色</strong>
        <span>归纳改写，需确认</span>
      </div>
      <div class="trace-row gray">
        <strong>灰色</strong>
        <span>AI 推断，仅供参考</span>
      </div>
    </section>
  </main>
`;

const button = document.querySelector<HTMLButtonElement>("#status-button");
const status = document.querySelector<HTMLElement>("#runtime-status");
const selectFileButton = document.querySelector<HTMLButtonElement>("#select-file-button");

void loadProjects();

button?.addEventListener("click", async () => {
  if (!status) return;

  try {
    const result = window.zhixuDesktop
      ? await window.zhixuDesktop.platformStatus()
      : await invoke<string>("platform_status");
    status.textContent = result;
  } catch {
    status.textContent = "浏览器预览模式";
  }
});

selectFileButton?.addEventListener("click", async () => {
  try {
    const selected = await open({
      multiple: true,
      filters: [
        { name: "Documents", extensions: ["pdf", "docx", "pptx", "md", "txt", "csv"] },
        { name: "Images", extensions: ["png", "jpg", "jpeg"] },
        { name: "All", extensions: ["*"] }
      ]
    });
    if (!selected) return;

    const files = Array.isArray(selected) ? selected : [selected];
    const connectionStatus = document.querySelector<HTMLElement>("#connection-status");
    if (connectionStatus) {
      connectionStatus.textContent = `已选择 ${files.length} 个文件：${files.map((f) => f.name ?? f.path.split(/[\\/]/).pop() ?? "").join(", ")}`;
    }
  } catch {
    const connectionStatus = document.querySelector<HTMLElement>("#connection-status");
    if (connectionStatus) {
      connectionStatus.textContent = "文件选择需要 Tauri 桌面运行时";
    }
  }
});

async function loadProjects() {
  const projectList = document.querySelector<HTMLDivElement>("#project-list");
  const connectionStatus = document.querySelector<HTMLElement>("#connection-status");

  try {
    const response = await fetch(`${API_BASE}/api/projects`);
    if (!response.ok) throw new Error("Server returned non-200");

    const body = (await response.json()) as { data?: ProjectSummary[] };
    const projects = body.data ?? [];

    if (connectionStatus) {
      connectionStatus.textContent = `已连接服务器，共 ${projects.length} 个项目`;
    }

    if (projectList) {
      if (projects.length === 0) {
        projectList.innerHTML = '<p class="empty-state">暂无项目，请通过 Web 端创建</p>';
      } else {
        projectList.innerHTML = projects
          .map(
            (project) => `
            <article class="project-card">
              <div>
                <span class="risk risk-${project.riskLevel.toLowerCase()}">${project.riskLevel}</span>
                <h3>${project.title}</h3>
                <p>${project.nextAction}</p>
              </div>
              <footer>
                <span class="status-badge status-${project.status}">${project.status.replaceAll("_", " ")}</span>
                <span>${project.dueDate ? "有截止日期" : "长期项目"}</span>
              </footer>
            </article>
          `
          )
          .join("");
      }
    }
  } catch {
    if (connectionStatus) {
      connectionStatus.textContent = "服务器离线，桌面端运行于本地回退模式";
    }
    if (projectList) {
      projectList.innerHTML = '<p class="empty-state">无法连接服务器</p>';
    }
  }
}
