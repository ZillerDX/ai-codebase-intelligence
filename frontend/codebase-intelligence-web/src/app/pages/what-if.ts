import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from '../core/analysis.service';
import { fileUrl, plural } from '../core/format';
import { buildImpact, ImpactReport } from '../core/reports';
import { isCodeFile } from '../core/scanner';
import { AiCommentary } from '../ui/ai-commentary';
import { SourceBadge } from '../ui/badges';
import { MermaidDiagram } from '../ui/mermaid-diagram';
import { CoverageNote, PageHeader, StateMessage } from '../ui/page';

const RISK_TEXT: Record<ImpactReport['risk'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  critical: 'Very high risk',
  unknown: 'Cannot tell',
};

@Component({
  selector: 'app-what-if',
  imports: [
    FormsModule,
    PageHeader,
    SourceBadge,
    MermaidDiagram,
    CoverageNote,
    AiCommentary,
    StateMessage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      <app-page-header
        eyebrow="Try it"
        title="What if I change a file?"
        lead="Pick a file to see which other files mention it, and which tests might need to run, before you edit it."
      >
        <app-source-badge kind="computed" />
      </app-page-header>

      <form class="card form" (ngSubmit)="check()" novalidate>
        <div class="field">
          <label for="target">File to change</label>
          <input
            id="target"
            class="input mono"
            name="target"
            list="files"
            autocomplete="off"
            spellcheck="false"
            placeholder="Start typing a file path"
            [ngModel]="target()"
            (ngModelChange)="target.set($event)"
          />
          <datalist id="files">
            @for (p of suggestions(); track p) {
              <option [value]="p"></option>
            }
          </datalist>
          <span class="hint"
            >Suggestions are the source files we read, because those are the ones we can
            trace.</span
          >
        </div>

        @if (popular().length > 0) {
          <div class="quick">
            <span class="muted">Most depended-on files:</span>
            @for (p of popular(); track p.path) {
              <button type="button" class="chip pick" (click)="pick(p.path)">
                {{ short(p.path) }} ({{ p.count }})
              </button>
            }
          </div>
        }

        <div class="field">
          <label for="change">What do you plan to change? (optional)</label>
          <textarea
            id="change"
            class="input"
            name="change"
            placeholder="For example: rename a method, change the return type, split this class"
            [ngModel]="change()"
            (ngModelChange)="change.set($event)"
          ></textarea>
          <span class="hint"
            >Only used for the optional AI commentary. The file tracing below does not depend on
            it.</span
          >
        </div>

        <div>
          <button type="submit" class="btn btn-primary" [disabled]="!target().trim()">
            Check impact
          </button>
        </div>
      </form>

      @if (report(); as r) {
        <section class="result" aria-live="polite" aria-labelledby="result-title">
          <h2 id="result-title" class="mono">{{ r.target }}</h2>

          @if (!r.traceable) {
            <app-state-message
              tone="info"
              title="We cannot trace this one"
              [message]="r.untraceableReason"
            />
          } @else {
            <div class="risk card" [attr.data-risk]="r.risk">
              <p class="risk-label">{{ riskText(r.risk) }}</p>
              <ul>
                @for (reason of r.riskReasons; track reason) {
                  <li>{{ reason }}</li>
                }
              </ul>
            </div>

            <div class="cols">
              <section class="card" aria-labelledby="direct-title">
                <h3 id="direct-title">Files that mention it ({{ r.dependents.length }})</h3>
                @if (r.dependents.length > 0) {
                  <ul class="paths">
                    @for (p of r.dependents; track p) {
                      <li>
                        <a
                          class="mono"
                          [href]="link(f.htmlUrl, f.branch, p)"
                          target="_blank"
                          rel="noopener"
                          >{{ p }}</a
                        >
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="muted">None of the files we read mention it.</p>
                }
              </section>

              <section class="card" aria-labelledby="test-title">
                <h3 id="test-title">Tests that mention it ({{ r.tests.length }})</h3>
                @if (r.tests.length > 0) {
                  <ul class="paths">
                    @for (p of r.tests; track p) {
                      <li>
                        <a
                          class="mono"
                          [href]="link(f.htmlUrl, f.branch, p)"
                          target="_blank"
                          rel="noopener"
                          >{{ p }}</a
                        >
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="muted">
                    No test file we read mentions it. A change here may not be covered by tests.
                  </p>
                }
              </section>
            </div>

            @if (r.indirect.length > 0) {
              <section class="card block" aria-labelledby="ind-title">
                <h3 id="ind-title">One step further ({{ r.indirect.length }})</h3>
                <p class="muted small">Files that mention the files above.</p>
                <ul class="paths">
                  @for (p of r.indirect.slice(0, 15); track p) {
                    <li>
                      <a
                        class="mono"
                        [href]="link(f.htmlUrl, f.branch, p)"
                        target="_blank"
                        rel="noopener"
                        >{{ p }}</a
                      >
                    </li>
                  }
                </ul>
                @if (r.indirect.length > 15) {
                  <p class="muted small">…and {{ plural(r.indirect.length - 15, 'more file') }}.</p>
                }
              </section>
            }

            <section class="block" aria-labelledby="map-title">
              <h3 id="map-title">Map of the ripple</h3>
              <app-mermaid-diagram
                [code]="r.mermaid"
                label="Files affected by changing the selected file"
              />
            </section>

            <p class="muted small">
              {{ plural(r.siblings, 'other file') }} sit in the same folder. We trace by file name,
              so dynamic imports and name clashes can be missed.
            </p>
            <app-ai-commentary kind="impact" [facts]="f" [impact]="aiImpact()" />
          }
          <app-coverage-note [facts]="f" />
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .form {
      display: grid;
      gap: var(--s-4);
      max-width: 760px;
      margin-bottom: var(--s-6);
    }
    .quick {
      display: flex;
      gap: var(--s-2);
      flex-wrap: wrap;
      align-items: center;
      font-size: var(--text-xs);
    }
    .pick {
      cursor: pointer;
      color: var(--accent-strong);
      background: var(--accent-soft);
      border-color: var(--accent-soft);
      min-height: 32px;
    }
    .result h2 {
      font-size: var(--text-lg);
      font-family: var(--font-mono);
      margin-bottom: var(--s-4);
      overflow-wrap: anywhere;
    }
    h3 {
      font-size: var(--text-md);
      margin-bottom: var(--s-3);
    }
    .risk {
      border-left: 4px solid var(--minor);
      margin-bottom: var(--s-4);
    }
    .risk[data-risk='medium'] {
      border-left-color: var(--major);
    }
    .risk[data-risk='high'],
    .risk[data-risk='critical'] {
      border-left-color: var(--critical);
    }
    .risk-label {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      margin-bottom: var(--s-2);
    }
    .risk ul {
      margin: 0;
      padding-left: var(--s-5);
      display: grid;
      gap: var(--s-1);
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--s-4);
      margin-bottom: var(--s-4);
    }
    .paths {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-2);
      overflow-wrap: anywhere;
    }
    .block {
      margin-bottom: var(--s-4);
    }
    .small {
      font-size: var(--text-xs);
      margin-bottom: var(--s-3);
    }
  `,
})
export class WhatIf {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;

  protected readonly target = signal('');
  protected readonly change = signal('');
  protected readonly checked = signal<{ target: string; change: string } | null>(null);

  protected readonly suggestions = computed(() =>
    (this.facts()?.scanned ?? [])
      .filter((s) => isCodeFile(s.path))
      .map((s) => s.path)
      .sort(),
  );

  protected readonly popular = computed(() => {
    const refs = this.facts()?.references ?? {};
    return Object.entries(refs)
      .map(([path, list]) => ({ path, count: list.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  protected readonly report = computed(() => {
    const f = this.facts();
    const c = this.checked();
    return f && c ? buildImpact(f, c.target) : null;
  });

  protected readonly aiImpact = computed(() => {
    const r = this.report();
    const c = this.checked();
    return r && c && r.traceable ? { report: r, change: c.change } : undefined;
  });

  protected link = fileUrl;
  protected plural = plural;

  protected riskText(risk: ImpactReport['risk']): string {
    return RISK_TEXT[risk];
  }

  protected short(path: string): string {
    return path.split('/').slice(-2).join('/');
  }

  protected pick(path: string): void {
    this.target.set(path);
    this.check();
  }

  protected check(): void {
    const t = this.target().trim();
    if (t) this.checked.set({ target: t, change: this.change().trim() });
  }
}
