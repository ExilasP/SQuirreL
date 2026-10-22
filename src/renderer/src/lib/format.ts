export const display = (v: unknown): string =>
  v === null || v === undefined ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v)
