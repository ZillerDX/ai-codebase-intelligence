import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AnalysisService } from '../core/analysis.service';
import { plural } from '../core/format';
import { buildArchitecture } from '../core/reports';
import { AiCommentary } from '../ui/ai-commentary';
import { SourceBadge } from '../ui/badges';
import { MermaidDiagram } from '../ui/mermaid-diagram';
import { CoverageNote, PageHeader, StateMessage } from '../ui/page';

@Component({
  selector: 'app-architecture',
  imports: [PageHeader, SourceBadge, MermaidDiagram, CoverageNote, AiCommentary, StateMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      @if (report(); as r) {
        <app-page-header
          eyebrow="How it is built"
          [title]="r.pattern"
          lead="The main areas of the repository and how they depend on each other, worked out from the real file tree."
        >
          <app-source-badge kind="computed" />
        </app-page-header>

        <p class="summary">{{ r.summary }}</p>

        @if (r.components.length === 0) {
          <app-state-message
            tone="empty"
            title="No clear structure to draw"
            message="This repository has too few source files for us to split it into areas."
          />
        } @else {
          <section aria-labelledby="diagram-title" class="block">
            <h2 id="diagram-title">Map of the main areas</h2>
            <p class="muted sub">
              An arrow from A to B means files in A mention files in B (found by looking for file
              names in the code we read). Boxes show the number of files.
            </p>
            <app-mermaid-diagram
              [code]="r.mermaid"
              label="Map of the main areas of the repository"
            />
          </section>

          <section aria-labelledby="areas-title" class="block">
            <h2 id="areas-title">The areas, one by one</h2>
            <div class="table-wrap card flush">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Role</th>
                    <th scope="col">Files</th>
                    <th scope="col">Mostly</th>
                    <th scope="col">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of r.components; track c.id) {
                    <tr>
                      <th scope="row" class="mono">{{ c.name }}</th>
                      <td>{{ c.layer }}</td>
                      <td class="num">{{ c.fileCount }}</td>
                      <td>{{ c.topExtensions.length ? c.topExtensions.join(', ') : 'n/a' }}</td>
                      <td>
                        @if (c.dependsOn.length === 0) {
                          <span class="muted">Nothing we could trace</span>
                        } @else {
                          @for (d of c.dependsOn; track d.name; let last = $last) {
                            <span class="mono">{{ d.name }}</span>
                            <span class="muted">({{ plural(d.links, 'link') }})</span>
                            @if (!last) {
                              ,
                            }
                          }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="muted sub">
              "Role" is a guess from the folder name (for example a folder called
              <code>api</code> is labelled API).
            </p>
          </section>
        }

        <section aria-labelledby="stack-title" class="block">
          <h2 id="stack-title">Technology and practices</h2>
          <dl class="card stack">
            @for (t of r.techStack; track t.label) {
              <div>
                <dt>{{ t.label }}</dt>
                <dd>{{ t.value }}</dd>
              </div>
            }
          </dl>
        </section>

        <app-coverage-note [facts]="f" />
        <div class="ai"><app-ai-commentary kind="architecture" [facts]="f" /></div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .summary {
      font-size: var(--text-lg);
      max-width: 70ch;
      margin-bottom: var(--s-6);
    }
    .block {
      margin-bottom: var(--s-6);
    }
    .block h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--s-2);
    }
    .sub {
      font-size: var(--text-xs);
      margin-bottom: var(--s-3);
      max-width: 70ch;
    }
    .flush {
      padding: 0;
    }
    td.num {
      font-variant-numeric: tabular-nums;
    }
    .stack {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--s-4);
    }
    dt {
      font-size: var(--text-xs);
      color: var(--ink-2);
    }
    dd {
      margin: 0;
      font-weight: 700;
    }
    .ai {
      margin-top: var(--s-5);
    }
  `,
})
export class Architecture {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;
  protected readonly report = computed(() => {
    const f = this.facts();
    return f ? buildArchitecture(f) : null;
  });
  protected plural = plural;
}
