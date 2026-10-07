export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'n/a';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? 'n/a' : n.toLocaleString('en-US');
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? singular : pluralForm}`;
}

export function fileUrl(htmlUrl: string, branch: string, path: string, line?: number): string {
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return `${htmlUrl}/blob/${enc(branch)}/${enc(path)}${line ? `#L${line}` : ''}`;
}
