import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AnalysisService } from '../core/analysis.service';
import { relativeTime } from '../core/format';
import { parseRepoInput, RepoInputError, validateBranch } from '../core/repo-input';
import { StateMessage } from '../ui/page';

interface NavItem {
  path: string;
  label: string;
  hint: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const STEP_LABELS = [
  'Reading repository details',
  'Reading the file tree',
  'Reading source files',
  'Scanning for issues',
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, StateMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('ready') {
        <div class="layout">
          <header class="topbar">
            <a routerLink="/" class="brand">CodePulse</a>
            <button
              type="button"
              class="btn btn-ghost menu-btn"
              [attr.aria-expanded]="navOpen()"
              aria-controls="sidebar"
              (click)="navOpen.set(!navOpen())"
            >
              {{ navOpen() ? 'Close menu' : 'Menu' }}
            </button>
          </header>

          <aside id="sidebar" class="sidebar" [class.open]="navOpen()">
            <a routerLink="/" class="brand desktop-only">CodePulse</a>

            <section class="repo" aria-label="Repository being reviewed">
              @if (facts(); as f) {
                <a class="repo-name" [href]="f.htmlUrl" target="_blank" rel="noopener">{{
                  f.fullName
                }}</a>
                <p class="muted small">Branch {{ f.branch }} · analysed {{ analysedAgo() }}</p>
                <div class="repo-actions">
                  <button type="button" class="btn btn-ghost tiny" (click)="refresh()">
                    Re-analyse
                  </button>
                  <a routerLink="/" class="btn btn-ghost tiny">Another repo</a>
                </div>
              }
            </section>

            <nav aria-label="Report sections" #nav>
              <span
                class="pill"
                aria-hidden="true"
                [class.animated]="pillAnimated()"
                [style.height.px]="pill()?.h ?? 0"
                [style.transform]="'translateY(' + (pill()?.y ?? 0) + 'px)'"
                [style.opacity]="pill() ? 1 : 0"
              ></span>
              @for (group of groups; track group.title) {
                <div class="group">
                  <p class="eyebrow">{{ group.title }}</p>
                  <ul>
                    @for (item of group.items; track item.path) {
                      <li>
                        <a
                          [routerLink]="item.path"
                          queryParamsHandling="preserve"
                          routerLinkActive="active"
                          ariaCurrentWhenActive="page"
                          (click)="navOpen.set(false)"
                        >
                          <span class="label">{{ item.label }}</span>
                          <span class="hint">{{ item.hint }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                </div>
              }
            </nav>
          </aside>

          <main id="main" class="content" tabindex="-1">
            <router-outlet />
          </main>
        </div>
      }
      @case ('error') {
        <div class="center">
          @if (failure(); as fail) {
            <app-state-message tone="error" [title]="fail.title" [message]="fail.message">
              <button type="button" class="btn btn-primary" (click)="refresh()">Try again</button>
              <a routerLink="/" class="btn btn-ghost">Choose another repository</a>
            </app-state-message>
          }
        </div>
      }
      @default {
        <div class="center">
          <section class="progress card" aria-live="polite" aria-label="Analysis progress">
            <p class="eyebrow">Analysing</p>
            <h1>{{ repoLabel() }}</h1>
            <p class="muted">This takes about 10 to 30 seconds. Everything runs in your browser.</p>
            <div
              class="bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="4"
              [attr.aria-valuenow]="progress().step"
            >
              <span [style.width.%]="(progress().step / 4) * 100"></span>
            </div>
            <ol>
              @for (label of stepLabels; track label; let i = $index) {
                <li
                  [class.done]="progress().step > i + 1"
                  [class.current]="progress().step === i + 1"
                >
                  <span class="mark" aria-hidden="true">{{
                    progress().step > i + 1 ? '✓' : progress().step === i + 1 ? '…' : ''
                  }}</span>
                  {{ progress().step === i + 1 ? progress().label : label }}
                </li>
              }
            </ol>
            <a routerLink="/" class="muted">Cancel</a>
          </section>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .layout {
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
      min-height: 100vh;
    }
    .topbar {
      display: none;
    }
    .sidebar {
      position: sticky;
      top: 0;
      align-self: start;
      height: 100vh;
      overflow-y: auto;
      padding: var(--s-5);
      /* Soft shadows at the top and bottom edge appear only while there is more to scroll. */
      background:
        linear-gradient(var(--surface) 30%, transparent) top / 100% 24px no-repeat local,
        linear-gradient(transparent, var(--surface) 70%) bottom / 100% 24px no-repeat local,
        radial-gradient(farthest-side at 50% 0, rgb(43 33 24 / 0.16), transparent) top / 100% 10px
          no-repeat scroll,
        radial-gradient(farthest-side at 50% 100%, rgb(43 33 24 / 0.16), transparent) bottom / 100%
          10px no-repeat scroll;
      background-color: var(--surface);
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      gap: var(--s-5);
    }
    .brand {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--ink);
      text-decoration: none;
    }
    .brand:hover {
      color: var(--ink);
    }
    .repo {
      background: var(--surface-2);
      border-radius: var(--radius-sm);
      padding: var(--s-4);
      display: grid;
      gap: var(--s-2);
    }
    .repo-name {
      font-weight: 700;
      word-break: break-word;
    }
    .small {
      font-size: var(--text-xs);
    }
    .repo-actions {
      display: flex;
      gap: var(--s-2);
      flex-wrap: wrap;
    }
    .tiny {
      min-height: 36px;
      padding: 0 var(--s-3);
      font-size: var(--text-xs);
    }
    nav {
      display: grid;
      gap: var(--s-5);
      position: relative;
    }
    .pill {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      pointer-events: none;
    }
    .pill::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 3px 0 0 3px;
      background: var(--accent);
    }
    .pill.animated {
      transition:
        transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
        height 280ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 160ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .pill.animated {
        transition: none;
      }
    }
    .group ul {
      list-style: none;
      margin: var(--s-2) 0 0;
      padding: 0;
      display: grid;
      gap: var(--s-1);
    }
    nav a {
      display: grid;
      padding: var(--s-2) var(--s-3);
      border-radius: var(--radius-sm);
      text-decoration: none;
      color: var(--ink);
      border-left: 3px solid transparent;
      position: relative;
      transition:
        background-color 140ms ease,
        padding-left 160ms ease;
    }
    nav a:hover {
      background: var(--surface-2);
      color: var(--ink);
      padding-left: calc(var(--s-3) + 2px);
    }
    nav a.active,
    nav a.active:hover {
      background: transparent;
    }
    nav a.active .label {
      color: var(--accent-strong);
    }
    .label {
      font-weight: 700;
      font-size: var(--text-sm);
    }
    .hint {
      font-size: var(--text-xs);
      color: var(--ink-2);
    }
    .content {
      padding: var(--s-7) var(--s-6) var(--s-8);
      max-width: calc(var(--content-width) + var(--s-6) * 2);
      width: 100%;
    }
    .content {
      min-width: 0;
    }
    .content:focus {
      outline: none;
    }
    .center {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: var(--s-5);
    }
    .progress {
      width: min(520px, 100%);
      display: grid;
      gap: var(--s-3);
    }
    .progress h1 {
      font-size: var(--text-xl);
      word-break: break-word;
    }
    .bar {
      height: 10px;
      background: var(--surface-2);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--accent);
      transition: width 300ms ease;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-2);
      font-size: var(--text-sm);
      color: var(--ink-2);
    }
    li.current {
      color: var(--ink);
      font-weight: 700;
    }
    li.done {
      color: var(--computed);
    }
    .mark {
      display: inline-block;
      width: 1.5ch;
    }

