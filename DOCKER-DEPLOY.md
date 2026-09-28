# Docker deployment

The active application is a pnpm/TypeScript monorepo:

- `artifacts/kjihc`: React/Vite web application
- `artifacts/api-server`: Express API
- `lib/db`: PostgreSQL/Drizzle data layer

Legacy material under `_extracted` is deliberately excluded from the Docker build.

## Server setup

Copy the example environment file and populate it with the production values currently held in Replit:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

At minimum, provide:

- `DATABASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Any Stripe, SMTP, Google, web-push or other application secrets already used by the API should also be copied into `.env`.

## Build and start

```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

The default host port is `8093` and can be changed with `KJIHC_PORT` in `.env`.

## Test locally

```bash
curl -I http://127.0.0.1:8093/
curl -i http://127.0.0.1:8093/api/
```

The nginx container serves the Vite SPA and proxies `/api/*` (including Clerk's `/api/__clerk` proxy) to the Express container.

Once the application is verified against the existing Neon database, the database can be dumped/restored separately without changing the application image.
