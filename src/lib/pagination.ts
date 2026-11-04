import { invalid } from './errors.js';

export interface ListPage<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
}

// Cursor pagination, newest first. `limit` is 1-100 (default 10); `starting_after` is the last ID of
// the page you already have. Cursors stay valid while new objects arrive, unlike page numbers.
export function paginate<T extends { id: string; created: number }>(
  items: Iterable<T>,
  query: { limit?: unknown; starting_after?: unknown },
): ListPage<T> {
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalid('parameter_invalid', 'limit must be a whole number from 1 to 100.', 'limit');
  }

  const sorted = [...items].sort((a, b) => b.created - a.created || b.id.localeCompare(a.id));
  let start = 0;
  if (query.starting_after !== undefined) {
    const index = sorted.findIndex(item => item.id === query.starting_after);
    if (index === -1) {
      throw invalid('parameter_invalid', `starting_after ${String(query.starting_after)} is not in this list.`, 'starting_after');
    }
    start = index + 1;
  }

  return { object: 'list', data: sorted.slice(start, start + limit), has_more: start + limit < sorted.length };
}
