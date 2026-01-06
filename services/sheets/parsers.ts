export type Row = unknown[];

export function asString(row: Row, idx: number, fallback: string = ''): string {
  const v = row[idx];
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function asNumber(row: Row, idx: number, fallback: number = 0): number {
  const v = row[idx];
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? Number(v.replace(',', '.').replace(/[^\d.-]/g, ''))
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function asOptionalString(row: Row, idx: number): string | undefined {
  const s = asString(row, idx, '').trim();
  return s ? s : undefined;
}

export function asOptionalNumber(row: Row, idx: number): number | undefined {
  const raw = asString(row, idx, '').trim();
  if (!raw) return undefined;
  const n = Number(raw.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function parseJson<T>(row: Row, idx: number, fallback: T): T {
  const raw = asString(row, idx, '').trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function pick<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}


