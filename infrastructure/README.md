# GeoRescue infrastructure (AWS SAM)

This directory is the serverless data pipeline behind GeoRescue. It deploys on its own, separately from the frontend.

```
USGS feed ──► EventBridge Scheduler (every 5 min) ──► Lambda: ingest ──► S3 (private)
                                                                          │
React app ◄── API Gateway (HTTP API, CORS) ◄── Lambda: api ◄──────────────┘
```

| Resource | Purpose |
| --- | --- |
| `AWS::Scheduler::Schedule` | Runs ingestion on `rate(5 minutes)`. Retries delivery failures twice, with an SQS dead-letter queue. |
| `IngestFunction` (Node.js 24, arm64, 512 MB, 90 s) | Fetches USGS `all_day`, validates and normalizes it, merges it into the rolling window and writes to S3. |
| `DataBucket` (S3) | Private GeoJSON storage. Block Public Access, SSE-S3, TLS-only policy, history expiry. Retained when the stack is deleted. |
| `ApiFunction` (Node.js 24, arm64, 512 MB, 10 s) | Serves `/earthquakes`, `/earthquakes/metadata` and `/health` from S3. |
| `HttpApi` (API Gateway v2) | Public HTTPS endpoint with CORS limited to `AllowedOrigins`, throttling and JSON access logs. |
| `IngestionErrorsAlarm` (+ optional SNS email) | Fires when ingestion fails in 2 of 3 consecutive 5-minute periods. |
| `MapApiKey` (optional) | Amazon Location API key limited to `geo-maps:GetTile` and your referrers. |

## S3 layout

| Key | Contents |
| --- | --- |
| `earthquakes/latest.geojson` | Latest processed USGS `all_day` feed |
| `earthquakes/window-30d.geojson` | Rolling 30-day window, which the API serves. Seeded from `all_month` on the first run. |
| `earthquakes/history/YYYY/MM/DD/HH.json` | Hourly snapshots (UTC). Written with `If-None-Match: *`, so they are never overwritten. They expire after `HistoryRetentionDays`. |
| `metadata/latest.json` | Last successful ingestion (with statistics) and the last attempt (success or failure plus error) |

All files are USGS-format GeoJSON `FeatureCollection`s. Each feature keeps its original USGS `properties` and `geometry.coordinates`. Ingestion only rejects malformed records (missing id, time or valid coordinates), de-duplicates by event id (keeping the most recently `updated` copy) and sorts newest first.

## Reliability and data integrity

- **USGS fetch.** Each request has a 15-second timeout and up to 3 attempts with exponential backoff. Network errors, HTTP 429 and 5xx responses are retried. Other 4xx responses and invalid payloads fail fast. A failed run never touches the stored GeoJSON.
- **Duplicate or overlapping runs.** If a feed generation (`metadata.generated`) has already been ingested, the run is skipped without writing anything. The rolling window is written with S3 conditional writes (`If-Match` on its ETag), so a concurrent run re-reads and re-merges instead of overwriting. The merge is idempotent.
- **USGS deletions.** An event that disappears from the 24-hour feed is removed from the window. Events older than the window length expire.
- **Failure visibility.** A failed run logs `ingestion.failed`, writes `lastAttempt.status = "failure"` to the metadata (keeping the last success), and rethrows. That counts toward the Lambda `Errors` metric (alarmed) and triggers one async retry.

## Prerequisites

- An AWS account with permission to create the resources above (CloudFormation, IAM roles, Lambda, S3, API Gateway, EventBridge Scheduler, SQS, CloudWatch, and optionally SNS and Amazon Location)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with credentials (`aws configure`, or `aws login` / SSO)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) 1.120 or newer
- Node.js 20+ and npm. `sam build` bundles with esbuild locally; Docker is not required.

## Deploy

```bash
cd infrastructure
npm install
npm test                      # Lambda unit tests
sam validate --lint           # template validation (cfn-lint)
sam build
sam deploy --guided           # first deployment: answer the prompts, save to samconfig.toml
```

