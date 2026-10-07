import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AiService } from '../core/ai.service';
import { buildNarrativeRequest, Narrative, NarrativeKind } from '../core/ai-payload';
import { RepoFacts } from '../core/models';
import { ImpactReport } from '../core/reports';
import { SourceBadge } from './badges';

/**
 * Optional AI commentary. Renders nothing at all when the local AI backend is not available,
 * so the page is complete without it.
 */
@Component({
  selector: 'app-ai-commentary',
  imports: [SourceBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="card" aria-live="polite" [attr.aria-label]="'AI commentary'">
        <div class="head">
          <h2>What an AI reviewer says</h2>
          <app-source-badge kind="ai" />
        </div>
        @switch (status()) {
          @case ('loading') {
            <p class="muted">Writing commentary from the facts on this page…</p>
          }
          @case ('failed') {
            <p class="muted">
              The AI commentary could not be generated this time. The facts above are unaffected.
            </p>
          }
          @case ('ready') {
            @if (narrative(); as n) {
              @if (n.headline) {
                <p class="headline">{{ n.headline }}</p>
              }
              @for (p of n.paragraphs; track $index) {
                <p>{{ p }}</p>
              }
              @if (n.bullets.length > 0) {
                <ul>
                  @for (b of n.bullets; track $index) {
                    <li>{{ b }}</li>
                  }
                </ul>
              }
            }
          }
        }
        <p class="muted small">
          Generated from the summary above only (never your code). It may be wrong.
        </p>
      </section>
    }
  `,
  styles: `
    .card {
      border-color: var(--ai-soft);
      background: linear-gradient(var(--surface), var(--surface));
      display: grid;
      gap: var(--s-3);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-3);
      flex-wrap: wrap;
    }
    h2 {
      font-size: var(--text-lg);
    }
    .headline {
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }
    ul {
      margin: 0;
      padding-left: var(--s-5);
      display: grid;
      gap: var(--s-2);
    }
    .small {
      font-size: var(--text-xs);
    }
  `,
})
export class AiCommentary {
  private readonly ai = inject(AiService);

  readonly kind = input.required<NarrativeKind>();
  readonly facts = input.required<RepoFacts>();
  readonly impact = input<{ report: ImpactReport; change: string } | undefined>(undefined);

  protected readonly status = signal<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  protected readonly narrative = signal<Narrative | null>(null);
  protected readonly visible = computed(
    () => this.ai.available() === true && this.status() !== 'idle',
  );

  constructor() {
    void this.ai.check();
    effect(() => {
      const available = this.ai.available();
      const kind = this.kind();
      const facts = this.facts();
      const impact = this.impact();
      if (available !== true) return;
      if (kind === 'impact' && !impact) {
        this.status.set('idle');
        return;
      }
      void this.load(kind, facts, impact);
    });
  }

  private async load(
    kind: NarrativeKind,
    facts: RepoFacts,
    impact?: { report: ImpactReport; change: string },
  ): Promise<void> {
    this.status.set('loading');
    this.narrative.set(null);
    const key = `${facts.fullName}@${facts.analyzedAt}:${kind}:${impact ? impact.report.target + '|' + impact.change : ''}`;
    const result = await this.ai.narrative(key, buildNarrativeRequest(kind, facts, impact));
    this.narrative.set(result);
    this.status.set(result ? 'ready' : 'failed');
  }
}
