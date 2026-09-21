export interface CachedCalendarPeriod {
  sessions: any[];
  billings: any[];
  patients: any[];
  fetchedAt: number;
}

const memoryCache = new Map<string, CachedCalendarPeriod>();
const visitedPeriods = new Set<string>();


export function getCalendarCacheKey(viewMode: 'month' | 'week', date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();

  if (viewMode === 'month') {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `month_${year}-${month}`;
  } else {
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    const wYear = weekStart.getFullYear();
    const wMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
    const wDay = String(weekStart.getDate()).padStart(2, '0');
    return `week_${wYear}-${wMonth}-${wDay}`;
  }
}

export function getCalendarCache(key: string): CachedCalendarPeriod | undefined {
  return memoryCache.get(key);
}

export function setCalendarCache(
  key: string,
  data: { sessions: any[]; billings: any[]; patients?: any[] }
): void {
  visitedPeriods.add(key);
  memoryCache.set(key, {
    sessions: data.sessions || [],
    billings: data.billings || [],
    patients: data.patients || [],
    fetchedAt: Date.now()
  });
}

export function hasCalendarCache(key: string): boolean {
  return memoryCache.has(key);
}

export function isPeriodVisited(key: string): boolean {
  return visitedPeriods.has(key);
}

export function markPeriodVisited(key: string): void {
  visitedPeriods.add(key);
}

export function invalidateCalendarCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
  } else {
    memoryCache.clear();
  }
}

export function getVisitedPeriods(): string[] {
  return Array.from(visitedPeriods);
}

export function clearAllCalendarCache(): void {
  memoryCache.clear();
  visitedPeriods.clear();
}
