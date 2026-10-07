# PLAN — Move hosting from GitHub Pages to Cloudflare Pages

Branch: `chore/cloudflare-pages` (from `main`, local). Previous work (Angular 22 + redesign + real analysis) is merged in PR #1.

## Decisions
- Cloudflare Pages with **Git integration** (Cloudflare builds; no secrets in GitHub). Setup steps in `docs/DEPLOY.md`.
- GitHub Pages deploy workflow removed; `frontend-ci.yml` runs contrast check, tests and a production build on PRs and pushes.
- Served from the site root: default `<base href="/">`, `build:gh-pages` script removed. Hash routing needs no redirect rules.
- `public/_headers`: security headers and immutable caching for hashed files.
- No CSP yet (Mermaid and Angular use inline styles; needs testing against real headers).

## Milestones
- [x] Repo changes: workflow, headers, `.node-version`, scripts, docs, real page title.
- [x] Verify locally: `npm ci`, tests, contrast, production build, `_headers` present in output, cold deep link served from `/`.
- [ ] **You:** create the Cloudflare Pages project (docs/DEPLOY.md), confirm the first deploy is green.
- [ ] Tell me the `*.pages.dev` URL so README and the repo website link can be updated.
- [ ] Turn off GitHub Pages in repo Settings once Cloudflare is confirmed.

## Production checklist
1. Merge this PR to `main` (frontend CI must be green).
2. Cloudflare project settings: root `frontend/codebase-intelligence-web`, build `npm ci && npm run build`, output `dist/codebase-intelligence-web/browser`, production branch `main`, Node 24 (from `.node-version`).
3. Open the live URL, run one real analysis, open a deep link and refresh.
4. Rollback: Cloudflare keeps previous deployments (roll back in the dashboard); or revert the PR and re-enable the old workflow.

## Next
Review and merge the PR, then create the Cloudflare Pages project following `docs/DEPLOY.md`.
