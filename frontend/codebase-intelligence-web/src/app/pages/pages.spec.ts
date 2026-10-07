import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AiService } from '../core/ai.service';
import { AnalysisService } from '../core/analysis.service';
import { RepoFacts } from '../core/models';
import { shopFacts } from '../core/testing/seed';
import { fakeFetch, SHOP_REPO } from '../core/testing/fake-github';
import { DIAGRAM_RENDERER } from '../core/mermaid';
import { Shell } from '../shell/shell';
import { AiCommentary } from '../ui/ai-commentary';
import { Architecture } from './architecture';
import { Debt } from './debt';
import { Docs } from './docs';
import { Overview } from './overview';
import { Security } from './security';
import { WhatIf } from './what-if';
import { Welcome } from './welcome';

let facts: RepoFacts;

beforeAll(async () => {
  facts = await shopFacts();
});

function text(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function ready(): void {
  TestBed.inject(AnalysisService).state.set({
    status: 'ready',
    ref: facts.ref,
    facts,
    fromCache: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: DIAGRAM_RENDERER, useValue: async () => '<svg data-test="diagram"></svg>' }],
  });
});

describe('Welcome', () => {
  it('shows the headline, the input and real examples', async () => {
    const fixture = TestBed.createComponent(Welcome);
    await settle(fixture);
    expect(text(fixture)).toContain('Understand any codebase in minutes.');
    expect(fixture.nativeElement.querySelector('#repo-input')).toBeTruthy();
    expect(text(fixture)).toContain('expressjs/express');
  });

  it('explains an invalid link instead of navigating', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Welcome);
    await settle(fixture);

    const input = fixture.nativeElement.querySelector('#repo-input') as HTMLInputElement;
    input.value = 'not a repo';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);

    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('GitHub');
  });

  it('navigates to the overview of a valid link and keeps the token out of the URL', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Welcome);
    await settle(fixture);

    const input = fixture.nativeElement.querySelector('#repo-input') as HTMLInputElement;
    input.value = 'https://github.com/expressjs/express';
    input.dispatchEvent(new Event('input'));
    const token = fixture.nativeElement.querySelector('#token-input') as HTMLInputElement;
    token.value = 'ghp_secret';
    token.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith(['/r', 'expressjs', 'express', 'overview'], {
      queryParams: {},
    });
    expect(JSON.stringify(navigate.mock.calls)).not.toContain('ghp_secret');
    expect(TestBed.inject(AnalysisService).token()).toBe('ghp_secret');
  });

  it('lists recently analysed repositories', async () => {
    vi.stubGlobal('fetch', fakeFetch(SHOP_REPO));
    await TestBed.inject(AnalysisService).open({ owner: 'acme', repo: 'shop' });
    const fixture = TestBed.createComponent(Welcome);
    await settle(fixture);
    expect(text(fixture)).toContain('acme/shop');
    vi.unstubAllGlobals();
  });
});

