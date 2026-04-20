# UniVA Single-Service TypeScript Consolidation Plan

> **For Hermes:** Use the smallest viable path. Preserve the existing Next.js app and replace Python-backed API dependencies with TypeScript-native server modules inside the app.

**Goal:** Make the app deployable as a single Render service running the Next.js app, with no Python runtime required for core chat/editor/admin flows.

**Architecture:** Keep `apps/web` as the only runtime service. Move chat orchestration and access-code admin/status logic into TypeScript server modules used by Next route handlers. Do not attempt parity with the full Python MCP toolchain in this slice; instead, provide a TypeScript-native AI copilot path that supports chat guidance and editor actions.

**Tech Stack:** Next.js route handlers, TypeScript, Node runtime, OpenAI AI SDK, Drizzle/Postgres for access codes.

## Success criteria
1. `apps/web` no longer requires `AGENT_API_URL` for chat and access-code routes.
2. `/api/chat/stream` works from the Next app alone and emits the event types the existing chat UI already understands.
3. `/api/access-code/status` and `/api/admin/access-codes*` work from TypeScript server code.
4. The repo gains a single-service deployment path for Render documented in-repo.
5. New TypeScript behavior is covered by automated tests and verified locally.

## Initial implementation slice
1. Add pure TypeScript server modules for:
   - access-code storage/service
   - single-service chat orchestration/event generation
2. Add tests for those modules first.
3. Swap chat and access-code API routes to the new modules.
4. Add/update schema, env docs, and Render deployment docs.
5. Verify tests + typecheck/build.
