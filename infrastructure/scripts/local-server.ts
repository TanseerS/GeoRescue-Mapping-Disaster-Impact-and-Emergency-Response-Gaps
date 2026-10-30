/**
 * Local stand-in for the deployed pipeline: runs the real ingestion code against the live USGS feed
 * into an in-memory store on the same 5-minute cadence, and serves the real API handler over HTTP
 * with the same CORS rules as API Gateway. No AWS account or credentials are needed.
 *
 *   npm run local            # http://localhost:3001
 *   PORT=4000 ALLOWED_ORIGINS=http://localhost:5173 npm run local
 */
import { createServer } from "node:http";
import { createApi } from "../src/api/api";
import { createWorldPopProvider } from "../src/api/population";
import { runIngestion } from "../src/ingest/ingest";
import { createLogger } from "../src/shared/logger";
import { MemoryObjectStore } from "../src/shared/storage";

const port = Number(process.env.PORT ?? "3001");
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const intervalMs = Number(process.env.INGEST_INTERVAL_SECONDS ?? "300") * 1000;

const store = new MemoryObjectStore();
const logger = createLogger({ env: "local" });
const config = { usgsBaseUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary", windowDays: 30 };
const handle = createApi({ staleAfterSeconds: 900, cacheTtlMs: 5_000 }, { store, logger, population: createWorldPopProvider() });

async function ingest() {
  try {
    await runIngestion(config, { store, logger: logger.child({ function: "ingest" }) });
  } catch (err) {
    logger.error("ingestion.failed", { error: err });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    res.writeHead(204).end();
    return;
  }
  const result = await handle({
    method: req.method ?? "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: { "accept-encoding": String(req.headers["accept-encoding"] ?? "") },
  });
  res.writeHead(result.statusCode, result.headers);
  res.end(result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body);
}).listen(port, () => {
  logger.info("local.api.listening", { url: `http://localhost:${port}`, allowedOrigins });
  void ingest();
  setInterval(() => void ingest(), intervalMs);
});
