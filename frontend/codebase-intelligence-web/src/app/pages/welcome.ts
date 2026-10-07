import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AnalysisService } from '../core/analysis.service';
import { relativeTime } from '../core/format';
import { parseRepoInput, RepoInputError, validateBranch } from '../core/repo-input';

interface Sample {
  repo: string;
  title: string;
  story: string;
  tags: string[];
}

@Component({
  selector: 'app-welcome',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <span class="brand">CodePulse</span>
      <a
        class="muted"
        href="https://github.com/ZillerDX/ai-codebase-intelligence"
        target="_blank"
        rel="noopener"
        >View source on GitHub</a
      >
    </header>

    <main id="main" tabindex="-1">
      <section class="hero">
        <p class="eyebrow">Codebase review in your browser</p>
        <h1>Understand any codebase in minutes.</h1>
        <p class="lead">
          Paste a link to a public GitHub repository. CodePulse reads its real files and shows how
          it is built, what looks risky, and what a change would touch. No sign-in.
        </p>

        <form class="form" (ngSubmit)="analyze()" novalidate>
          <div class="field grow">
            <label for="repo-input">GitHub repository</label>
            <input
              id="repo-input"
              class="input"
              name="repo"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://github.com/expressjs/express  or  expressjs/express"
              [ngModel]="repoText()"
              (ngModelChange)="repoText.set($event); error.set('')"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? 'repo-error' : 'repo-hint'"
            />
          </div>
          <button type="submit" class="btn btn-primary go">Analyze</button>
        </form>
        @if (error()) {
          <p id="repo-error" class="error" role="alert">{{ error() }}</p>
        } @else {
          <p id="repo-hint" class="muted hint">
            Public repositories only. Try one of the examples below if you just want to look around.
          </p>
        }

        <details class="advanced">
          <summary>Advanced options</summary>
          <div class="advanced-body">
            <div class="field">
              <label for="branch-input">Branch (optional)</label>
              <input
                id="branch-input"
                class="input"
                name="branch"
                type="text"
                autocomplete="off"
                placeholder="Default branch"
                [ngModel]="branch()"
                (ngModelChange)="branch.set($event)"
              />
            </div>
            <div class="field">
              <label for="token-input">GitHub token (optional)</label>
              <input
                id="token-input"
                class="input"
                name="token"
                type="password"
                autocomplete="off"
                placeholder="ghp_…"
                [ngModel]="token()"
                (ngModelChange)="token.set($event)"
              />
              <span class="hint">
                Raises GitHub's anonymous limit of 60 requests per hour. It stays in this tab's
                memory and is sent only to api.github.com. It is never saved.
              </span>
            </div>
          </div>
        </details>
      </section>

      <section aria-labelledby="samples-title" class="block">
        <h2 id="samples-title">Or look at a real example</h2>
        <ul class="samples">
          @for (s of samples; track s.repo) {
            <li class="card">
              <h3>{{ s.title }}</h3>
              <p class="muted">{{ s.story }}</p>
              <p class="tags">
                @for (t of s.tags; track t) {
                  <span class="chip">{{ t }}</span>
                }
              </p>
              <p class="repo mono">{{ s.repo }}</p>
              <button type="button" class="btn btn-ghost" (click)="open(s.repo)">
                Analyze this repo
              </button>
            </li>
          }
        </ul>
      </section>

      @if (recent().length > 0) {
        <section aria-labelledby="recent-title" class="block">
          <h2 id="recent-title">Recently analysed in this browser</h2>
          <ul class="recent">
            @for (r of recent(); track r.key) {
              <li>
                <a [routerLink]="['/r', ownerOf(r.fullName), repoOf(r.fullName), 'overview']">{{
                  r.fullName
                }}</a>
                <span class="muted">{{ ago(r.analyzedAt) }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="how-title" class="block">
        <h2 id="how-title">How it works</h2>
        <ol class="steps">
          <li class="card">
            <span class="num" aria-hidden="true">1</span>
            <h3>Read</h3>
            <p class="muted">
              We fetch the repository's file list, details and its most important source files
              straight from GitHub.
            </p>
          </li>
          <li class="card">
            <span class="num" aria-hidden="true">2</span>
            <h3>Analyse</h3>
            <p class="muted">
              Rules look for risky patterns, count code, find endpoints and trace which files
              mention which.
            </p>
          </li>
          <li class="card">
            <span class="num" aria-hidden="true">3</span>
            <h3>Explore</h3>
            <p class="muted">
              Browse the overview, the structure, security issues and debt, or ask what a change
              would affect.
            </p>
          </li>
        </ol>
      </section>

      <section class="block note card" aria-labelledby="honest-title">
        <h2 id="honest-title">What to keep in mind</h2>
        <ul>
          <li>
            Everything runs in your browser. Your repository link goes to GitHub, nowhere else.
          </li>
          <li>
            Findings come from pattern rules, so they can miss things and can flag harmless code.
            Treat them as leads, not verdicts.
          </li>
          <li>
            We read up to about 120 of the most relevant source files, so very large repositories
            are sampled, and the page says so.
          </li>
          <li>
            Optional AI commentary appears only when the local backend runs with a Gemini key.
          </li>
        </ul>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    .top {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: var(--s-5) var(--s-5) 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-4);
      flex-wrap: wrap;
    }
    .brand {
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: 600;
    }
    main {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: 0 var(--s-5) var(--s-8);
    }
    main:focus {
      outline: none;
    }
    .hero {
      padding: var(--s-8) 0 var(--s-6);
      max-width: 820px;
    }
    h1 {
      font-size: var(--text-hero);
      margin: var(--s-3) 0 var(--s-4);
      line-height: 1.08;
    }
    .lead {
      font-size: var(--text-lg);
      color: var(--ink-2);
      max-width: 60ch;
      margin-bottom: var(--s-6);
    }
    .form {
      display: flex;
      gap: var(--s-3);
      align-items: flex-end;
    }
    .grow {
      flex: 1;
    }
    .go {
      min-height: 48px;
      padding: 0 var(--s-6);
    }
    .hint {
      font-size: var(--text-xs);
      margin-top: var(--s-2);
    }
    .error {
      margin-top: var(--s-2);
      color: var(--critical);
      font-weight: 600;
      font-size: var(--text-sm);
    }
    .advanced {
      margin-top: var(--s-4);
    }
    .advanced summary {
      cursor: pointer;
      font-weight: 600;
      font-size: var(--text-sm);
    }
    .advanced-body {
      margin-top: var(--s-3);
      display: grid;
      gap: var(--s-4);
      max-width: 520px;
    }
    .block {
      margin-top: var(--s-7);
    }
    .block > h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--s-4);
    }
    .samples,
    .steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--s-4);
    }
    .samples .card {
      display: flex;
      flex-direction: column;
      gap: var(--s-3);
    }
    .samples .repo {
      color: var(--ink-2);
      margin-top: auto;
    }
    .samples .btn {
      width: 100%;
    }
    .tags {
      display: flex;
      gap: var(--s-2);
      flex-wrap: wrap;
    }
    .recent {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-2);
    }
    .recent li {
      display: flex;
      gap: var(--s-3);
      align-items: baseline;
    }
    .num {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-weight: 700;
      margin-bottom: var(--s-2);
    }
    .note ul {
      margin: 0;
      padding-left: var(--s-5);
      display: grid;
      gap: var(--s-2);
    }
    .note h2 {
      font-size: var(--text-lg);
      margin-bottom: var(--s-3);
    }
    @media (max-width: 640px) {
      .form {
        flex-direction: column;
        align-items: stretch;
      }
      .hero {
        padding-top: var(--s-6);
      }
    }
  `,
})
export class Welcome {
  private readonly router = inject(Router);
  private readonly analysis = inject(AnalysisService);

  protected readonly repoText = signal('');
  protected readonly branch = signal('');
  protected readonly token = signal('');
  protected readonly error = signal('');
  protected readonly recent = signal(this.analysis.recent());

  protected readonly samples: Sample[] = [
    {
      repo: 'ZillerDX/ai-codebase-intelligence',
      title: 'This app, reviewed by itself',
      story:
        'An Angular front end and a .NET API. A good first look at how a two-part project appears here.',
      tags: ['TypeScript', 'C#'],
    },
    {
      repo: 'expressjs/express',
      title: 'A widely used web framework',
      story: 'The classic Node.js server library: small, old, heavily used and well tested.',
      tags: ['JavaScript', 'Node.js'],
    },
    {
      repo: 'pallets/flask',
      title: 'A popular Python micro-framework',
      story: 'A compact Python web framework with its routes, tests and docs in one repository.',
      tags: ['Python', 'Web'],
    },
  ];

  protected analyze(): void {
    try {
      const ref = parseRepoInput(this.repoText());
      const branch = this.branch().trim() ? validateBranch(this.branch()) : undefined;
      this.analysis.token.set(this.token().trim());
      void this.router.navigate(['/r', ref.owner, ref.repo, 'overview'], {
        queryParams: branch ? { branch } : {},
      });
    } catch (e) {
      if (e instanceof RepoInputError) {
        this.error.set(e.message);
        return;
      }
      throw e;
    }
  }

  protected open(repo: string): void {
    this.repoText.set(repo);
    this.branch.set('');
    this.analyze();
  }

  protected ownerOf(fullName: string): string {
    return fullName.split('/')[0];
  }

  protected repoOf(fullName: string): string {
    return fullName.split('/')[1];
  }

  protected ago(iso: string): string {
    return relativeTime(iso);
  }
}
