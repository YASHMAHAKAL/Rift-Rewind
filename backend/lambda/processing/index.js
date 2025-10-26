"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
/**
 * Processing Lambda - Compute stats and create match fragments
 *
 * This function:
 * 1. Reads raw match data from S3
 * 2. Computes per-match and aggregate statistics
 * 3. Creates match fragments for RAG
 * 4. Stores processed data in S3 and DynamoDB
 */
const handler = async (event) => {
    console.log('Processing Lambda invoked', { event });
    try {
        // TODO: Read raw match data from S3
        // TODO: Compute statistics (KDA, CS/min, trends, etc.)
        // TODO: Create match fragments (early/mid/late game)
        // TODO: Store in DynamoDB (matches table)
        // TODO: Store fragments in processed bucket
        // TODO: Trigger AI Lambda for embeddings
        console.log('Processing complete (placeholder)');
    }
    catch (error) {
        console.error('Error in processing:', error);
        throw error;
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7Ozs7Ozs7R0FRRztBQUVJLE1BQU0sT0FBTyxHQUFHLEtBQUssRUFBRSxLQUFjLEVBQWlCLEVBQUU7SUFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFFcEQsSUFBSSxDQUFDO1FBQ0gsb0NBQW9DO1FBQ3BDLHVEQUF1RDtRQUN2RCxxREFBcUQ7UUFDckQsMENBQTBDO1FBQzFDLDRDQUE0QztRQUM1Qyx5Q0FBeUM7UUFFekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM3QyxNQUFNLEtBQUssQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDLENBQUM7QUFoQlcsUUFBQSxPQUFPLFdBZ0JsQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFMzRXZlbnQgfSBmcm9tICdhd3MtbGFtYmRhJztcblxuLyoqXG4gKiBQcm9jZXNzaW5nIExhbWJkYSAtIENvbXB1dGUgc3RhdHMgYW5kIGNyZWF0ZSBtYXRjaCBmcmFnbWVudHNcbiAqIFxuICogVGhpcyBmdW5jdGlvbjpcbiAqIDEuIFJlYWRzIHJhdyBtYXRjaCBkYXRhIGZyb20gUzNcbiAqIDIuIENvbXB1dGVzIHBlci1tYXRjaCBhbmQgYWdncmVnYXRlIHN0YXRpc3RpY3NcbiAqIDMuIENyZWF0ZXMgbWF0Y2ggZnJhZ21lbnRzIGZvciBSQUdcbiAqIDQuIFN0b3JlcyBwcm9jZXNzZWQgZGF0YSBpbiBTMyBhbmQgRHluYW1vREJcbiAqL1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogUzNFdmVudCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zb2xlLmxvZygnUHJvY2Vzc2luZyBMYW1iZGEgaW52b2tlZCcsIHsgZXZlbnQgfSk7XG5cbiAgdHJ5IHtcbiAgICAvLyBUT0RPOiBSZWFkIHJhdyBtYXRjaCBkYXRhIGZyb20gUzNcbiAgICAvLyBUT0RPOiBDb21wdXRlIHN0YXRpc3RpY3MgKEtEQSwgQ1MvbWluLCB0cmVuZHMsIGV0Yy4pXG4gICAgLy8gVE9ETzogQ3JlYXRlIG1hdGNoIGZyYWdtZW50cyAoZWFybHkvbWlkL2xhdGUgZ2FtZSlcbiAgICAvLyBUT0RPOiBTdG9yZSBpbiBEeW5hbW9EQiAobWF0Y2hlcyB0YWJsZSlcbiAgICAvLyBUT0RPOiBTdG9yZSBmcmFnbWVudHMgaW4gcHJvY2Vzc2VkIGJ1Y2tldFxuICAgIC8vIFRPRE86IFRyaWdnZXIgQUkgTGFtYmRhIGZvciBlbWJlZGRpbmdzXG5cbiAgICBjb25zb2xlLmxvZygnUHJvY2Vzc2luZyBjb21wbGV0ZSAocGxhY2Vob2xkZXIpJyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgaW4gcHJvY2Vzc2luZzonLCBlcnJvcik7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG4iXX0=