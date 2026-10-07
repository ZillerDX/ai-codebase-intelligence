import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalysisService } from '../core/analysis.service';
import { fileUrl, plural } from '../core/format';
import { buildDocs } from '../core/reports';
import { AiCommentary } from '../ui/ai-commentary';
import { SourceBadge } from '../ui/badges';
import { CoverageNote, PageHeader, StateMessage } from '../ui/page';

const ENDPOINT_PAGE = 25;

@Component({
  selector: 'app-docs',
  imports: [PageHeader, SourceBadge, CoverageNote, AiCommentary, StateMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      @if (report(); as r) {
        <app-page-header
          eyebrow="Documentation"
          title="What this project is and how to run it"
          lead="Pulled from the repository's own README, scripts and code. Nothing here is invented."
        >
          <app-source-badge kind="computed" />
        </app-page-header>

        <section class="block" aria-labelledby="about-title">
          <h2 id="about-title">About</h2>
          @if (r.overview) {
            <div class="card prose">
              @for (
                p of r.overview.split(
                  '

'
                );
                track $index
              ) {
                <p>{{ p }}</p>
              }
              @if (!r.hasReadme) {
                <p class="muted small">
                  No README was found, so this is the repository description from GitHub.
                </p>
              }
            </div>
          } @else {
            <app-state-message
              tone="empty"
              title="No README or description"
              message="The repository does not explain itself, which makes it harder for newcomers."
            />
          }
        </section>

        <section class="block" aria-labelledby="start-title">
          <h2 id="start-title">Getting started</h2>
          @if (r.gettingStarted.length > 0) {
            <ol class="steps card">
              @for (s of r.gettingStarted; track s.command) {
                <li>
                  <code class="cmd">{{ s.command }}</code>
                  <span class="muted">{{ s.note }}</span>
                </li>
              }
            </ol>
            <p class="muted small">
              Commands are inferred from the files in the repository. Check its README for the exact
              steps.
            </p>
          } @else {
            <app-state-message
              tone="empty"
              title="We could not infer run commands"
              message="No package.json, project file or other known build file was found near the top of the repository."
            />
          }
        </section>

        <section class="block" aria-labelledby="ep-title">
          <h2 id="ep-title">Web endpoints we found</h2>
          @if (r.endpoints.length > 0) {
            <div class="table-wrap card flush">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col">Path</th>
                    <th scope="col">Declared in</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of visibleEndpoints(); track $index) {
                    <tr>
                      <td>
                        <span class="method" [attr.data-method]="e.method">{{ e.method }}</span>
                      </td>
                      <td class="mono">{{ e.path }}</td>
                      <td>
                        <a
                          class="mono"
                          [href]="link(f.htmlUrl, f.branch, e.file, e.line)"
                          target="_blank"
                          rel="noopener"
                          >{{ e.file }}:{{ e.line }}</a
                        >
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (r.endpoints.length > shown()) {
              <p>
                <button type="button" class="btn btn-ghost" (click)="shown.set(shown() + 25)">
                  Show more ({{ plural(r.endpoints.length - shown(), 'more endpoint') }})
                </button>
              </p>
            }
            <p class="muted small">
              Found by matching common routing patterns (Express, ASP.NET, Flask/FastAPI, Spring,
              NestJS, Go) in the files we read.
            </p>
          } @else {
            <app-state-message
              tone="empty"
              title="No endpoints detected"
              message="We did not find web routes in the files we read. This is normal for libraries, apps and tools that are not web servers."
            />
          }
        </section>

        <section class="block" aria-labelledby="struct-title">
          <h2 id="struct-title">Where things live</h2>
          <ul class="structure card">
            @for (s of r.structure; track s.name) {
              <li>
                <code>{{ s.name }}</code>
                <span class="chip">{{ s.layer }}</span>
                <span class="muted">{{ plural(s.fileCount, 'file') }}</span>
              </li>
            }
          </ul>
        </section>

        <app-coverage-note [facts]="f" />
        <div class="ai"><app-ai-commentary kind="docs" [facts]="f" /></div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .block {
      margin-bottom: var(--s-6);
    }
    .block h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--s-3);
    }
    .prose {
      display: grid;
      gap: var(--s-3);
      max-width: 72ch;
    }
    .small {
      font-size: var(--text-xs);
      margin-top: var(--s-2);
    }
    .steps {
      margin: 0;
      padding: var(--s-4) var(--s-5) var(--s-4) var(--s-7);
      display: grid;
      gap: var(--s-3);
    }
    .steps li {
      display: grid;
      gap: var(--s-1);
    }
    .cmd {
      background: var(--surface-2);
      padding: var(--s-1) var(--s-3);
      border-radius: var(--radius-sm);
      width: fit-content;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .flush {
      padding: 0;
      margin-bottom: var(--s-3);
    }
    .method {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 700;
      padding: 2px var(--s-2);
      border-radius: 6px;
      background: var(--surface-2);
    }
    .structure {
      list-style: none;
      margin: 0;
      display: grid;
      gap: var(--s-2);
    }
    .structure li {
      display: flex;
      gap: var(--s-3);
      align-items: center;
      flex-wrap: wrap;
    }
    .ai {
      margin-top: var(--s-5);
    }
  `,
})
export class Docs {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;
  protected readonly shown = signal(ENDPOINT_PAGE);
  protected readonly report = computed(() => {
    const f = this.facts();
    return f ? buildDocs(f) : null;
  });
  protected readonly visibleEndpoints = computed(
    () => this.report()?.endpoints.slice(0, this.shown()) ?? [],
  );
  protected link = fileUrl;
  protected plural = plural;
}
