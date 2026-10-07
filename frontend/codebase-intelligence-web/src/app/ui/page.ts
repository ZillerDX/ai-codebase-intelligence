import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RepoFacts } from '../core/models';
import { plural } from '../core/format';
import { scannedCodeCount } from '../core/scanner';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ title() }}</h1>
      <p class="lead">{{ lead() }}</p>
      <div class="extra"><ng-content /></div>
    </header>
  `,
  styles: `
    header {
      margin-bottom: var(--s-6);
    }
    h1 {
      font-size: var(--text-2xl);
      margin: var(--s-1) 0 var(--s-3);
    }
    .lead {
      font-size: var(--text-lg);
      color: var(--ink-2);
      max-width: 62ch;
    }
    .extra:not(:empty) {
      margin-top: var(--s-4);
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-3);
      align-items: center;
    }
  `,
})
export class PageHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input.required<string>();
}

@Component({
  selector: 'app-state-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="box"
      [attr.data-tone]="tone()"
      [attr.role]="tone() === 'error' ? 'alert' : 'status'"
    >
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .box {
      background: var(--surface);
      border: 1px solid var(--line);
      border-left: 4px solid var(--line-strong);
      border-radius: var(--radius);
      padding: var(--s-5);
      max-width: 62ch;
    }
    .box[data-tone='error'] {
      border-left-color: var(--critical);
    }
    h2 {
      font-size: var(--text-lg);
      margin-bottom: var(--s-2);
    }
    .actions:not(:empty) {
      margin-top: var(--s-4);
      display: flex;
      gap: var(--s-3);
      flex-wrap: wrap;
    }
  `,
})
export class StateMessage {
  readonly tone = input<'error' | 'empty' | 'info'>('info');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
}

@Component({
  selector: 'app-coverage-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="note">{{ text() }}</p>`,
  styles: `
    .note {
      color: var(--ink-2);
      font-size: var(--text-xs);
      max-width: 70ch;
    }
  `,
})
export class CoverageNote {
  readonly facts = input.required<RepoFacts>();
  protected readonly text = computed(() => {
    const f = this.facts();
    const base = `Based on ${scannedCodeCount(f.scanned)} of ${plural(f.codeFileCount, 'source file')} that we read from the repository.`;
    const skipped =
      f.skippedLargeFiles > 0
        ? ` ${plural(f.skippedLargeFiles, 'file')} over 150 KB ${f.skippedLargeFiles === 1 ? 'was' : 'were'} skipped.`
        : '';
    const truncated = f.treeTruncated
      ? ' GitHub returned a partial file list for this very large repository.'
      : '';
    return base + skipped + truncated;
  });
}
