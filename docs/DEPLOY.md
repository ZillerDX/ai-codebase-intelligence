# Deploying to Cloudflare

Live: https://codepulse.jodnoi.workers.dev

The app is a static Angular site (hash routing, no server code). It is served by Cloudflare as a Worker with static assets, which is the current form of Cloudflare Pages: `wrangler pages ...` now creates and deploys these Workers. GitHub Actions only runs checks (`frontend-ci.yml`); it does not deploy.

## Deploy by hand

```bash
cd frontend/codebase-intelligence-web
npx wrangler login        # once per machine
npm run deploy            # npm run build, then npx wrangler deploy
```

`wrangler.jsonc` points `assets.directory` at `dist/codebase-intelligence-web/browser`. The worker name `codepulse` decides the URL (`codepulse.<your-subdomain>.workers.dev`).

## Deploy automatically on every merge (optional)

In the Cloudflare dashboard open **Workers & Pages → codepulse → Settings → Builds → Connect** and choose this repository:

| Setting | Value |
| :-- | :-- |
| Production branch | `main` |
| Root directory | `frontend/codebase-intelligence-web` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |

Node comes from `.node-version` (24); Angular 22 needs Node 22.22.3+ or 24.15+. Pull requests then get preview builds. No secrets are needed in GitHub.

## Why this needs no extra configuration

- **Routing:** hash URLs (`/#/r/owner/repo/overview`), so refresh and deep links work without redirect rules. Unknown paths fall back to `index.html` (`not_found_handling`), which redirects to the home page.
- **Base path:** served from the root, so the default `<base href="/">` is correct.
- **Headers:** `public/_headers` is copied into the build output and sets security headers and long caching for hashed files (checked on the live site).
- **Secrets:** none. The browser calls `api.github.com` and `raw.githubusercontent.com` directly; the optional AI backend is only used on localhost.

## Housekeeping

- Turn off GitHub Pages in the repository settings (the old `github.io` URL still serves its last version).
- Optional: add a custom domain to the Worker (**Settings → Domains & Routes**).
- No CSP yet: Mermaid and Angular use inline styles, so one needs testing against the real headers first.
