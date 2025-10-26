/**
 * Shared utility functions
 */
export declare function formatKDA(kills: number, deaths: number, assists: number): string;
export declare function formatPercentage(value: number, decimals?: number): string;
export declare function formatDuration(seconds: number): string;
export declare function formatNumber(value: number, decimals?: number): string;
export declare function calculateKDA(kills: number, deaths: number, assists: number): number;
export declare function calculateWinRate(wins: number, total: number): number;
export declare function calculateCSPerMin(cs: number, durationSeconds: number): number;
export declare function calculateAverage(values: number[]): number;
export declare function calculateMedian(values: number[]): number;
export declare function calculatePercentile(value: number, values: number[]): number;
export interface TrendResult {
    slope: number;
    correlation: number;
    improvementPercentage: number;
}
export declare function calculateTrend(values: number[]): TrendResult;
export declare function getTimeAgo(timestamp: string | number): string;
export declare function isWithinDays(timestamp: string | number, days: number): boolean;
export declare function isValidPUUID(puuid: string): boolean;
export declare function isValidSummonerName(name: string): boolean;
export declare function isValidRegion(region: string): boolean;
export declare function hashPlayerId(puuid: string): Promise<string>;
export declare function groupBy<T, K extends string | number>(array: T[], key: (item: T) => K): Record<K, T[]>;
export declare function sortBy<T>(array: T[], key: (item: T) => number, desc?: boolean): T[];
export declare function take<T>(array: T[], count: number): T[];
export declare class RiftRewindError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
export declare function createError(code: string, message: string, details?: Record<string, unknown>): RiftRewindError;
