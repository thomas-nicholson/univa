# Render single-service deployment

This fork now supports a **single TypeScript service** deployment path.

## Does it run in a Node environment now?
Yes — for the current core app path, **yes**.

The app now builds and runs as a **Node / Next.js** service without needing the Python UniVA server for:
- chat API routes
- streaming chat route
- access-code status route
- admin access-code routes

The legacy Python/MCP pipeline is still not fully ported, so this is **Node-first core app runtime**, not full Python-feature parity.

## What changed
- `apps/web` is now the primary runtime service.
- Chat routes no longer require `AGENT_API_URL` or the Python UniVA server.
- Access-code status/admin routes now have TypeScript implementations.
- Auth/db remain optional. If you leave `AUTH_ENABLED=false`, the app can run without the old auth stack.

## Recommended Render setup
Use a single **Web Service** pointing at this repo.

### Runtime
- **Node**

### Health check
- `/api/health`

### Build command
```bash
npx -y bun@1.2.18 install
if [ -n "$DATABASE_URL" ]; then
  cd packages/db
  DATABASE_URL=$DATABASE_URL NODE_ENV=production npx -y bun@1.2.18 x drizzle-kit migrate --config=drizzle.config.ts
  cd ../..
fi
npx -y bun@1.2.18 x turbo run build --filter=opencut
```

### Start command
```bash
cd apps/web && PORT=${PORT:-3000} npx next start -p $PORT
```

## Minimum env for the simple TypeScript-only mode
```bash
OPENAI_API_KEY=...
UNIVA_AGENT_MODEL=gpt-4.1-mini
AUTH_ENABLED=false
```

## Optional env if you also want auth/admin persistence
```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-render-url.onrender.com
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
ADMIN_ACCESS_CODE=...
AUTH_ENABLED=true
```

## Notes
- The current single-service path is **TypeScript-first**, but it is **not feature-parity with the legacy Python MCP pipeline** yet.
- It is intended to make the web app deployable as one service while keeping the editor/chat workflow alive.
- If auth is disabled, `/api/auth/*` returns `503` intentionally instead of crashing the app at boot.
