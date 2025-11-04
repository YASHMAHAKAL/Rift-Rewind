interface ProcessingEvent {
    puuid: string;
    matchId: string;
    region: string;
}
/**
 * Processing Lambda - Compute stats and create match fragments
 */
export declare const handler: (event: ProcessingEvent) => Promise<void>;
export {};
