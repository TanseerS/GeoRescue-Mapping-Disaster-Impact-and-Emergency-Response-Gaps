import type { Context } from "aws-lambda";
import { recordFailure, runIngestion } from "../ingest/ingest";
import { createLogger } from "../shared/logger";
import { S3ObjectStore } from "../shared/s3Store";

const bucket = process.env.DATA_BUCKET;
const config = {
  usgsBaseUrl: (process.env.USGS_FEED_BASE_URL ?? "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary").replace(/\/$/, ""),
  windowDays: Number(process.env.WINDOW_DAYS ?? "30"),
};
const store = bucket ? new S3ObjectStore(bucket) : null;

/** Invoked by EventBridge Scheduler every 5 minutes. */
export async function handler(_event: unknown, context: Context) {
  const logger = createLogger({ function: "ingest", requestId: context.awsRequestId });
  if (!store) throw new Error("DATA_BUCKET environment variable is not set");
  const startedAt = Date.now();
  try {
    const result = await runIngestion(config, { store, logger });
    return result.status === "success" ? { status: "success", feedGenerated: result.record.feedGenerated } : result;
  } catch (err) {
    const error = err as Error;
    logger.error("ingestion.failed", { error, durationMs: Date.now() - startedAt });
    await recordFailure(store, error, startedAt, Date.now(), config.windowDays, logger);
    // Rethrow so the invocation counts in the Lambda Errors metric (alarmed) and async retry applies.
    throw error;
  }
}
