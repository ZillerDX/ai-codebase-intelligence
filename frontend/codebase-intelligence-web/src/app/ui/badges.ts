import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Severity } from '../core/models';

@Component({
  selector: 'app-source-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class.ai]="kind() === 'ai'" [attr.title]="title()">
    <span aria-hidden="true">{{ kind() === 'ai' ? '✦' : '✓' }}</span>
    {{ label() }}
  </span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
      padding: 2px var(--s-3);
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
      background: var(--computed-soft);
      color: var(--computed);
    }
    .badge.ai {
      background: var(--ai-soft);
      color: var(--ai);
    }
  `,
})
export class SourceBadge {
  readonly kind = input<'computed' | 'ai'>('computed');
  protected readonly label = computed(() =>
    this.kind() === 'ai' ? 'AI commentary' : 'Computed from the repository',
  );
  protected readonly title = computed(() =>
    this.kind() === 'ai'
      ? 'Written by an AI model from the facts shown on this page. It can be wrong; check it against the code.'
      : 'Every number and list on this page comes from the files and metadata we read from GitHub.',
  );
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
};
const SEVERITY_GLYPH: Record<Severity, string> = { critical: '◆', major: '▲', minor: '●' };

@Component({
  selector: 'app-severity-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [attr.data-severity]="severity()">
    <span aria-hidden="true">{{ glyph() }}</span>
    {{ label() }}
  </span>`,
  styles: `
    .pill {
      display: inline-flex;
      align-items: center;
      gap: var(--s-1);
      padding: 2px var(--s-3);
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
      white-space: nowrap;
    }
    .pill[data-severity='critical'] {
      background: var(--critical-soft);
      color: var(--critical);
    }
    .pill[data-severity='major'] {
      background: var(--major-soft);
      color: var(--major-ink);
    }
    .pill[data-severity='minor'] {
      background: var(--minor-soft);
      color: var(--minor);
    }
  `,
})
export class SeverityPill {
  readonly severity = input.required<Severity>();
  protected readonly label = computed(() => SEVERITY_LABEL[this.severity()]);
  protected readonly glyph = computed(() => SEVERITY_GLYPH[this.severity()]);
}
