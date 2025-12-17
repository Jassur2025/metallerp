export function mergeById<T extends { id: string }>(localItems: T[], remoteItems: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of remoteItems) merged.set(item.id, item);
  for (const item of localItems) merged.set(item.id, item);
  return Array.from(merged.values());
}



