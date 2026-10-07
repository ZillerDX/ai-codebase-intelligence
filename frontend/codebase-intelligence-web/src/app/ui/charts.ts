import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LanguageShare } from '../core/models';

export interface BarItem {
  label: string;
  value: number;
  tone?: 'critical' | 'major' | 'minor' | 'accent';
}

@Component({
  selector: 'app-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bars" [attr.aria-label]="label()">
      @for (item of rows(); track item.label) {
        <li>
          <span class="name">{{ item.label }}</span>
          <span class="track" aria-hidden="true">
            <span
              class="fill"
              [attr.data-tone]="item.tone ?? 'accent'"
              [style.width.%]="item.width"
            ></span>
          </span>
          <span class="value">{{ item.value }}</span>
        </li>
      }
    </ul>
    @if (rows().length === 0) {
      <p class="muted">{{ empty() }}</p>
    }
  `,
  styles: `
    .bars {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-3);
    }
    li {
      display: grid;
      grid-template-columns: minmax(110px, 38%) 1fr 3ch;
      align-items: center;
      gap: var(--s-3);
      font-size: var(--text-sm);
    }
    .track {
      height: 12px;
      background: var(--surface-2);
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      min-width: 4px;
    }
    .fill[data-tone='accent'] {
      background: var(--accent);
    }
    .fill[data-tone='critical'] {
      background: var(--critical);
    }
    .fill[data-tone='major'] {
      background: var(--major);
    }
    .fill[data-tone='minor'] {
      background: var(--minor);
    }
    .value {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
  `,
})
export class Bars {
  readonly items = input.required<BarItem[]>();
  readonly label = input('Chart');
  readonly empty = input('Nothing to show.');

  protected readonly rows = computed(() => {
    const items = this.items().filter((i) => i.value > 0);
    const max = Math.max(1, ...items.map((i) => i.value));
    return items.map((i) => ({ ...i, width: (i.value / max) * 100 }));
  });
}

const LANGUAGE_COLORS = [
  '#b5472a',
  '#d98b5f',
  '#e0b184',
  '#8a6f4e',
  '#5b6b73',
  '#8fa3a0',
  '#3f6b4f',
  '#7b6a9c',
  '#c9bba0',
];

@Component({
  selector: 'app-language-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" role="img" [attr.aria-label]="summary()">
      @for (l of shown(); track l.name; let i = $index) {
        <span [style.width.%]="l.percent" [style.background]="color(i)"></span>
      }
    </div>
    <ul class="legend">
      @for (l of shown(); track l.name; let i = $index) {
        <li>
          <span class="swatch" [style.background]="color(i)" aria-hidden="true"></span>
          {{ l.name }}
          <span class="muted"
            >{{ l.percent < 1 ? '<1' : l.percent.toFixed(l.percent < 10 ? 1 : 0) }}%</span
          >
        </li>
      }
    </ul>
  `,
  styles: `
    .bar {
      display: flex;
      height: 14px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--surface-2);
      gap: 2px;
    }
    .bar span {
      display: block;
      min-width: 3px;
    }
    .legend {
      list-style: none;
      margin: var(--s-3) 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2) var(--s-5);
      font-size: var(--text-sm);
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: var(--s-1);
    }
  `,
})
export class LanguageBar {
  readonly languages = input.required<LanguageShare[]>();
  protected readonly shown = computed(() => this.languages().filter((l) => l.percent > 0));
  protected readonly summary = computed(
    () =>
      'Language mix: ' +
      this.shown()
        .map((l) => `${l.name} ${l.percent.toFixed(0)}%`)
        .join(', '),
  );

  protected color(i: number): string {
    return LANGUAGE_COLORS[i % LANGUAGE_COLORS.length];
  }
}
