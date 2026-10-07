import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DIAGRAM_RENDERER } from '../core/mermaid';

@Component({
  selector: 'app-mermaid-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="figure">
      @if (state() === 'error') {
        <div class="fallback" role="note">
          <p>
            <strong>We could not draw this diagram.</strong> Here is the same information as text:
          </p>
          <pre>{{ code() }}</pre>
        </div>
      } @else {
        <div
          class="canvas"
          #canvas
          role="img"
          [attr.aria-label]="label()"
          [class.loading]="state() === 'loading'"
        ></div>
        @if (state() === 'loading') {
          <p class="loading-text muted">Drawing diagram…</p>
        }
      }
      <figcaption>
        <span class="muted">{{ label() }}</span>
        @if (state() === 'ready') {
          <button type="button" class="btn btn-ghost small" (click)="openViewer()">
            Expand and zoom
          </button>
        }
      </figcaption>
    </figure>

    <dialog #dialog class="viewer" [attr.aria-label]="label() + ' (expanded)'" (close)="onClose()">
      <div class="toolbar">
        <strong>{{ label() }}</strong>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost small" (click)="zoom(1.25)" aria-label="Zoom in">
          +
        </button>
        <button type="button" class="btn btn-ghost small" (click)="zoom(0.8)" aria-label="Zoom out">
          −
        </button>
        <button type="button" class="btn btn-ghost small" (click)="reset()">Reset</button>
        <button type="button" class="btn btn-primary small" (click)="closeViewer()">Close</button>
      </div>
      <div
        class="viewport"
        tabindex="0"
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd($event)"
        (pointercancel)="dragEnd($event)"
        (wheel)="onWheel($event)"
        (keydown)="onKey($event)"
      >
        <div class="stage" #stage [style.transform]="transform()"></div>
      </div>
      <p class="muted hint">Drag to move, scroll or use + and − to zoom, press Esc to close.</p>
    </dialog>
  `,
  styles: `
    .figure {
      margin: 0;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .canvas {
      padding: var(--s-4);
      overflow-x: auto;
      display: flex;
      justify-content: center;
      min-height: 120px;
    }
    .canvas.loading {
      visibility: hidden;
      min-height: 80px;
    }
    .loading-text {
      text-align: center;
      padding: var(--s-5);
      margin-top: -100px;
    }
    :host ::ng-deep .canvas svg {
      max-width: 100%;
      height: auto;
    }
    figcaption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-3);
      padding: var(--s-2) var(--s-4);
      border-top: 1px solid var(--line);
      font-size: var(--text-xs);
    }
    .small {
      min-height: 36px;
      padding: 0 var(--s-3);
    }
    .fallback {
      padding: var(--s-4);
    }
    .fallback pre {
      margin: var(--s-3) 0 0;
      white-space: pre-wrap;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--surface-2);
      padding: var(--s-3);
      border-radius: var(--radius-sm);
    }
    .viewer {
      width: min(1200px, 96vw);
      height: min(800px, 92vh);
      padding: var(--s-4);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--ink);
    }
    .viewer[open] {
      display: flex;
      flex-direction: column;
      gap: var(--s-3);
    }
    .viewer::backdrop {
      background: rgb(43 33 24 / 0.55);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: var(--s-2);
    }
    .spacer {
      flex: 1;
    }
    .viewport {
      flex: 1;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--paper);
      cursor: grab;
      touch-action: none;
    }
    .viewport:active {
      cursor: grabbing;
    }
    .stage {
      transform-origin: 0 0;
      width: max-content;
      padding: var(--s-5);
    }
    .hint {
      font-size: var(--text-xs);
    }
  `,
})
export class MermaidDiagram {
  private readonly renderDiagram = inject(DIAGRAM_RENDERER);
  readonly code = input.required<string>();
  readonly label = input('Diagram');

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly transform = signal('translate(0px, 0px) scale(1)');

  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private svg = '';
  private scale = 1;
  private x = 0;
  private y = 0;
  private drag: {
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;
  private renderToken = 0;

  constructor() {
    effect(() => {
      const code = this.code();
      const host = this.canvas();
      void this.draw(code, host?.nativeElement);
    });
  }

  private async draw(code: string, host: HTMLElement | undefined): Promise<void> {
    const token = ++this.renderToken;
    this.state.set('loading');
    if (!code.trim()) {
      this.state.set('error');
      return;
    }
    try {
      const svg = await this.renderDiagram(code);
      if (token !== this.renderToken) return;
      this.svg = svg;
      this.state.set('ready');
      // The canvas only exists once the state is 'ready'/'loading'; wait a tick for the view to update.
      queueMicrotask(() => {
        const el = host ?? this.canvas()?.nativeElement;
        // Mermaid runs with securityLevel "strict", which sanitises the SVG it returns.
        if (el) el.innerHTML = svg;
      });
    } catch (e) {
      if (token !== this.renderToken) return;
      console.warn('Diagram could not be rendered', e);
      this.state.set('error');
    }
  }

  protected openViewer(): void {
    this.reset();
    const dialog = this.dialog().nativeElement;
    const stage = this.stage()?.nativeElement;
    if (stage) stage.innerHTML = this.svg;
    dialog.showModal();
  }

  protected closeViewer(): void {
    this.dialog().nativeElement.close();
  }

  protected onClose(): void {
    const stage = this.stage()?.nativeElement;
    if (stage) stage.innerHTML = '';
  }

  protected zoom(factor: number): void {
    this.scale = Math.min(4, Math.max(0.4, this.scale * factor));
    this.apply();
  }

  protected reset(): void {
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.apply();
  }

  protected dragStart(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: this.x,
      originY: this.y,
    };
  }

  protected dragMove(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    this.x = this.drag.originX + (e.clientX - this.drag.startX);
    this.y = this.drag.originY + (e.clientY - this.drag.startY);
    this.apply();
  }

  protected dragEnd(e: PointerEvent): void {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }

  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.zoom(e.deltaY < 0 ? 1.1 : 0.9);
  }

  protected onKey(e: KeyboardEvent): void {
    const step = 40;
    const handlers: Record<string, () => void> = {
      '+': () => this.zoom(1.25),
      '=': () => this.zoom(1.25),
      '-': () => this.zoom(0.8),
      '0': () => this.reset(),
      ArrowLeft: () => ((this.x += step), this.apply()),
      ArrowRight: () => ((this.x -= step), this.apply()),
      ArrowUp: () => ((this.y += step), this.apply()),
      ArrowDown: () => ((this.y -= step), this.apply()),
    };
    const handler = handlers[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  private apply(): void {
    this.transform.set(`translate(${this.x}px, ${this.y}px) scale(${this.scale})`);
  }
}
