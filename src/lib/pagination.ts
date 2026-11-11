export type Page<T> = { items: T[]; page: number; pageCount: number; total: number };

export const catalogPageSize = 12;

// Une valeur absente ou invalide revient à la première page.
export function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}

export function paginate<T>(items: T[], requestedPage: number, size = catalogPageSize): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), page, pageCount, total };
}
