# PLAN — Review Findings Remediation

Branch: `fix/review-findings`. Size: Medium. Source: code review of the whole repo (2026-10-07).

## Goal
Make the results honest and the app safer: users must be able to tell AI results from fallback/heuristic ones, diagrams must not be an XSS vector, GitHub import must validate input, and unknown projects must not silently return another project's data.

## Milestones
Each milestone: build + tests pass before moving on.

- [x] **M1 Provenance of results.** Add `Source` ("ai" | "fallback") to Architecture/Impact/Security/Docs/Debt DTOs; Gemini fallbacks set `fallback`. Frontend interfaces get `source?`, storage-synthesized data is `heuristic`, built-in samples `sample`, ApiService catchError path `offline`. Show a small badge in each tab header.
  Done when: unit tests assert `Source` for AI-success and fallback paths; badge visible on the 5 tabs.
- [x] **M2 Mermaid hardening.** `securityLevel: 'strict'` in `app.ts`.
  Done when: diagrams still render on localhost (architecture + docs tabs), no console errors.
- [x] **M3 GitHub import validation.** One shared `GitHubRepoIdentifier` parser (owner/repo regex, optional branch regex), used by controller and service; branch URL-escaped; single tree fetch; empty tree = error (no fake files); default branch from metadata, not `"main"`.
  Done when: tests for valid/invalid slugs, URL forms, malicious branch (`../`, `?`, `#`), invalid input returns 400.
- [x] **M4 Gemini key in header.** Send `x-goog-api-key` header instead of `?key=`. Missing key is reported as `fallback` source (covered by M1).
  Done when: unit test with fake HttpMessageHandler asserts no key in URL and header present.
- [x] **M5 Unknown project = 404.** `GetProject/GetFileList/GetCodebaseContext` stop falling back to the first project; controller returns 404.
  Done when: tests for 404 on unknown id; existing tests still pass.
- [x] **M6 Text fixes.** `.NET 9.0` -> `.NET 10` in fallback tech stack, remove "Vercel-style pipeline" wording.

## Out of scope (reported, not fixed here)
Real LOC/PR metrics (finding 7), `/upload` rework (8), storage id/seed inconsistencies (9), CancellationToken plumbing, hardcoded port, frontend `any`, more frontend tests. Candidates for the next PR.

## Local verification
```
cd backend && dotnet build CodebaseIntelligence.Api && dotnet test CodebaseIntelligence.Api.Tests
cd frontend/codebase-intelligence-web && npm install && npm test -- --watch=false && npm run build
# run: dotnet run --project backend/CodebaseIntelligence.Api (5080) + npm start (4200)
```
Try: open http://localhost:4200, check badges on each tab (no `GEMINI_API_KEY` => `fallback`), import `dotnet/eShop`, try `GET http://localhost:5080/api/analysis/nope/summary` => 404.

## Production checklist
- Merge to `main` triggers backend CI + Pages deploy; check both workflows green.
- No new env vars (Gemini key is still `Gemini:ApiKey` / `GEMINI_API_KEY`).
- Rollback: revert the merge commit (stateless, no migrations).

## Verification results (2026-10-07)
- `dotnet test`: 42 passed, 0 failed (was 4). `npm test`: 7 passed (was 3). `npm run build`: clean.
- Localhost (no Gemini key): `/nope/summary` -> 404; bad import `../../x` -> 400; `security-smells` -> `"source":"fallback"`.
- Browser: all 5 tabs show the badge ("Sample fallback - AI unavailable"); Mermaid renders with `securityLevel: 'strict'` (architecture, impact, docs); 0 console errors.
- NOT verified: real Gemini response (no API key locally), real GitHub import over the network (not run to avoid rate limits), GitHub Pages build.

## Next
Review diff (`git diff`), then commit on `fix/review-findings` and open PR when you say so. Follow-up PR candidates: see "Out of scope".
