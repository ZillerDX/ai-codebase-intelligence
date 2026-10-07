# Deploying to Cloudflare Pages

Live: https://codepulse-9dl.pages.dev

The app is a static Angular site (hash routing, no server code). Cloudflare Pages builds it from this repository on every push to `main` and gives each pull request a preview URL. GitHub Actions only runs checks (`frontend-ci.yml`); it does not deploy.

## How the project is set up (Cloudflare dashboard)

**Workers & Pages → Create → Continue to Pages → Import an existing Git repository**, then select `ZillerDX/ai-codebase-intelligence`.

| Setting | Value |
| :-- | :-- |
| Project name | `codepulse` (Cloudflare adds a suffix when the name is taken, hence `codepulse-9dl.pages.dev`) |
| Production branch | `main` |
| Framework preset | None |
| Root directory | `frontend/codebase-intelligence-web` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist/codebase-intelligence-web/browser` |
| Build variable (Settings → Variables and secrets) | `NODE_VERSION` = `24.15.0` |

## Node version (important)

Angular 22 needs Node 24.15.0+ or 22.22.3+. Cloudflare's build image maps `.node-version` `24` to 24.13.1, and the Angular CLI then refuses to run. Use an exact version: `frontend/codebase-intelligence-web/.node-version` contains `24.15.0`, and the `NODE_VERSION` build variable matches it. Raise both together when upgrading.

## Why this needs no extra configuration

- **Routing:** hash URLs (`/#/r/owner/repo/overview`), so refresh and deep links work without redirect rules.
- **Base path:** served from the root, so the default `<base href="/">` is correct.
- **Headers:** `public/_headers` is copied into the build output and sets security headers and long caching for hashed files (checked on the live site).
- **Secrets:** none. The browser calls `api.github.com` and `raw.githubusercontent.com` directly; the optional AI backend is only used on localhost.

## Custom domain (optional)

Pages project → **Custom domains**. The domain must be a zone in the same Cloudflare account (nameservers pointing to Cloudflare; turn DNSSEC off at the registrar before moving them, and check that existing records such as MX are present before switching).

## Manual deploy and troubleshooting

- Re-run a failed build: project → Deployments → the failed row → **…** → Retry deployment.
- Read the build log under the deployment's **Details**. The most common failure is the Node version above.
- The Cloudflare GitHub app was authorised for the GitHub account; narrow it to this repository in GitHub → Settings → Applications → Cloudflare Workers and Pages → Configure if you prefer least privilege.
- No CSP yet: Mermaid and Angular use inline styles, so one needs testing against the real headers first.
