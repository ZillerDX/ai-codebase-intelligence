import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AnalysisService } from '../core/analysis.service';
import { fileUrl } from '../core/format';
import { buildDebt } from '../core/reports';
import { AiCommentary } from '../ui/ai-commentary';
import { SourceBadge } from '../ui/badges';
import { CoverageNote, PageHeader } from '../ui/page';

@Component({
  selector: 'app-debt',
  imports: [PageHeader, SourceBadge, CoverageNote, AiCommentary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts(); as f) {
      @if (report(); as r) {
        <app-page-header
          eyebrow="Technical debt"
          title="How healthy is the code, and what to fix first"
          lead="A simple score with the maths shown, plus the files that cost the most, in order."
        >
          <app-source-badge kind="computed" />
        </app-page-header>

        <section class="score card" aria-labelledby="score-title">
          <div class="big" [attr.data-grade]="r.grade">
            <p class="num" aria-label="Score {{ r.score }} out of 100">
              {{ r.score }}<span class="of">/100</span>
            </p>
            <p class="grade" id="score-title">{{ r.grade }}</p>
          </div>
          <div class="explain">
            <p>
              <strong>Higher is healthier.</strong> The score starts at 100 and loses points for the
              problems listed below. It is a rough guide for comparing parts of the code over time,
              not a grade for the people who wrote it.
            </p>
            <p class="muted">
              Rough effort to clear what we found: about <strong>{{ r.effortHours }} hours</strong>.
              This is an estimate from the numbers of findings, not a promise.
            </p>
          </div>
        </section>

        <section class="block" aria-labelledby="calc-title">
          <h2 id="calc-title">How the score is calculated</h2>
          <div class="table-wrap card flush">
            <table>
              <thead>
                <tr>
                  <th scope="col">Factor</th>
                  <th scope="col">Detail</th>
                  <th scope="col" class="r">Points lost</th>
                </tr>
              </thead>
              <tbody>
                @for (p of r.penalties; track p.label) {
                  <tr>
                    <th scope="row">{{ p.label }}</th>
                    <td class="muted">{{ p.detail }}</td>
                    <td class="r num">{{ p.penalty === 0 ? '0' : '−' + p.penalty }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="block" aria-labelledby="targets-title">
          <h2 id="targets-title">Fix these files first</h2>
          @if (r.targets.length > 0) {
            <ol class="targets">
              @for (t of r.targets; track t.file) {
                <li class="card">
                  <a
                    class="mono"
                    [href]="link(f.htmlUrl, f.branch, t.file)"
                    target="_blank"
                    rel="noopener"
                    >{{ t.file }}</a
                  >
                  <ul>
                    @for (reason of t.reasons; track reason) {
                      <li>{{ reason }}</li>
                    }
                  </ul>
                </li>
              }
            </ol>
          } @else {
            <p class="card">Nothing stood out in the files we read.</p>
          }
        </section>

        <section class="block" aria-labelledby="road-title">
          <h2 id="road-title">Suggested order of work</h2>
          <ol class="road card">
            @for (step of r.roadmap; track step) {
              <li>{{ step }}</li>
            }
          </ol>
        </section>

        <app-coverage-note [facts]="f" />
        <div class="ai"><app-ai-commentary kind="debt" [facts]="f" /></div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .score {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--s-6);
      align-items: center;
      margin-bottom: var(--s-6);
    }
    .big {
      text-align: center;
      min-width: 160px;
    }
    .num {
      font-family: var(--font-display);
      font-size: 4.5rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .of {
      font-size: var(--text-lg);
      color: var(--ink-2);
    }
    .grade {
      display: inline-block;
      margin-top: var(--s-2);
      padding: 2px var(--s-4);
      border-radius: 999px;
      font-weight: 700;
      background: var(--surface-2);
    }
    .big[data-grade='Healthy'] .grade {
      background: var(--computed-soft);
      color: var(--computed);
    }
    .big[data-grade='Fair'] .grade {
      background: var(--major-soft);
      color: var(--major-ink);
    }
    .big[data-grade='Needs attention'] .grade,
    .big[data-grade='At risk'] .grade {
      background: var(--critical-soft);
      color: var(--critical);
    }
    .explain {
      display: grid;
      gap: var(--s-3);
      max-width: 62ch;
    }
    .block {
      margin-bottom: var(--s-6);
    }
    .block h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--s-3);
    }
    .flush {
      padding: 0;
    }
    .r {
      text-align: right;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    td.num {
      font-weight: 700;
    }
    .targets,
    .road {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--s-3);
      counter-reset: item;
    }
    .targets > li {
      display: grid;
      gap: var(--s-2);
    }
    .targets ul {
      margin: 0;
      padding-left: var(--s-5);
    }
    .road {
      padding: var(--s-4) var(--s-5);
    }
    .road li {
      counter-increment: item;
      display: flex;
      gap: var(--s-3);
    }
    .road li::before {
      content: counter(item);
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-weight: 700;
      display: grid;
      place-items: center;
      font-size: var(--text-xs);
    }
    .ai {
      margin-top: var(--s-5);
    }
    @media (max-width: 640px) {
      .score {
        grid-template-columns: 1fr;
        text-align: center;
      }
    }
  `,
})
export class Debt {
  private readonly analysis = inject(AnalysisService);
  protected readonly facts = this.analysis.facts;
  protected readonly report = computed(() => {
    const f = this.facts();
    return f ? buildDebt(f) : null;
  });
  protected link = fileUrl;
}
