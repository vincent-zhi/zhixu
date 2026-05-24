# 知序 Platform

知序 AI 学习科研管家的第一阶段基础设施骨架。当前目标是先保证服务器、网页和桌面端的构建链可用，并建立 Project-first 的共享领域模型。

## 结构

- `apps/server`: Fastify API 服务。
- `apps/web`: Next.js Web 管理台。
- `apps/desktop`: Tauri 2 + Vite 桌面端。
- `packages/agent-core`: 知序管家事件、工作流、trace 和敏感资料判定契约。
- `packages/core`: 领域 schema、状态机和共享类型。
- `packages/config`: 环境变量解析。
- `packages/db`: Prisma schema 和数据库客户端边界。
- `docker-compose.yml`: PostgreSQL、Redis、MinIO 本地依赖。
- `docs/architecture/prd-oss-adoption-matrix.md`: PRD 功能对照与开源吸收策略。

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm db:generate
pnpm --filter @zhixu/server dev
pnpm --filter @zhixu/web dev
pnpm --filter @zhixu/desktop electron
```

当前环境未检测到 Docker CLI；如果本机也没有 Docker Desktop，先安装后再启动依赖服务。

## 验证

```powershell
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` 会验证服务器、网页和 Electron 桌面壳。`pnpm --filter @zhixu/desktop tauri:build` 是可选的 Tauri 原生打包；Windows 上需要安装 Visual Studio Build Tools 并包含 Visual C++ 工具链。

## API

- `GET /health`: 服务存活检查。
- `GET /ready`: 依赖配置检查。
- `GET /api/projects`: 项目摘要列表。
- `POST /api/projects`: 创建项目摘要，使用共享 Zod schema 校验输入。
- `GET /api/projects/{projectId}`: 项目详情，包含资料、任务、产物、Human Gate 和审计日志。
- `POST /api/projects/{projectId}/sources`: 登记项目资料，默认进入解析队列状态。
- `POST /api/projects/{projectId}/tasks`: 创建项目任务，包含风险和责任标签。
- `POST /api/projects/{projectId}/human-gates`: 创建高风险确认节点。
- `POST /human-gates/{gateId}/confirm`: 确认 Human Gate 并写入审计。
- `POST /artifacts`: 创建 Artifact Canvas 草稿和首个 block。
- `PATCH /artifacts/{artifactId}/blocks/{blockId}`: 更新 block 内容、三色责任和核验状态。
- `GET /api/agent-jobs`: 查看 Agent OS 后台作业队列。
- `POST /api/projects/{projectId}/agent/plan`: 通过模型网关运行 Planner，返回三方案计划、确认项、风险和成本估算。
- `POST /api/projects/{projectId}/agent/verify`: 通过模型网关运行 Verifier，检查输出证据覆盖和风险。
- `POST /api/projects/{projectId}/events`: 知序管家统一事件入口。当前支持 `source_intake_requested` 和 `user_goal_submitted`，会自动路由到 SourceAgent/PlannerAgent，返回 workflow trace、Agent Jobs、风险和确认项。

Web 和桌面端都会优先读取 `NEXT_PUBLIC_API_URL` / `http://localhost:4000` 的项目接口；服务不可达时使用本地 fallback，保证构建和离线开发不被阻塞。

## 知序管家流程

后端现在支持 ProjectEvent 驱动流程：

1. 客户端提交 `ProjectEvent` 到 `/api/projects/{projectId}/events`。
2. `ZhiXuSteward` 做统一路由。
3. Source 事件会登记资料、创建 `parse_source` 作业，并对敏感资料创建 Human Gate。
4. 非敏感 Source 会立即通过本地 Document Pipeline mock 解析为 DocumentNode/EvidenceAnchor；敏感 Source 等 Human Gate 确认后由 Watcher 恢复解析。
5. Goal 事件会调用 Planner、生成三方案、创建计划确认任务。
6. Artifact block 更新会自动调用 Verifier，缺少证据时创建 evidence review Human Gate。
7. Project completed 事件会调用 Reflection Engine，生成待确认的 Knowledge Capsule memory candidate。
8. 响应返回 workflow trace，前端可直接展示当前步骤、风险、确认项和作业状态。

## 第一阶段边界

真实认证、二进制上传、真实 OCR/解析、真实模型供应商、Skill Runtime 沙箱、持久化队列、引用核验和导出流程尚未实现。当前代码已建立 Project-first 的可测试 API 合约、内存仓储、Prisma 7 客户端工厂、多端读取边界、Agent Job 队列、文件摄取作业、Planner/Verifier 和可替换模型网关。

后续 Agent、文件解析、PPT/DOCX/PDF 生成必须先对照 `docs/architecture/prd-oss-adoption-matrix.md`，优先复用成熟开源工具，通过知序自己的 Project/Evidence/Human Gate/Skill Runtime 适配层深度定制。
