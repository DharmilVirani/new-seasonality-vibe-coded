# Repository Guidelines

## Project Structure & Module Organization
This repository is a monorepo with two main apps under `apps/`:
- `apps/frontend`: Next.js 14 + TypeScript UI (`src/app`, `src/components`, `src/hooks`, `src/lib`, `src/store`).
- `apps/backend`: Express + Prisma API (`src/routes`, `src/services`, `src/middleware`, `src/utils`, `prisma/`).

Operational files live at the root: `docker-compose.yml`, `start.sh`, `scripts/`, and SQL bootstrap scripts in `init-scripts/`. Core technical docs are in `MDfiles/`.

## Build, Test, and Development Commands
Run commands from each app directory unless noted.
- `docker-compose up -d postgres redis minio`: start local infra.
- `cd apps/backend && npm install && npm run dev`: run backend with nodemon.
- `cd apps/frontend && npm install && npm run dev`: run frontend on Next dev server.
- `cd apps/frontend && npm run build`: production frontend build.
- `cd apps/frontend && npm run lint && npm run type-check`: lint and TS validation.
- `cd apps/backend && npm run test`: run Jest (`--passWithNoTests` is enabled).
- `cd apps/backend && npm run db:migrate && npm run db:seed`: apply Prisma migrations and seed data.

## Coding Style & Naming Conventions
- Frontend uses strict TypeScript (`tsconfig.json` has `strict: true`); prefer typed props and API contracts.
- Use 2-space indentation, semicolons, and single-responsibility modules.
- React components: `PascalCase` file names (e.g., `SeasonalityChart.tsx`).
- Hooks/utilities/stores: `camelCase` with clear suffixes (e.g., `useChartResize.ts`, `analysisStore.ts`).
- Backend files follow existing JS naming by feature (e.g., `AnalysisService.js`, `authRoutes.js`).

## Testing Guidelines
Testing is currently lightweight and backend-focused (Jest plus utility scripts like `test-db.js`).
- Add automated tests for new backend business logic and routes.
- Place tests near implementation or in a dedicated `__tests__` folder per module.
- Name tests clearly: `*.test.js` / `*.test.ts(x)`.
- Before opening a PR, run frontend lint/type-check and backend test command.

## Commit & Pull Request Guidelines
Recent history uses short, informal commit messages (for example: `updated code`, `daily page done`). For new work, keep messages concise but specific:
- Format: `<area>: <what changed>` (example: `frontend: refine scanner filters`).

PRs should include:
- clear summary and affected areas (`frontend`, `backend`, `db`, `infra`),
- linked issue/task,
- screenshots/video for UI changes,
- migration/config notes when `prisma/`, `.env`, or Docker setup changes.
