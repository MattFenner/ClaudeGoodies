export function replace<T>(items: T[], existing: T, next: T): T[] {
  const index = items.indexOf(existing);
  if (index === -1) return items;

  const updated = [...items];
  updated.splice(index, 1, next);
  return updated;
}