To deploy without prompts, run the following. Replace the origins with your frontend URL(s); include `http://localhost:5173` for local development.

```bash
sam deploy \
  --region us-east-1 \
  --parameter-overrides \
    AllowedOrigins="http://localhost:5173,https://georescue.example.com" \
    CreateMapApiKey=true \
    MapAllowedReferers="http://localhost:5173/*,https://georescue.example.com/*" \
    AlarmEmail=you@example.com
```

### Parameters

| Parameter | Default | Description |
| --- | --- | --- |
| `AllowedOrigins` | `http://localhost:5173,http://localhost:4173` | Origins allowed by CORS (comma-separated, exact match) |
| `IngestionSchedule` | `rate(5 minutes)` | Scheduler expression |
| `IngestionScheduleState` | `ENABLED` | Set to `DISABLED` to pause ingestion |
| `WindowDays` | `30` | Days kept in the rolling window (1–30) |
| `HistoryRetentionDays` | `90` | Lifecycle expiry for hourly snapshots |
| `LogRetentionDays` | `14` | CloudWatch Logs retention for both functions and API access logs |
| `AlarmEmail` | *(empty)* | If set, an SNS topic emails alarm state changes. Confirm the subscription email you receive. |
| `CreateMapApiKey` | `false` | Create a referrer-restricted Amazon Location API key |
| `MapAllowedReferers` | `http://localhost:5173/*` | Referrer patterns for the map key (up to 5) |

### After deploying

```bash
# 1. Read the stack outputs (ApiUrl, DataBucketName, IngestFunctionName, ...)
sam list stack-outputs --stack-name georescue

# 2. Run the first ingestion now instead of waiting up to 5 minutes
aws lambda invoke --function-name <IngestFunctionName> response.json && cat response.json

# 3. Check the API
curl "<ApiUrl>/health"
curl "<ApiUrl>/earthquakes/metadata"
curl --compressed "<ApiUrl>/earthquakes?range=day&minMagnitude=2.5"

# 4. (If CreateMapApiKey=true) read the map key value for the frontend
aws location describe-key --key-name georescue-maps --query Key --output text
```

Then configure the frontend in the repository root's `.env.local`:

```bash
VITE_API_BASE_URL=<ApiUrl>
VITE_AWS_REGION=<stack region>
VITE_AWS_LOCATION_API_KEY=<key from step 4>
```

## API

Base URL: the `ApiUrl` stack output. All responses are JSON. Responses of 1 KB or more are gzip-compressed when the client sends `Accept-Encoding: gzip` (browsers always do).

### `GET /earthquakes`

Returns a USGS-format GeoJSON `FeatureCollection` from the rolling window, newest first.

| Query | Example | Description |
| --- | --- | --- |
| `range` | `day` (default), `week`, `month` | Time window ending now |
| `since` | `2026-10-25T00:00:00Z` or `1793000000000` | Start time; overrides `range` |
| `minMagnitude` | `4.5` | Minimum magnitude (−2 to 10). Events without a magnitude are excluded. |
| `limit` | `500` | Maximum number of features (1–20000) |

Status codes: `200` OK · `400` invalid parameter · `413` response over the 6 MB Lambda limit (only possible without gzip, for the full month) · `503` no data ingested yet (`Retry-After: 300`) · `500` internal error (details are logged, never returned).

### `GET /earthquakes/metadata`

Returns ingestion status: `lastSuccessfulIngestion` (feed time, counts, merge statistics, history key), `lastAttempt`, `lastSuccessfulIngestionAt`, `ageSeconds`, `stale`, `windowDays`. Returns `404` before the first ingestion.

### `GET /health`

Returns `200 {"status":"ok"}` when the last successful ingestion is less than 15 minutes old. Returns `503` with `status` set to `stale`, `no-data` or `error` otherwise. Point an uptime monitor at it.

## Observability

Both functions write one JSON object per log line (`message`, `level`, `requestId`, plus fields), which CloudWatch Logs Insights indexes automatically.

