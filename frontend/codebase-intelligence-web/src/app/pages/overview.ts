import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalysisService } from '../core/analysis.service';
import { formatCompact, formatNumber, relativeTime } from '../core/format';
import { buildOverview } from '../core/reports';
import { SourceBadge } from '../ui/badges';
import { Bars, BarItem, LanguageBar } from '../ui/charts';
import { CountUp } from '../ui/count-up';
import { CoverageNote, PageHeader } from '../ui/page';

@Component({
  selector: 'app-overview',
  imports: [RouterLink, CountUp, PageHeader, SourceBadge, Bars, LanguageBar, CoverageNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      @if (report(); as r) {
        <app-page-header
          eyebrow="Overview"
          [title]="f.fullName"
          [lead]="f.description || 'No description was provided for this repository.'"
        >
          <app-source-badge kind="computed" />
          @for (fw of f.frameworks.slice(0, 5); track fw) {
            <span class="chip">{{ fw }}</span>
          }
          @if (f.license) {
            <span class="chip">{{ f.license }} license</span>
          }
        </app-page-header>

        <section class="takeaway card" aria-labelledby="takeaway-title">
          <p class="eyebrow" id="takeaway-title">Key takeaway</p>
          <p class="takeaway-text">{{ r.takeaway }}</p>
          <p class="links">
            <a routerLink="../security" queryParamsHandling="preserve">See the findings</a>
            <a routerLink="../debt" queryParamsHandling="preserve">See the debt score</a>
          </p>
        </section>

        <section class="kpis" aria-label="Key numbers">
          @for (k of r.kpis; track k.label; let i = $index) {
            <div class="kpi card rise" [style.--i]="i" [attr.title]="k.hint">
              <p class="kpi-value">
                @if (k.value === null) {
                  n/a
                } @else {
                  <app-count-up [value]="k.value" [format]="compact" />
                }
                @if (k.estimated) {
                  <span class="est" title="Estimated">≈</span>
                }
              </p>
              <p class="kpi-label">{{ k.label }}</p>
              <p class="kpi-hint muted">{{ k.hint }}</p>
            </div>
          }
        </section>

        <section class="facts card" aria-label="Repository facts">
          <dl>
            <div>
              <dt>Files (excluding vendored)</dt>
              <dd>{{ number(f.totalFiles) }}</dd>
            </div>
            <div>
              <dt>Open issues</dt>
              <dd>{{ number(f.openIssues) }}</dd>
            </div>
            <div>
              <dt>Last push</dt>
              <dd>{{ ago(f.pushedAt) }}</dd>
            </div>
            <div>
              <dt>Branch analysed</dt>
              <dd>{{ f.branch }}</dd>
            </div>
            <div>
              <dt>Tests</dt>
              <dd>{{ f.hasTests ? 'Found' : 'Not found' }}</dd>
            </div>
            <div>
              <dt>CI</dt>
              <dd>{{ f.hasCi ? 'Found' : 'Not found' }}</dd>
            </div>
          </dl>
        </section>

        <div class="grid">
          <section class="card" aria-labelledby="lang-title">
            <h2 id="lang-title">What it is written in</h2>
            <p class="muted sub">Share of code by size, as reported by GitHub.</p>
            @if (r.languages.length > 0) {
              <app-language-bar [languages]="r.languages" />
            } @else {
              <p class="muted">GitHub did not report any languages.</p>
            }
          </section>

          <section class="card" aria-labelledby="sev-title">
            <h2 id="sev-title">Findings by severity</h2>
            <p class="muted sub">From our rules, in the files we read.</p>
            <app-bars
              label="Findings by severity"
              empty="No findings in the files we read."
              [items]="severityItems()"
            />
          </section>

          <section class="card" aria-labelledby="cat-title">
            <h2 id="cat-title">Where the findings are</h2>
            <p class="muted sub">Grouped by kind of problem.</p>
            <app-bars
              label="Findings by category"
              empty="No findings in the files we read."
              [items]="categoryItems()"
            />
          </section>
        </div>

        <app-coverage-note [facts]="f" />

        <section class="next" aria-labelledby="next-title">
          <h2 id="next-title">Where to go next</h2>
          <ul>
            <li class="card">
              <h3>How it is built</h3>
              <p class="muted">The main areas of the code and how they depend on each other.</p>
              <a routerLink="../architecture" queryParamsHandling="preserve">Open the structure</a>
            </li>
            <li class="card">
              <h3>Security issues</h3>
              <p class="muted">Each finding with the file, the line and how to fix it.</p>
              <a routerLink="../security" queryParamsHandling="preserve">Open the findings</a>
            </li>
            <li class="card">
              <h3>What if I change…?</h3>
              <p class="muted">Pick a file and see what mentions it before you touch it.</p>
              <a routerLink="../what-if" queryParamsHandling="preserve">Try a change</a>
            </li>
          </ul>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .takeaway {
      border-left: 4px solid var(--accent);
      margin-bottom: var(--s-5);
    }
    .takeaway-text {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      line-height: 1.3;
      margin: var(--s-2) 0 var(--s-3);
    }
    .links {
      display: flex;
      gap: var(--s-5);
      flex-wrap: wrap;
      font-weight: 600;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: var(--s-4);
      margin-bottom: var(--s-4);
    }
    .kpi-value {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .est {
      font-size: var(--text-lg);
      color: var(--ink-2);
      margin-left: var(--s-1);
    }
    .kpi-label {
      font-weight: 700;
      margin-top: var(--s-2);
    }
    .kpi-hint {
      font-size: var(--text-xs);
      margin-top: var(--s-1);
    }
    .facts {
      margin-bottom: var(--s-4);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--s-4);
      margin-bottom: var(--s-4);
    }
    .card h2 {
      font-size: var(--text-lg);
    }
    .sub {
      font-size: var(--text-xs);
      margin: var(--s-1) 0 var(--s-4);
    }
    .next {
      margin-top: var(--s-7);
    }
    .next h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--s-4);
    }
    .next ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--s-4);
    }
    .next .card {
      display: grid;
      gap: var(--s-2);
      align-content: start;
    }
    .next a {
      font-weight: 700;
    }
  `,
})
export class Overview {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;
  protected readonly report = computed(() => {
    const f = this.facts();
    return f ? buildOverview(f) : null;
  });

  protected readonly severityItems = computed<BarItem[]>(() => {
    const s = this.report()?.severity;
    return s
      ? [
          { label: 'Critical', value: s.critical, tone: 'critical' },
          { label: 'Major', value: s.major, tone: 'major' },
          { label: 'Minor', value: s.minor, tone: 'minor' },
        ]
      : [];
  });

  protected readonly categoryItems = computed<BarItem[]>(
    () =>
      this.report()?.categories.map((c) => ({
        label: c.label,
        value: c.count,
        tone: 'accent' as const,
      })) ?? [],
  );

  protected compact = formatCompact;
  protected number = formatNumber;
  protected ago = (iso: string) => relativeTime(iso);
}
