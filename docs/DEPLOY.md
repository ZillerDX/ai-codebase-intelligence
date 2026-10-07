# Deploying to Cloudflare Pages

The app is a static Angular site (hash routing, no server needed). Cloudflare Pages builds it from this repository with its Git integration. GitHub Actions only runs checks (`frontend-ci.yml`); it does not deploy.

## One-time setup (Cloudflare dashboard)

1. **Workers & Pages → Create → Pages → Connect to Git**, then pick `ZillerDX/ai-codebase-intelligence`.
2. Set up the build:

   | Setting | Value |
   | :-- | :-- |
   | Production branch | `main` |
   | Framework preset | None (or Angular) |
   | Root directory | `frontend/codebase-intelligence-web` |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist/codebase-intelligence-web/browser` |

3. Under **Settings → Variables and secrets** (build), the Node version comes from `frontend/codebase-intelligence-web/.node-version` (24). If your project ignores it, add `NODE_VERSION = 24`. Angular 22 needs Node 22.22.3+ or 24.15+.
4. Save and deploy. The site is served at `https://<project-name>.pages.dev`.

Every pull request gets its own preview URL; merging to `main` updates production.

## Why this needs no extra configuration

- **Routing:** the app uses hash URLs (`/#/r/owner/repo/overview`), so refresh and deep links work without redirect rules.
- **Base path:** Cloudflare serves from the site root, so the default `<base href="/">` is correct (GitHub Pages needed `/ai-codebase-intelligence/`).
- **Headers:** `public/_headers` is copied into the build output and sets security headers and long caching for hashed files.
- **Secrets:** none. The browser calls `api.github.com` and `raw.githubusercontent.com` directly; the optional AI backend is only used on localhost.

## After the first deploy

- Update the repository's website link (GitHub → About) and the "Live app" link in `README.md` to the new URL.
- Optional: add a custom domain under **Custom domains** in the Pages project.
- When you are happy, turn off GitHub Pages (Settings → Pages) so the old URL stops serving the previous version.

## Local check of the production build

```bash
cd frontend/codebase-intelligence-web
npm ci && npm run build
npx http-server dist/codebase-intelligence-web/browser   # or any static server, served from the root
```

## Good to know

Cloudflare's documentation now recommends Workers with static assets for new projects and has a migration guide from Pages. Pages keeps working, and this app would move over by adding a `wrangler.jsonc` with `assets.directory` pointing at the same build output; nothing else in the app changes.
