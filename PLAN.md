# PLAN — Angular 22 + redesign + real analysis

Spec: `docs/superpowers/specs/2026-10-07-angular22-redesign-design.md`. Size: Large.
Branches (local only, nothing pushed): `fix/review-findings` (committed) -> `chore/angular-22` (committed) -> `feat/redesign-ui` (current).

## Milestones
- [x] **P0** Commit review fixes (a9a1ae5).
- [x] **P1** Angular 22.2.1 + TS 6 upgrade; 7 tests + `build:gh-pages` pass (3e512ce).
- [ ] **R1 Engine**: `core/` github client, scanner, reports, analysis service + unit tests. Done when: tests pass and a real repo analysed in a script/browser returns real facts.
- [ ] **R2 Foundations**: tokens, fonts, shell + sidebar, hash routes, shared UI (badge, bars, states, mermaid component, diagram viewer).
- [ ] **R3 Welcome + import flow** (progress, errors, token, samples).
- [ ] **R4 Overview + Architecture + Docs.**
- [ ] **R5 Security + Debt.**
- [ ] **R6 What-if** (real dependents).
- [ ] **R7 Backend AI narrative** endpoint + tests; frontend AI box.
- [ ] **R8 Cleanup**: delete old `app.html/css/ts` + old models/services, README + screenshots, CI/Node note.

## Local verification
```
cd backend && dotnet test CodebaseIntelligence.Api.Tests
cd frontend/codebase-intelligence-web && npm test -- --watch=false && npm run build:gh-pages
dotnet run --project backend/CodebaseIntelligence.Api   # 5080 (optional AI)
cd frontend/codebase-intelligence-web && npx ng serve    # 4200
```
Try: http://localhost:4200 -> paste `https://github.com/expressjs/express` -> walk every sidebar page.

## Production checklist
Merge order: fix/review-findings -> chore/angular-22 -> feat/redesign-ui. Pages deploy triggers on push to `main`; check Node >= 22.22.3 in `deploy-pages.yml` (Angular 22 requirement); hash routing means no 404 fallback needed. Gemini key only matters locally.

## Next
R1: write `src/app/core/*` and tests.
