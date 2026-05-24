# Platform Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first ZhiXu server, web, and desktop infrastructure skeleton.

**Architecture:** Use a pnpm monorepo with an independent Fastify API, Next.js web app, Tauri desktop app, shared core schemas, shared config, Prisma database package, and Docker Compose dependencies.

**Tech Stack:** TypeScript, pnpm, Fastify, Next.js, Vite, Tauri 2, Prisma, PostgreSQL, Redis, MinIO, Vitest.

---

### Task 1: Workspace Foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docs/superpowers/specs/2026-05-23-platform-infrastructure-design.md`

- [ ] Add workspace metadata and common scripts.
- [ ] Add TypeScript base compiler options.
- [ ] Add environment examples for API, database, Redis and S3-compatible storage.

### Task 2: Shared Packages

**Files:**
- Create: `packages/core`
- Create: `packages/config`
- Create: `packages/db`

- [ ] Add project-first domain enums, schemas and state-machine helpers.
- [ ] Add fail-fast environment parsing.
- [ ] Add Prisma schema for the first core models.
- [ ] Add Vitest tests for domain rules and config parsing.

### Task 3: Server

**Files:**
- Create: `apps/server`

- [ ] Add Fastify app factory.
- [ ] Add `/health`, `/ready`, and `/api/projects` routes.
- [ ] Add structured error shape and request IDs.
- [ ] Add API tests using Fastify injection.

### Task 4: Web

**Files:**
- Create: `apps/web`

- [ ] Add Next.js app shell.
- [ ] Add product-aligned landing/dashboard page.
- [ ] Add local API client boundary.
- [ ] Ensure `pnpm --filter @zhixu/web build` passes.

### Task 5: Desktop

**Files:**
- Create: `apps/desktop`

- [ ] Add Vite app shell.
- [ ] Add Tauri 2 config and minimal Rust command.
- [ ] Ensure desktop frontend build passes.

### Task 6: Infrastructure Verification

**Files:**
- Create: `docker-compose.yml`
- Create: `README.md`

- [ ] Add PostgreSQL, Redis and MinIO services with health checks.
- [ ] Add root build/test/typecheck commands.
- [ ] Run install, tests, typechecks and builds where available.