```
# Ingestion runs and their statistics (IngestLogGroupName output)
fields @timestamp, feedCount, windowCount, added, updated, removed, durationMs
| filter message = "ingestion.completed"
| sort @timestamp desc

# Failures and retries
fields @timestamp, message, error.message, attempt
| filter level in ["warn", "error"]
| sort @timestamp desc

# API latency by route (ApiLogGroupName output)
stats avg(durationMs), max(durationMs), count() by path, status
| filter message = "api.request"
```

Other signals: the `IngestionErrorsAlarm` alarm, the scheduler's SQS dead-letter queue (`IngestFunctionIngestionScheduleQueue`), API Gateway access logs, and `GET /health`. To tail logs live, run `sam logs --stack-name georescue -n IngestFunction --tail`.

## Security

- **IAM least privilege.** The ingestion role can only `GetObject`/`PutObject` under `earthquakes/*` and `metadata/*`, and the API role can only `GetObject` there. Both also have `ListBucket` on the bucket, so a missing key returns 404 instead of 403. Each function can write only to its own log group; SAM's broader default `AWSLambdaBasicExecutionRole` is not attached. The scheduler role can only invoke the ingestion function and send to its dead-letter queue.
- **S3.** All four Block Public Access settings are on, `BucketOwnerEnforced` disables ACLs, SSE-S3 encrypts data at rest, and a bucket policy denies non-TLS requests. Nothing is publicly readable; the browser only reaches data through the API.
- **API.** CORS allows only `AllowedOrigins`, routes are `GET`-only, stage throttling is 20 req/s with a burst of 50, and error responses never include internal details.
- **Credentials.** None are stored anywhere. Lambdas use their execution roles. The optional map key is a browser-safe Amazon Location API key limited to `geo-maps:GetTile` on `arn:aws:geo-maps:<region>::provider/default` and to your referrers.
- **Network.** No VPC or NAT Gateway; Lambdas reach USGS and S3 over the public AWS network.

## Cost

These are estimates for us-east-1 with the default 5-minute schedule and light demo traffic. Prices change, so check the AWS pricing pages.

| Service | Usage per month | Estimate |
| --- | --- | --- |
| Lambda (arm64) | about 8,640 ingestion runs at roughly 2–3 s and 512 MB (about 11,000 GB-s), plus API calls | Within the Lambda free tier (1M requests and 400,000 GB-s per month); otherwise about $0.15 |
| EventBridge Scheduler | 8,640 invocations | Within the free tier (14M per month) |
| S3 | about 35,000 PUTs, about 20,000 GETs, under 1 GB stored | About $0.20 |
| API Gateway HTTP API | per million requests | $1.00 per million; demo traffic costs cents |
| CloudWatch Logs, 1 alarm, SQS | well under 1 GB of logs | About $0.10–0.60 (often within the free tier) |
| Amazon Location (optional) | billed per map tile request | See [Amazon Location pricing](https://aws.amazon.com/location/pricing/) |

The pipeline itself typically costs **well under $1 per month**. There are no always-on resources (no NAT Gateway, database, VPC or provisioned capacity). To pause costs, deploy with `IngestionScheduleState=DISABLED`.

## Local development without AWS

```bash
cd infrastructure
npm install
npm run local    # http://localhost:3001
```

This runs the **same ingestion and API code** against the live USGS feed, using an in-memory store, on the same 5-minute cadence, with the same CORS rules. Then point the frontend at it:

```bash
VITE_API_BASE_URL=http://localhost:3001 npm run dev    # from the repository root
```

Set `PORT`, `ALLOWED_ORIGINS` or `INGEST_INTERVAL_SECONDS` to override the defaults.

## Tear down

```bash
sam delete --stack-name georescue
# The data bucket is retained by design. Empty and remove it when you no longer need the data:
aws s3 rm "s3://<DataBucketName>" --recursive
aws s3 rb "s3://<DataBucketName>"
```