    @media (max-width: 880px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-3) var(--s-4);
        background: var(--surface);
        border-bottom: 1px solid var(--line);
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .desktop-only,
      .pill {
        display: none;
      }
      .sidebar {
        display: none;
        position: static;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .sidebar.open {
        display: flex;
      }
      .content {
        padding: var(--s-5) var(--s-4) var(--s-7);
      }
    }
  `,
})
export class Shell {
  private readonly analysis = inject(AnalysisService);
  private readonly router = inject(Router);
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');

  readonly owner = input.required<string>();
  readonly repo = input.required<string>();
  readonly branch = input<string | undefined>(undefined);

  protected readonly navOpen = signal(false);
  protected readonly pill = signal<{ y: number; h: number } | null>(null);
  protected readonly pillAnimated = signal(false);
  protected readonly state = this.analysis.state;
  protected readonly facts = this.analysis.facts;
  protected readonly stepLabels = STEP_LABELS;

  protected readonly groups: NavGroup[] = [
    {
      title: 'Understand',
      items: [
        { path: 'overview', label: 'Overview', hint: 'The big picture' },
        { path: 'architecture', label: 'How it is built', hint: 'Areas and how they connect' },
        { path: 'docs', label: 'Documentation', hint: 'Setup and endpoints' },
      ],
    },
    {
      title: 'Check health',
      items: [
        { path: 'security', label: 'Security issues', hint: 'Risky patterns we found' },
        { path: 'debt', label: 'Technical debt', hint: 'Score and what to fix first' },
      ],
    },
    {
      title: 'Try it',
      items: [
        { path: 'what-if', label: 'What if I change…?', hint: 'See what a file change touches' },
      ],
    },
  ];

  protected readonly progress = computed(() => {
    const s = this.state();
    return s.status === 'loading' ? s.progress : { step: 0, total: 4, label: 'Starting' };
  });
  protected readonly failure = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.failure : null;
  });
  protected readonly repoLabel = computed(() => `${this.owner()}/${this.repo()}`);
  protected readonly analysedAgo = computed(() => {
    const f = this.facts();
    return f ? relativeTime(f.analyzedAt) : '';
  });
  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.placePill());
    effect(() => {
      // Place the indicator when the menu first appears or the mobile menu opens.
      this.nav();
      this.navOpen();
      this.placePill();
    });
    effect(() => {
      const owner = this.owner();
      const repo = this.repo();
      const branch = this.branch();
      void this.start(owner, repo, branch, false);
    });
  }

  /** Moves the sliding highlight behind the active menu link once the router has marked it. */
  private placePill(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      const nav = this.nav()?.nativeElement;
      const active = nav?.querySelector<HTMLElement>('a.active');
      if (!active || active.offsetHeight === 0) {
        this.pill.set(null);
        return;
      }
      this.pill.set({ y: active.offsetTop, h: active.offsetHeight });
      // Skip the transition for the first placement so it does not slide in from the top.
      requestAnimationFrame(() => this.pillAnimated.set(true));
    });
  }

  protected refresh(): void {
    void this.start(this.owner(), this.repo(), this.branch(), true);
  }

  private async start(
    owner: string,
    repo: string,
    branch: string | undefined,
    force: boolean,
  ): Promise<void> {
    try {
      const ref = parseRepoInput(`${owner}/${repo}`);
      const cleanBranch = branch ? validateBranch(branch) : undefined;
      await this.analysis.open(ref, { branch: cleanBranch, force });
    } catch (e) {
      if (e instanceof RepoInputError) {
        this.analysis.state.set({
          status: 'error',
          ref: { owner, repo },
          failure: {
            kind: 'not-found',
            title: 'That link is not a valid repository',
            message: e.message,
          },
        });
        return;
      }
      throw e;
    }
  }
}
