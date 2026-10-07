import { InjectionToken } from '@angular/core';

type MermaidApi = typeof import('mermaid').default;

let loader: Promise<MermaidApi> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value || fallback;
}

function load(): Promise<MermaidApi> {
  loader ??= import('mermaid').then((m) => {
    const mermaid = m.default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      look: 'classic',
      layout: 'dagre',
      fontFamily: token('font-body', 'system-ui, sans-serif'),
      themeVariables: {
        background: token('surface', '#fffdf9'),
        primaryColor: token('accent-soft', '#f6e3da'),
        primaryBorderColor: token('accent', '#b5472a'),
        primaryTextColor: token('ink', '#2b2118'),
        secondaryColor: token('surface-2', '#f3ede2'),
        tertiaryColor: token('surface', '#fffdf9'),
        lineColor: token('ink-2', '#6b5e50'),
        clusterBkg: token('surface-2', '#f3ede2'),
        clusterBorder: token('line-strong', '#d6cbb8'),
        fontSize: '14px',
      },
      flowchart: { curve: 'basis', htmlLabels: false, nodeSpacing: 40, rankSpacing: 70, padding: 12 },
    });
    return mermaid;
  });
  return loader;
}

/** Renders Mermaid code to an SVG string. Calls are serialised because Mermaid is not re-entrant. */
export function renderMermaid(code: string): Promise<string> {
  const run = async () => {
    const mermaid = await load();
    const { svg } = await mermaid.render(`diagram-${++counter}`, code);
    return svg;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Injected so tests can replace real Mermaid rendering (which needs a real browser layout engine). */
export const DIAGRAM_RENDERER = new InjectionToken<(code: string) => Promise<string>>('DIAGRAM_RENDERER', {
  providedIn: 'root',
  factory: () => renderMermaid,
});
