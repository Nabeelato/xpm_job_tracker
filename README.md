# TI Job Management System

Lightweight internal job tracking app for accounting/audit teams importing daily CSV/XLSX exports from Xero Practice Manager.

## Stack

- Next.js 16 App Router
- TypeScript
- PostgreSQL 18 via Docker Compose
- Prisma ORM
- Tailwind CSS with local shadcn/ui-style components
- NextAuth credentials auth
- Zod validation
- ExcelJS and csv-parse for uploads

## Local Setup

1. Configure environment variables using `.env.example` as the reference.
   `DATABASE_URL` is for commands you run on the host machine.
   `DOCKER_DATABASE_URL` is for the `web` container to reach PostgreSQL over the Docker network.
2. Start the full app stack:

```powershell
docker compose up --build
```

This starts PostgreSQL and the Next.js web app. The web container applies migrations on startup, optionally seeds departments/admin from environment variables when `RUN_SEED=true`, and serves the built frontend at `http://localhost:3000`.
The first build needs Docker Hub access to pull the Node base image unless that image already exists locally.

For database-only local development, start PostgreSQL:

```powershell
docker compose up -d postgres
```

The Docker database is bound to `127.0.0.1:${POSTGRES_PORT}` so it is reachable from the host machine without being exposed publicly.

3. Create tables and seed departments/admin when running the frontend outside Docker:

```powershell
npm run prisma:migrate -- --name init
npm run prisma:seed
```

4. Start the app:

```powershell
npm run dev
```

The default admin is created only from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`.
Optional manager-level department users can be seeded with `DEPARTMENT_MANAGER_USERS_JSON`; each seeded manager is also set as a default auto-assignee for that department.

## Server Deployment

Before hosting publicly, set these production environment values in `.env`:

```powershell
APP_PORT="3000"
ALLOWED_HOSTS="jobs.example.com"
NEXTAUTH_URL="https://jobs.example.com"
NEXTAUTH_SECRET="replace-with-a-long-random-production-secret"
```

Use your real domain in `ALLOWED_HOSTS` without `https://` or a path. If you will access the app by server IP instead of a domain, use that IP, for example `ALLOWED_HOSTS="203.0.113.10"`. Multiple values are comma-separated, such as `ALLOWED_HOSTS="jobs.example.com,www.jobs.example.com"`.

Requests with any other `Host` header are rejected with `403 Forbidden` by `server.js` before the Next.js app handles them. If you put the app behind Nginx, Caddy, or another reverse proxy, configure the proxy to preserve the original `Host` header.

## Import Flow

1. Admin or Manager uploads `.csv` or `.xlsx`.
2. The app validates required headers:
   - `[Job] Job No.`
   - `[Client] Client`
   - `[Job] Name`
3. Rows are staged in `import_batches` and `import_rows`.
4. Preview shows new/updated/unchanged jobs, client matches, department detection, duplicates, errors, and missing jobs.
5. Confirm applies changes in one transaction.

Confirmed imports never overwrite assignments, comments, internal status, or manually overridden departments. Missing jobs are marked, not deleted.
