# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Expo React Native client (screens, components, services, utils).
- `server/` contains the Node.js Express + Socket.io backend (`server.js`, `src/` services/routes/utils).
- `docs/` includes deployment and developer guides.
- `deploy.sh` and `server/*.sh` scripts manage local/VPS workflows.

## Build, Test, and Development Commands
- `cd server && ./start-all-services.sh`: start backend + Expo dev server with health check (Termux flow).
- `cd server && npm start`: start backend only on port 3001.
- `cd app && npm start`: start Expo dev server only.
- `cd server && ./stop-all-services.sh`: stop all running services.
- `cd server && npm run dev`: run backend in dev mode (same as `npm start`).

## Coding Style & Naming Conventions
- JavaScript (CommonJS in `server/`, ES modules in `app/`).
- Indentation: 2 spaces; prefer async/await over chained promises.
- Naming: `PascalCase` for React components, `camelCase` for functions/variables, kebab-case for project names (validated by `/^[a-zA-Z0-9-_]+$/`).
- No repo-wide formatter or linter is configured; keep changes consistent with existing files.

## Testing Guidelines
- No automated test suite yet; manual testing is documented in `docs/REPORTE_PRUEBAS.md`.
- If you add tests, describe how to run them in the PR and update this file.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`). Keep subject lines short and imperative.
- PRs should include: summary of changes, testing notes (or “not tested”), and screenshots for UI changes.
- Link related issues if applicable.

## Configuration & Environment Notes
- Backend configuration lives in `server/.env` (see `.env.example`).
- App configuration is stored in AsyncStorage (server URL + auth token) on first run.
- The primary environment is Termux on Android; scripts assume Termux paths.
