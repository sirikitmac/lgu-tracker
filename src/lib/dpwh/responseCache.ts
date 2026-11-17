/**
 * A small in-memory cache for the map's requests, so panning back, clearing a
 * filter or clicking the same region again does not ask the server twice.
 * Entries expire (the data only changes with the weekly sync) and the oldest
 * are dropped first. Failed requests are never kept.
 */
export class ResponseCache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly maxEntries = 60,
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency: a Map iterates in insertion order.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
