# Angular 22 upgrade + full UX/UI redesign + real repository analysis

Date: 2026-10-07. Status: approved by the owner in chat (sections 1-4), extended with the "must work for real" requirement.

## Goal and audience
A portfolio-grade tool: a first-time visitor pastes a GitHub link (or clicks a sample) and, with no sign-in and no learning curve, gets a **real** review of that repository. Success = analysis of any public repo link works end to end and every number on screen is traceable to repository data.

## Decisions (agreed)
- Primary use: showcase / demo (portfolio). UI language: English, plain wording.
- Look: Warm Editorial. Paper `#FAF6EF`, ink `#2B2118`, one accent terracotta `#B5472A`; severity colours separate from accent. Fonts: Plus Jakarta Sans (headings, numbers, UI; replaced Fraunces after its odd letterforms hurt readability), JetBrains Mono (paths, code). Fonts self-hosted via `@fontsource-variable/*`.
- Navigation: left sidebar with 3 groups (Understand / Check health / Try it), welcome page before any repo is chosen, one URL per page.
- Structure: standalone components, signals, lazy routes, design tokens in one CSS file, no UI library, no chart library.
- Order: Angular 22 upgrade first (done, `chore/angular-22`), then redesign (`feat/redesign-ui`).

## Revision: real analysis (supersedes parts of section 3)
The old numbers (PRs, active users, review comments accepted, sample projects) were fabricated, so they are removed instead of restyled.

**Architecture: one analysis engine in the browser, backend adds AI commentary.**
- The Angular app gathers facts from GitHub (works on GitHub Pages and on localhost): repo metadata, languages (bytes), recursive tree (with file sizes), merged PR count, contributors, README, manifests, and the content of up to ~120 prioritised source files via `raw.githubusercontent.com`.
- A pure TypeScript scanner turns that into `RepoFacts`: real LOC for scanned files, estimated LOC from bytes for the rest (marked "est."), rule-based findings with file/line/snippet, framework detection, route detection, a file-reference graph (which scanned files mention which other files) and largest files.
- All six pages are computed from `RepoFacts` by pure functions. Result source is `heuristic` (computed from repo data).
- Backend (.NET) is optional: `POST /api/analysis/ai/narrative` receives compact facts and returns Gemini commentary (architecture summary, docs overview, debt roadmap, impact advice). The UI shows it in a separate "AI commentary" box with an AI badge. Without a key, or on GitHub Pages, the box is simply absent. AI never overrides computed facts, and fallback/canned text is never shown for analysed repos.
- GitHub API limits: unauthenticated 60 requests/hour per IP (about 5 per analysis; file content comes from raw.githubusercontent.com which is not API-limited). An optional token (kept in memory only) raises the limit. Private repos are out of scope.

## Pages
- `/` Welcome: link input, three real sample repos, how it works, honesty note.
- `/r/:owner/:repo/overview`: key takeaway, real KPIs (stars, contributors, merged PRs, open issues, last push, files, LOC), language bar, findings by severity and by category, links to next pages.
- `architecture`: components from real directories, generated Mermaid diagram from the reference graph, tech stack from manifests.
- `docs`: README summary, getting started from real scripts, detected endpoints table with file:line, project structure.
- `security`: real findings with severity, file:line, snippet, recommendation; filter by severity.
- `debt`: transparent score with the formula shown, refactor targets from real evidence, rough effort estimate.
- `what-if`: pick a file, see real dependents, tests that mention it, risk level and diagram; optional AI advice.
- Hash routing (`/#/r/owner/repo/overview`) so deep links and refresh work on GitHub Pages without a server fallback.

## Scanner rules (initial set, each unit-tested)
Hardcoded secrets, string-built SQL, `eval`/`new Function`, unsafe HTML sinks, disabled TLS verification, weak hashes (MD5/SHA1), empty catch blocks, wildcard CORS, very large files. TODO/FIXME counted for debt. Findings are labelled "possible" where regex cannot prove exploitability.

## Error and empty states
Invalid link, repo not found/private, GitHub rate limit (shows reset time and token option), network failure, empty repo, truncated tree. Each shows a plain message and a retry or next step.

## Testing and verification
Unit: scanner rules, reference graph, route detection, report builders, debt formula, takeaway sentence, repo-link parser, GitHub client with mocked fetch, AI merge. Component smoke tests per page. Backend: narrative endpoint validation and fallback. Manual on localhost against real repositories, 375/768/1280 widths, keyboard-only pass, contrast ratios computed by script, zero console errors. Final check against the built `gh-pages` bundle.

## Out of scope
Dark mode, i18n, private repos, server-side persistence, removal of the legacy canned backend endpoints (kept, no longer used by the UI; flagged for cleanup).
