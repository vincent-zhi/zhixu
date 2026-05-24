# 知序 Platform MVP 基础设施设计

## 目标

先保证服务器、网页和桌面端具备一致的工程骨架、共享领域模型、可构建脚本和本地开发依赖配置，为后续 Agent OS、Skill Runtime、文件解析和多端同步留出边界。

## 架构

采用 pnpm monorepo。

- `apps/server`: Fastify API 服务，负责健康检查、项目制领域 API、输入校验、错误格式和审计边界。
- `apps/web`: Next.js Web 管理台，优先展示项目、任务、资料、产物和风险概览。
- `apps/desktop`: Tauri 2 + Vite 桌面壳，先加载本地前端入口，后续可接入离线缓存、本地文件解析和系统能力。
- `packages/core`: 共享领域枚举、Zod schema、状态机、API response 类型。
- `packages/config`: 共享环境变量解析。
- `packages/db`: Prisma schema 和数据库客户端。

## 第一阶段范围

第一阶段不实现真实 AI、真实文件解析、真实认证和真实上传。它只建立可运行的边界：

- API 暴露 `/health`、`/ready`、`/api/projects`。
- 数据模型覆盖 Workspace、Project、Source、Task、Artifact、ArtifactBlock、Evidence、HumanGate、AuditLog。
- Docker Compose 声明 PostgreSQL、Redis、MinIO，供后续本地开发接入。
- Web 和 Desktop 先使用静态/模拟项目数据展示产品结构，确保构建链稳定。

## 技术决策

- 包管理：pnpm workspace，便于共享类型和脚本。
- API：Fastify + Zod，保持轻量、可测试、独立于 Web。
- 数据：Prisma + PostgreSQL，符合文档中的关系核心模型。
- 桌面：Tauri 2，Rust 侧先最小化，后续承接本地优先能力。
- 测试：Vitest 优先覆盖共享领域规则和服务端 API。

## 风险和边界

- Docker CLI 当前环境不可用，因此只能提交 Compose 文件，无法本机启动验证容器。
- Tauri 完整安装包构建可能依赖系统打包工具；第一阶段先验证前端和 Rust 配置可编译到可继续迭代的状态。
- 认证、文件对象存储、队列 worker、OpenSearch、向量库和 Agent OS 只保留接口方向，不在第一阶段硬接入。
