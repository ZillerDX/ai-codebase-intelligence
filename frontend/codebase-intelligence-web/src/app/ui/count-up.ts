import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

const DURATION_MS = 700;

/** Shows a number that counts up to its value. Shows the final value at once without motion support. */
@Component({
  selector: 'app-count-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ text() }}`,
  styles: `
    :host {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CountUp {
  readonly value = input.required<number>();
  readonly format = input<(n: number) => string>((n) => String(n));

  private readonly current = signal<number | null>(null);
  protected readonly text = () => this.format()(this.current() ?? this.value());

  private from = 0;

  constructor() {
    effect((onCleanup) => {
      const target = this.value();
      if (!canAnimate()) {
        this.current.set(target);
        return;
      }
      const integer = Number.isInteger(target);
      const start = performance.now();
      const from = this.from;
      let frame = 0;
      const tick = (now: number): void => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const raw = from + (target - from) * eased;
        this.current.set(integer ? Math.round(raw) : raw);
        if (t < 1) frame = requestAnimationFrame(tick);
        else this.from = target;
      };
      this.current.set(from);
      frame = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }
}

function canAnimate(): boolean {
  if (typeof matchMedia !== 'function' || typeof requestAnimationFrame !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: no-preference)').matches;
}
