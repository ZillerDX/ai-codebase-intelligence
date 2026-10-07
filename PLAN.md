# PLAN — Angular 22 + redesign + real analysis

Spec: `docs/superpowers/specs/2026-10-07-angular22-redesign-design.md`. Size: Large.
Branches (local only, nothing pushed): `fix/review-findings` -> `chore/angular-22` -> `feat/redesign-ui` (current, contains everything).

## Milestones
- [x] **P0** Review fixes committed.
- [x] **P1** Angular 22.2.1 + TypeScript 6.
- [x] **R1 Engine** (`core/`): GitHub client, scanner, analyzer, reports, analysis service. 72 unit tests.
- [x] **R2 Foundations**: tokens, self-hosted fonts, shell + sidebar, hash routes, shared UI, Mermaid component with expand/zoom.
- [x] **R3 Welcome + import flow**: link input, advanced options (branch, token), real examples, recent list, errors.
- [x] **R4 Overview + Architecture + Docs.**
- [x] **R5 Security + Debt.**
- [x] **R6 What-if** with real dependents and tests.
- [x] **R7 Backend AI narrative** (`/api/analysis/ai/narrative`, `/status`) + frontend AI box.
- [x] **R8 Cleanup**: old UI and fabricated data removed, README, CLAUDE.md, screenshots, CI (Node 24, tests + contrast in Pages workflow).

## Verification (2026-10-07)
- Frontend `npm test`: 90 passed. Backend `dotnet test`: 58 passed. `build:gh-pages`: clean. `check-contrast.mjs`: 24/24 pass.
- Real repositories analysed in the browser: `expressjs/express` (numbers cross-checked against the GitHub API: stars, 570 merged PRs, default branch), `OWASP/NodeGoat` (real `eval(req.body.preTax)` finding at `app/routes/contributions.js:32`), `ZillerDX/ai-codebase-intelligence`.
- Production build served under `/ai-codebase-intelligence/`: deep link `#/r/OWASP/NodeGoat/security` works on a cold load, fonts load, 0 console errors.
- Mobile 375px: no horizontal overflow on all six pages; menu opens, closes after navigation. Keyboard: tab order and visible focus ring checked on the welcome page.
- Error flow checked live (unknown repo) and by tests (rate limit, network, invalid link, empty repo).

## Not verified
- A real Gemini response (no API key available here): the endpoint, validation, grounding prompt and output bounding are unit-tested with a fake HTTP handler; the UI box is tested with a stub service.
- The actual GitHub Pages deployment (needs a push to `main`).
- Behaviour after hitting the anonymous GitHub rate limit in the live UI (covered by unit tests only).

## Known limits / follow-ups
- Pattern rules produce false positives (for example sample secrets inside demo data); the UI says so.
- Legacy canned endpoints in the .NET API are unused; remove in a cleanup PR.
- `ai.service` probes `localhost:5080` on localhost pages only, which logs one failed request in the console when the backend is not running.
- Possible later: dark mode, i18n, more rules, private repos via token for file contents (needs a backend proxy).

## Production checklist
1. Review `git log fix/review-findings..feat/redesign-ui`. Merge order: fix/review-findings -> chore/angular-22 -> feat/redesign-ui (or open one PR from `feat/redesign-ui`).
2. Merging to `main` triggers backend CI and the Pages deploy. The Pages workflow now runs the contrast check and frontend tests before building (Node 24).
3. No new secrets. `GEMINI_API_KEY` only matters for local AI commentary.
4. Rollback: revert the merge commit (stateless, no migrations).

## Next
Review the work, then push the branch and open a PR when you say so: `git push -u origin feat/redesign-ui`. Nothing has been pushed.
