# PLAN — Move hosting from GitHub Pages to Cloudflare Pages

Branch: `chore/cloudflare-pages` (from `main`, local). Previous work (Angular 22 + redesign + real analysis) is merged in PR #1.

## Decisions
- Cloudflare Pages with **Git integration** (Cloudflare builds; no secrets in GitHub). Setup steps in `docs/DEPLOY.md`.
- GitHub Pages deploy workflow removed; `frontend-ci.yml` runs contrast check, tests and a production build on PRs and pushes.
- Served from the site root: default `<base href="/">`, `build:gh-pages` script removed. Hash routing needs no redirect rules.
- `public/_headers`: security headers and immutable caching for hashed files.
- No CSP yet (Mermaid and Angular use inline styles; needs testing against real headers).

## Milestones
- [x] Repo changes merged in PR #2 (CI workflow, `_headers`, docs, Node pin).
- [x] **Deployed** to Cloudflare as a Worker with static assets: https://codepulse.jodnoi.workers.dev (`wrangler.jsonc`, `npm run deploy`). Checked live: cold deep link, real analysis of OWASP/NodeGoat (8 findings), fonts, security and cache headers, unknown-path fallback, 0 console errors.
- [ ] Optional: connect the repo in Cloudflare (Settings → Builds) so merges deploy automatically.
- [ ] Turn off GitHub Pages in repo Settings; update the repo website link to the new URL.

## Notes
- `wrangler pages project create` created a Worker named `codepulse` (Cloudflare now maps Pages commands to Workers), so the project shows under Workers & Pages, not as a separate Pages project.
- Deploys are manual until the Builds connection is set up.

## Next
Merge the PR that records this setup, then decide whether to connect automatic builds (docs/DEPLOY.md).
