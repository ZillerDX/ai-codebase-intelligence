# PLAN — Hosting on Cloudflare Pages (Git integration)

Live: https://codepulse-9dl.pages.dev (project `codepulse`). Branch for this record: `chore/pages-git-deploy`.

## Done
- [x] Angular 22, redesign and real analysis merged earlier (PR #1, #2, #3).
- [x] Previous Worker deployment and the `codeplus.dev` zone were removed by the owner; a new Pages project was created through the dashboard and connected to this repository (`main`, auto deploys, preview deployments).
- [x] First build failed on Node 24.13.1; fixed with `NODE_VERSION=24.15.0`, retried: success, 120 files uploaded.
- [x] Verified live: cold deep link, real analysis of OWASP/NodeGoat (8 findings), fonts, security and cache headers, 0 console errors.
- [x] Repo cleaned up: `wrangler.jsonc` and the `deploy` script removed, `.node-version` set to `24.15.0`, docs rewritten.

## Not verified yet
- Automatic deployment from a push: the first deploy was a manual retry. Merging this PR is the first real test (a new deployment should appear and the check on the PR should come from Cloudflare).
- `codeplus.dev` is no longer in Cloudflare; attaching a custom domain needs it added again (see docs/DEPLOY.md).

## Notes
- The Cloudflare GitHub app was installed with access to all repositories (40). Narrowing it to this repo is recommended (GitHub → Settings → Applications).
- The repo website link on GitHub still points to the removed Worker URL until it is updated.

## Production checklist
1. Merge this PR; confirm a new Cloudflare deployment appears for the merge commit and succeeds.
2. Update the repo website link to https://codepulse-9dl.pages.dev.
3. Turn off GitHub Pages in repo Settings if not already done.

## Next
Review and merge this PR, then check Cloudflare → codepulse → Deployments for the automatic build.
