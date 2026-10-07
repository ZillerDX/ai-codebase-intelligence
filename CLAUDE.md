# CodePulse

Reviews any public GitHub repo from a link, in the browser (Angular 22). Optional .NET 10 API adds AI commentary via Gemini. Read `PLAN.md` (`## Next`) first.

## Commands
- Frontend (`frontend/codebase-intelligence-web`): `npm install`, `npm start` (4200), `npm test -- --watch=false`, `npm run build`, `node scripts/check-contrast.mjs`.
- Backend: `dotnet run --project backend/CodebaseIntelligence.Api` (5080), `dotnet test backend/CodebaseIntelligence.Api.Tests`.
- Run a single frontend spec: `npx ng test --watch=false --include "src/app/core/**/*.spec.ts"`.

## Architecture
- All analysis runs in the browser: `src/app/core/` (`github-client` → `analyzer` → `scanner` → `reports`). Reports are pure functions of `RepoFacts`; keep them pure and unit-tested.
- Result source is `computed` (from repo data) or `ai` (backend commentary, shown in its own box, never replaces facts). Never show canned/sample data as if it were analysis.
- Pages are standalone components under `src/app/pages`, lazy routes, hash routing (works on any static host). Shell (`src/app/shell`) owns loading/error states.
- Backend only receives compact facts at `POST /api/analysis/ai/narrative` (validated, size-bounded). It never sees code. `/api/analysis/{id}/...` legacy endpoints are unused by the UI.

## Conventions and gotchas
- Colours, fonts, spacing live in `src/tokens.css` only. Run the contrast script after changing colours. Severity and source are never colour-only.
- Do not add a blanket `* { animation-duration }` reduced-motion rule: it breaks Mermaid's text measurement (diagrams come out thousands of px wide).
- Mermaid runs with `securityLevel: 'strict'`; avoid `subgraph` clusters with cross edges (huge layouts). Diagram rendering is injected via `DIAGRAM_RENDERER` so tests can stub it (`vi.mock` is not supported by the Angular test builder).
- GitHub token is memory-only and sent only to `api.github.com`, never to `raw.githubusercontent.com`; never persist it.
- Bump `FACTS_SCHEMA_VERSION` in `core/models.ts` whenever the shape or meaning of `RepoFacts` changes (invalidates cached analyses).
- Files are LF in the working tree for backend, CRLF warnings from git are expected on Windows.
- Don't write `\n` in tool-generated files through shell heredocs/python strings; verify escapes (they got turned into real newlines more than once).

## Hosting
- Cloudflare Pages (Git integration), project `codepulse`, live at https://codepulse-9dl.pages.dev. Every push to `main` builds and deploys; PRs get preview deployments. Settings: root `frontend/codebase-intelligence-web`, build `npm ci && npm run build`, output `dist/codebase-intelligence-web/browser`, build variable `NODE_VERSION=24.15.0`. See `docs/DEPLOY.md`.
- Cloudflare's build image resolves `.node-version` `24` to 24.13.1, which Angular 22 rejects (needs 24.15.0+ or 22.22.3+). Keep an exact version in `.node-version` and in `NODE_VERSION`.
- `public/_headers` sets headers and caching. GitHub Actions (`frontend-ci.yml`, `backend-ci.yml`) only run checks.
- Served from the site root, so keep `<base href="/">`; do not reintroduce a sub-path build.

## Environment
- Needs Node 22.22.3+ or 24.15+ (Angular 22); `.node-version` pins 24 for CI and Cloudflare. Backend: .NET 10 SDK.
- Env var names: `GEMINI_API_KEY` (or `Gemini:ApiKey` in git-ignored `appsettings.local.json`). Never commit keys.
- Tests: `fake-github.ts` serves a fake repository to the analyzer; use it instead of the network.