describe('Shell', () => {
  it('shows progress, then the report with grouped navigation', async () => {
    vi.stubGlobal('fetch', fakeFetch(SHOP_REPO));
    const fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('owner', 'acme');
    fixture.componentRef.setInput('repo', 'shop');
    fixture.detectChanges();
    expect(text(fixture)).toContain('Analysing');

    for (let i = 0; i < 20 && !text(fixture).includes('Understand'); i++) {
      await new Promise((r) => setTimeout(r, 25));
      fixture.detectChanges();
    }
    const t = text(fixture);
    expect(t).toContain('acme/shop');
    for (const label of [
      'Understand',
      'Check health',
      'Try it',
      'Overview',
      'How it is built',
      'Documentation',
      'Security issues',
      'Technical debt',
      'What if I change',
    ]) {
      expect(t).toContain(label);
    }
    vi.unstubAllGlobals();
  });

  it('shows a plain error with a retry for a repository that does not exist', async () => {
    vi.stubGlobal('fetch', fakeFetch(SHOP_REPO));
    const fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('owner', 'acme');
    fixture.componentRef.setInput('repo', 'missing');
    for (let i = 0; i < 20 && !text(fixture).includes('find that repository'); i++) {
      await new Promise((r) => setTimeout(r, 25));
      fixture.detectChanges();
    }
    expect(text(fixture)).toContain("We couldn't find that repository");
    expect(text(fixture)).toContain('Try again');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('rejects a malformed repository name in the URL without calling GitHub', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('owner', '..');
    fixture.componentRef.setInput('repo', 'x');
    await settle(fixture);
    expect(text(fixture)).toContain('not a valid repository');
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('report pages', () => {
  it('Overview shows real numbers and the takeaway', async () => {
    ready();
    const fixture = TestBed.createComponent(Overview);
    await settle(fixture);
    const t = text(fixture);
    expect(t).toContain('acme/shop');
    expect(t).toContain('We read 4 of 4 source files');
    expect(t).toContain('1.2k'); // 1234 stars
    expect(t).toContain('42'); // merged PRs
    expect(t).toContain('Computed from the repository');
  });

  it('Architecture shows the pattern, the areas and the diagram', async () => {
    ready();
    const fixture = TestBed.createComponent(Architecture);
    await settle(fixture);
    await new Promise((r) => setTimeout(r, 10));
    fixture.detectChanges();
    const t = text(fixture);
    expect(t).toContain('Web API (Express)');
    expect(t).toContain('src/api');
    expect(t).toContain('src/services');
    expect(fixture.nativeElement.querySelector('svg[data-test="diagram"]')).toBeTruthy();
  });

  it('Docs lists real run commands and endpoints with links to the source line', async () => {
    ready();
    const fixture = TestBed.createComponent(Docs);
    await settle(fixture);
    const t = text(fixture);
    expect(t).toContain('npm install');
    expect(t).toContain('/orders');
    const link = fixture.nativeElement.querySelector(
      'a[href*="/blob/main/src/api/OrderController.ts#L"]',
    );
    expect(link).toBeTruthy();
  });

  it('Security lists findings with file and line, and the filter narrows them', async () => {
    ready();
    const fixture = TestBed.createComponent(Security);
    await settle(fixture);
    expect(text(fixture)).toContain('Possible hardcoded secret');
    expect(text(fixture)).toContain('src/api/OrderController.ts:4');
    expect(text(fixture)).not.toContain('sk9f8a7b6c5d4e3f2a1b');

    const buttons = [...fixture.nativeElement.querySelectorAll('.filter')] as HTMLButtonElement[];
    const minor = buttons.find((b) => b.textContent?.includes('Minor'))!;
    minor.click();
    await settle(fixture);
    expect(minor.getAttribute('aria-pressed')).toBe('true');
    const list = (fixture.nativeElement.querySelector('.findings') as HTMLElement).textContent ?? '';
    expect(list).toContain('Error silently swallowed');
    expect(list).not.toContain('Possible hardcoded secret');
  });

  it('Security says clearly when nothing was found', async () => {
    TestBed.inject(AnalysisService).state.set({
      status: 'ready',
      ref: facts.ref,
      facts: { ...facts, findings: [] },
      fromCache: false,
    });
    const fixture = TestBed.createComponent(Security);
    await settle(fixture);
    expect(text(fixture)).toContain('No findings in the files we read');
  });

  it('Debt shows the score, the maths and the order of work', async () => {
    ready();
    const fixture = TestBed.createComponent(Debt);
    await settle(fixture);
    const t = text(fixture);
    expect(t).toMatch(/\d+\/100/);
    expect(t).toContain('How the score is calculated');
    expect(t).toContain('Critical findings');
    expect(t).toContain('Fix the 2 critical findings first');
    expect(t).toContain('src/api/OrderController.ts');
  });

  it('What-if traces a chosen file to its real dependents and tests', async () => {
    ready();
    const fixture = TestBed.createComponent(WhatIf);
    await settle(fixture);
    const input = fixture.nativeElement.querySelector('#target') as HTMLInputElement;
    input.value = 'src/services/OrderService.ts';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);
    const t = text(fixture);
    expect(t).toContain('Medium risk');
    expect(t).toContain('src/api/OrderController.ts');
    expect(t).toContain('tests/order.test.ts');
  });

  it('What-if is honest about a file it cannot trace', async () => {
    ready();
    const fixture = TestBed.createComponent(WhatIf);
    await settle(fixture);
    const input = fixture.nativeElement.querySelector('#target') as HTMLInputElement;
    input.value = 'package.json';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await settle(fixture);
    expect(text(fixture)).toContain('We cannot trace this one');
  });
});

describe('AiCommentary', () => {
  const narrative = {
    source: 'ai' as const,
    headline: 'A small shop API',
    paragraphs: ['It has an API layer.'],
    bullets: ['Fix the SQL first.'],
  };

  function mount(ai: Partial<AiService>) {
    TestBed.overrideProvider(AiService, { useValue: ai });
    const fixture = TestBed.createComponent(AiCommentary);
    fixture.componentRef.setInput('kind', 'debt');
    fixture.componentRef.setInput('facts', facts);
    return fixture;
  }

  it('renders nothing when AI is not available', async () => {
    const fixture = mount({
      available: (() => false) as never,
      check: async () => false,
      narrative: async () => null,
    });
    await settle(fixture);
    expect(text(fixture).trim()).toBe('');
  });

  it('shows the commentary with an AI badge when the backend answers', async () => {
    const fixture = mount({
      available: (() => true) as never,
      check: async () => true,
      narrative: async () => narrative,
    });
    await settle(fixture);
    await new Promise((r) => setTimeout(r, 10));
    fixture.detectChanges();
    const t = text(fixture);
    expect(t).toContain('A small shop API');
    expect(t).toContain('Fix the SQL first.');
    expect(t).toContain('AI commentary');
    expect(t).toContain('may be wrong');
  });

  it('says it failed, without hiding the facts, when the backend returns nothing', async () => {
    const fixture = mount({
      available: (() => true) as never,
      check: async () => true,
      narrative: async () => null,
    });
    await settle(fixture);
    await new Promise((r) => setTimeout(r, 10));
    fixture.detectChanges();
    expect(text(fixture)).toContain('could not be generated');
  });
});
