/**
 * Shared utility functions
 */

// ============================================================================
// Data Formatting
// ============================================================================

export function formatKDA(kills: number, deaths: number, assists: number): string {
  const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;
  return kda.toFixed(2);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatNumber(value: number, decimals: number = 0): string {
  return value.toFixed(decimals);
}

// ============================================================================
// Statistical Calculations
// ============================================================================

export function calculateKDA(kills: number, deaths: number, assists: number): number {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

export function calculateWinRate(wins: number, total: number): number {
  return total === 0 ? 0 : (wins / total) * 100;
}

export function calculateCSPerMin(cs: number, durationSeconds: number): number {
  return (cs / durationSeconds) * 60;
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function calculatePercentile(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  if (index === -1) return 100;
  return (index / sorted.length) * 100;
}

// ============================================================================
// Trend Analysis
// ============================================================================

export interface TrendResult {
  slope: number; // Positive = improving, negative = declining
  correlation: number; // -1 to 1
  improvementPercentage: number;
}

export function calculateTrend(values: number[]): TrendResult {
  if (values.length < 2) {
    return { slope: 0, correlation: 0, improvementPercentage: 0 };
  }

  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  
  // Linear regression
  const xMean = calculateAverage(xValues);
  const yMean = calculateAverage(values);
  
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }
  
  const slope = xDenominator === 0 ? 0 : numerator / xDenominator;
  const correlation = Math.sqrt(xDenominator * yDenominator) === 0 
    ? 0 
    : numerator / Math.sqrt(xDenominator * yDenominator);
  
  const firstValue = values[0];
  const lastValue = values[n - 1];
  const improvementPercentage = firstValue === 0 
    ? 0 
    : ((lastValue - firstValue) / firstValue) * 100;
  
  return { slope, correlation, improvementPercentage };
}

// ============================================================================
// Date/Time Utilities
// ============================================================================

export function getTimeAgo(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return `${diffSec}s ago`;
}

export function isWithinDays(timestamp: string | number, days: number): boolean {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diffMs = now - then;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

// ============================================================================
// Validation
// ============================================================================

export function isValidPUUID(puuid: string): boolean {
  // Riot PUUIDs are 78 characters, alphanumeric + dashes
  return /^[a-zA-Z0-9_-]{78}$/.test(puuid);
}

export function isValidSummonerName(name: string): boolean {
  // 3-16 characters, alphanumeric + spaces
  return /^[a-zA-Z0-9 ]{3,16}$/.test(name);
}

export function isValidRegion(region: string): boolean {
  const validRegions = ['NA1', 'EUW1', 'EUN1', 'KR', 'BR1', 'LA1', 'LA2', 'OC1', 'TR1', 'RU', 'JP1'];
  return validRegions.includes(region);
}

// ============================================================================
// Hashing & Privacy
// ============================================================================

export async function hashPlayerId(puuid: string): Promise<string> {
  // Simple hash for demo (use crypto in production)
  let hash = 0;
  for (let i = 0; i < puuid.length; i++) {
    const char = puuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Array Utilities
// ============================================================================

export function groupBy<T, K extends string | number>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> {
  return array.reduce((acc, item) => {
    const group = key(item);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function sortBy<T>(array: T[], key: (item: T) => number, desc = false): T[] {
  return [...array].sort((a, b) => {
    const aVal = key(a);
    const bVal = key(b);
    return desc ? bVal - aVal : aVal - bVal;
  });
}

export function take<T>(array: T[], count: number): T[] {
  return array.slice(0, count);
}

// ============================================================================
// Error Handling
// ============================================================================

export class RiftRewindError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RiftRewindError';
  }
}

export function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): RiftRewindError {
  return new RiftRewindError(code, message, details);
}
