import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createApi } from "../api/api";
import { createLogger } from "../shared/logger";
import { S3ObjectStore } from "../shared/s3Store";

const bucket = process.env.DATA_BUCKET;
const logger = createLogger({ function: "api" });
const handle = bucket
  ? createApi(
      {
        staleAfterSeconds: Number(process.env.STALE_AFTER_SECONDS ?? "900"),
        cacheTtlMs: Number(process.env.CACHE_TTL_SECONDS ?? "30") * 1000,
      },
      { store: new S3ObjectStore(bucket), logger },
    )
  : null;

/** HTTP API (payload format 2.0). CORS is enforced by API Gateway using the stack's AllowedOrigins. */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  if (!handle) {
    logger.error("api.misconfigured", { reason: "DATA_BUCKET environment variable is not set" });
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: "Internal server error." }) };
  }
  const query: Record<string, string | undefined> = { ...(event.queryStringParameters ?? {}) };
  return handle({
    method: event.requestContext.http.method,
    path: event.rawPath,
    query,
    headers: event.headers ?? {},
  });
}
