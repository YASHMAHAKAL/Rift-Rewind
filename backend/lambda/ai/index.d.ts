interface AIEvent {
    puuid: string;
    matchId: string;
    region: string;
    fragmentsKey: string;
}
/**
 * AI Lambda - Bedrock integration for insight generation
 */
export declare const handler: (event: AIEvent) => Promise<void>;
export {};
