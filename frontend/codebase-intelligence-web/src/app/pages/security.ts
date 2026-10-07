import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalysisService } from '../core/analysis.service';
import { fileUrl, plural } from '../core/format';
import { Severity } from '../core/models';
import { buildSecurity } from '../core/reports';
import { RULE_CATALOG } from '../core/scanner';
import { SourceBadge, SeverityPill } from '../ui/badges';
import { CoverageNote, PageHeader, StateMessage } from '../ui/page';

type Filter = 'all' | Severity;
const PAGE = 20;

@Component({
  selector: 'app-security',
  imports: [PageHeader, SourceBadge, SeverityPill, CoverageNote, StateMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      @if (report(); as r) {
        <app-page-header
          eyebrow="Security issues"
          title="Risky patterns we found"
          lead="Each finding points to a real line in the repository, says why it matters and how to fix it."
        >
          <app-source-badge kind="computed" />
        </app-page-header>

        <p class="caveat card">
          These are <strong>pattern-based checks</strong>, not a full security audit. They can miss
          problems and can flag code that is actually fine, so treat each one as a lead to verify.
        </p>

        @if (r.findings.length === 0) {
          <app-state-message
            tone="info"
            title="No findings in the files we read"
            message="None of our rules matched. That is a good sign, but not a guarantee: we only read part of larger repositories and only check for the patterns listed below."
          />
        } @else {
          <div class="filters" role="group" aria-label="Filter findings by severity">
            @for (opt of filters(); track opt.value) {
              <button
                type="button"
                class="filter"
                [attr.aria-pressed]="filter() === opt.value"
                (click)="setFilter(opt.value)"
              >
                {{ opt.label }} <span class="count">{{ opt.count }}</span>
              </button>
            }
          </div>

          <ul class="findings" aria-live="polite">
            @for (item of visible(); track $index) {
              <li class="card finding">
                <div class="row">
                  <app-severity-pill [severity]="item.severity" />
                  <h2>{{ item.title }}</h2>
                </div>
                <p class="where">
                  <a
                    class="mono"
                    [href]="link(f.htmlUrl, f.branch, item.file, item.line)"
                    target="_blank"
                    rel="noopener"
                    >{{ item.file }}:{{ item.line }}</a
                  >
                  <span class="chip">{{ item.category }}</span>
                </p>
                <pre class="snippet"><code>{{ item.snippet }}</code></pre>
                <p><strong>Why it matters.</strong> {{ item.description }}</p>
                <p><strong>How to fix.</strong> {{ item.recommendation }}</p>
              </li>
            }
          </ul>

          @if (filtered().length > shown()) {
            <p>
              <button type="button" class="btn btn-ghost" (click)="shown.set(shown() + 20)">
                Show more ({{ plural(filtered().length - shown(), 'more finding') }})
              </button>
            </p>
          }
        }

        <details class="rules card">
          <summary>What we check for</summary>
          <ul>
            @for (rule of rules; track rule.id) {
              <li>
                <app-severity-pill [severity]="rule.severity" />
                {{ rule.title }}
              </li>
            }
          </ul>
        </details>

        <app-coverage-note [facts]="f" />
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .caveat {
      margin-bottom: var(--s-5);
      background: var(--major-soft);
      border-color: var(--major);
      max-width: 72ch;
    }
    .filters {
      display: flex;
      gap: var(--s-2);
      flex-wrap: wrap;
      margin-bottom: var(--s-4);
    }
    .filter {
      min-height: 40px;
      padding: 0 var(--s-4);
      border-radius: 999px;
      border: 1px solid var(--field-border);
      background: var(--surface);
      color: var(--ink);
      font: 600 var(--text-sm) var(--font-body);
      cursor: pointer;
    }
    .filter[aria-pressed='true'] {
      background: var(--ink);
      color: var(--paper);
      border-color: var(--ink);
    }
    .count {
      opacity: 0.8;
      margin-left: var(--s-1);
    }
    .findings {
      list-style: none;
      margin: 0 0 var(--s-4);
      padding: 0;
      display: grid;
      gap: var(--s-4);
    }
    .finding {
      display: grid;
      gap: var(--s-3);
    }
    .row {
      display: flex;
      gap: var(--s-3);
      align-items: center;
      flex-wrap: wrap;
    }
    .finding h2 {
      font-size: var(--text-lg);
      font-family: var(--font-body);
      font-weight: 700;
    }
    .where {
      display: flex;
      gap: var(--s-3);
      align-items: center;
      flex-wrap: wrap;
    }
    .snippet {
      margin: 0;
      padding: var(--s-3) var(--s-4);
      background: var(--surface-2);
      border-radius: var(--radius-sm);
      overflow-x: auto;
      font-size: var(--text-xs);
    }
    .rules {
      margin: var(--s-6) 0 var(--s-4);
    }
    .rules summary {
      cursor: pointer;
      font-weight: 700;
    }
    .rules ul {
      list-style: none;
      margin: var(--s-3) 0 0;
      padding: 0;
      display: grid;
      gap: var(--s-2);
    }
  `,
})
export class Security {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;
  protected readonly filter = signal<Filter>('all');
  protected readonly shown = signal(PAGE);
  protected readonly rules = RULE_CATALOG;

  protected readonly report = computed(() => {
    const f = this.facts();
    return f ? buildSecurity(f) : null;
  });

  protected readonly filtered = computed(() => {
    const r = this.report();
    const f = this.filter();
    return !r ? [] : f === 'all' ? r.findings : r.findings.filter((x) => x.severity === f);
  });

  protected readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  protected readonly filters = computed(() => {
    const c = this.report()?.counts ?? { critical: 0, major: 0, minor: 0 };
    return [
      { value: 'all' as Filter, label: 'All', count: c.critical + c.major + c.minor },
      { value: 'critical' as Filter, label: 'Critical', count: c.critical },
      { value: 'major' as Filter, label: 'Major', count: c.major },
      { value: 'minor' as Filter, label: 'Minor', count: c.minor },
    ];
  });

  protected link = fileUrl;
  protected plural = plural;

  protected setFilter(value: Filter): void {
    this.filter.set(value);
    this.shown.set(PAGE);
  }
}
