# 知序 P0 核心实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成知序 P0 级别全部核心能力实现，使系统从 MVP 骨架升级为可运行的项目制 Agent OS。

**Architecture:** pnpm monorepo，Fastify API + Next.js Web + Tauri Desktop + Prisma PostgreSQL + Agent OS + Skill Runtime + Document Pipeline + Export Pipeline。

**Tech Stack:** TypeScript, Fastify, Next.js, Tauri 2, Prisma, PostgreSQL, Redis, MinIO, PptxGenJS, MarkItDown, Vitest。

---

## 当前状态评估

### 已完成
- ✅ Workspace Foundation (package.json, pnpm-workspace, tsconfig, .env, docker-compose)
- ✅ packages/core: Zod schemas, state machine, types (298 行)
- ✅ packages/config: 环境变量解析
- ✅ packages/db: Prisma schema (9 个核心模型) + client
- ✅ packages/agent-core: ProjectEvent, WorkflowRun, SkillDefinition, MemoryCandidate
- ✅ apps/server: Fastify API (14 个路由), InMemoryProjectStore, MockModelGateway, ZhiXuSteward, SkillRegistry, MockDocumentPipeline
- ✅ apps/server: 14 个 API 测试全部通过
- ✅ apps/web: Next.js 首页 (项目列表 + 三色权责面板)
- ✅ apps/desktop: Tauri 2 壳 + Vite 前端
- ✅ Docker Compose: PostgreSQL 17 + Redis 8 + MinIO

### P0 待实现
1. Prisma 数据库集成 — 替换 InMemoryProjectStore
2. Document Pipeline — MarkItDown 真实文件解析
3. PPT 生成 — PptxGenJS 集成
4. Skill Runtime — 技能执行引擎与权限控制
5. Web 仪表盘增强 — 项目详情/任务/产物视图
6. Watcher 系统 — 截止提醒/停滞检测
7. 导出管线 — PPTX/DOCX/PDF 导出
8. 引用核验 — CitationRecord 与基础检查
9. 桌面端增强 — 连接服务器与真实数据

---

### Task 1: Prisma 数据库集成

**Files:**
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/project-store.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/src/db-project-store.ts`
- Modify: `apps/server/package.json`

- [ ] 扩展 packages/db 导出 PrismaProjectStore
- [ ] 实现 PrismaProjectStore 替代 InMemoryProjectStore
- [ ] Server 支持通过环境变量切换 InMemory/Prisma 存储
- [ ] 运行现有测试确保兼容

### Task 2: Document Pipeline — MarkItDown

**Files:**
- Create: `packages/document-intelligence/package.json`
- Create: `packages/document-intelligence/tsconfig.json`
- Create: `packages/document-intelligence/src/index.ts`
- Create: `packages/document-intelligence/src/provider.ts`
- Create: `packages/document-intelligence/src/markitdown-provider.ts`
- Create: `packages/document-intelligence/src/normalizer.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/server/src/document-pipeline.ts`
- Modify: `apps/server/package.json`

- [ ] 创建 document-intelligence 包
- [ ] 定义 DocumentParserProvider 接口
- [ ] 实现 MarkItDownProvider (调用 @anthropic-ai/markitdown 或 markitdown npm)
- [ ] 实现 ParseResultNormalizer 统一输出格式
- [ ] Server 集成真实 DocumentPipeline
- [ ] 编写 provider 测试

### Task 3: PPT 生成 — PptxGenJS

**Files:**
- Create: `packages/artifact-factory/package.json`
- Create: `packages/artifact-factory/tsconfig.json`
- Create: `packages/artifact-factory/src/index.ts`
- Create: `packages/artifact-factory/src/renderer.ts`
- Create: `packages/artifact-factory/src/pptx-renderer.ts`
- Create: `packages/artifact-factory/src/schemas.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/app.ts`

- [ ] 创建 artifact-factory 包
- [ ] 定义 ArtifactRenderer 接口
- [ ] 实现 PptxRenderer (PptxGenJS + 知序品牌主题)
- [ ] 添加 PPT 导出 API 路由
- [ ] 编写 renderer 测试

### Task 4: Skill Runtime

**Files:**
- Create: `packages/skill-runtime/package.json`
- Create: `packages/skill-runtime/tsconfig.json`
- Create: `packages/skill-runtime/src/index.ts`
- Create: `packages/skill-runtime/src/definition.ts`
- Create: `packages/skill-runtime/src/permission.ts`
- Create: `packages/skill-runtime/src/runner.ts`
- Create: `packages/skill-runtime/src/sandbox.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/server/src/skill-registry.ts`
- Modify: `apps/server/src/app.ts`

- [ ] 创建 skill-runtime 包
- [ ] 定义 SkillDefinition, PermissionPolicy, SkillSandboxPolicy
- [ ] 实现 SkillInvocationRunner (权限检查 + 配额检查 + 执行 + 日志)
- [ ] 实现 HumanGateRequiredError
- [ ] Server 集成 SkillRuntime
- [ ] 编写 runtime 测试

### Task 5: Web 仪表盘增强

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/projects/[id]/page.tsx`
- Create: `apps/web/app/projects/[id]/layout.tsx`
- Modify: `apps/web/app/api-client.ts`
- Modify: `apps/web/app/styles.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/next.config.mjs`

- [ ] 添加项目详情页 (项目信息 + 任务列表 + 资料列表 + 产物列表 + Human Gate)
- [ ] 添加导航栏 (知序品牌 + 一级导航)
- [ ] 增强首页项目卡片 (点击跳转详情)
- [ ] 增强三色溯源面板 (可视化占比)
- [ ] 确保构建通过

### Task 6: Watcher 系统

**Files:**
- Create: `apps/server/src/watcher.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/package.json`

- [ ] 实现 Watcher 服务 (截止日期扫描 + 停滞检测 + 提醒生成)
- [ ] 添加 /api/watcher/check 端点
- [ ] 添加 /api/projects/:id/reminders 端点
- [ ] 编写 watcher 测试

### Task 7: 导出管线

**Files:**
- Create: `packages/artifact-factory/src/docx-renderer.ts`
- Create: `packages/artifact-factory/src/markdown-renderer.ts`
- Create: `packages/artifact-factory/src/export-pipeline.ts`
- Modify: `apps/server/src/app.ts`

- [ ] 实现 DocxRenderer (docx npm 包)
- [ ] 实现 MarkdownRenderer
- [ ] 实现 ExportPipeline (Verifier + Human Gate + 渲染)
- [ ] 添加 /api/artifacts/:id/export 路由
- [ ] 编写导出测试

### Task 8: 引用核验

**Files:**
- Create: `apps/server/src/citation-verifier.ts`
- Modify: `packages/db/prisma/schema.prisma` (添加 CitationRecord 模型)
- Modify: `apps/server/src/app.ts`

- [ ] Prisma schema 添加 CitationRecord 模型
- [ ] 实现 CitationVerifier (格式检查 + DOI 格式验证 + 重复检测)
- [ ] 添加 /api/citations/verify 路由
- [ ] 编写引用核验测试

### Task 9: 桌面端增强

**Files:**
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/styles.css`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] 桌面端连接 Server API 显示真实项目数据
- [ ] 添加项目列表视图
- [ ] 添加 Tauri 本地文件选择命令
- [ ] 确保构建通过

### Task 10: 全量验证

- [ ] 运行 pnpm install
- [ ] 运行 pnpm test
- [ ] 运行 pnpm typecheck
- [ ] 运行 pnpm build
