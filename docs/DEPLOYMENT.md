# Deploying GeoRescue to AWS

This guide covers every step from an empty AWS account to a hosted frontend backed by the serverless pipeline. Run the commands from the repository root unless a step says otherwise.

> **Status.** GeoRescue is **deployed** at **https://main.d147btk08obxux.amplifyapp.com** (us-east-1, 30 October 2026). Details are under [Live deployment](#live-deployment). Deploying your own copy creates billable resources in your account; see [Cost](#cost).

## Live deployment

| Component | Value |
| --- | --- |
| Frontend | AWS Amplify Hosting app `georescue` (`d147btk08obxux`), branch `main`, manual deployments → https://main.d147btk08obxux.amplifyapp.com |
| Backend | CloudFormation stack `georescue`, us-east-1 |
| API | `https://6rc0hoc49j.execute-api.us-east-1.amazonaws.com` (`/health`, `/earthquakes`, `/earthquakes/metadata`, `/population`) |
| Parameters | `AllowedOrigins` = the Amplify domain + `http://localhost:5173`; `CreateMapApiKey=true`; `EnableMapRouting=true`; `MapAllowedReferers` = the same two origins with `/*` |
| Map key | `georescue-maps` (`geo-maps:GetTile` + `geo-routes:CalculateRoutes`, referrer-restricted) |

**Verified on the live site:** the header shows *Data: AWS API* and *Amazon Location*, all tile requests return HTTP 200, population estimates are served through API Gateway and WorldPop, and a real Routes v2 driving route renders.

**Updating the live frontend** (manual deployment, because the app isn't connected to GitHub):

```bash
KEY=$(aws location describe-key --key-name georescue-maps --region us-east-1 --query Key --output text)
VITE_API_BASE_URL=https://6rc0hoc49j.execute-api.us-east-1.amazonaws.com VITE_AWS_REGION=us-east-1 \
VITE_AWS_LOCATION_API_KEY="$KEY" VITE_AWS_LOCATION_ENABLE_ROUTING=true npm run build
(cd dist && zip -qr ../georescue-dist.zip .)
aws amplify create-deployment --app-id d147btk08obxux --branch-name main --region us-east-1   # returns jobId + zipUploadUrl
curl -X PUT -H "Content-Type: application/zip" --upload-file georescue-dist.zip "<zipUploadUrl>"
aws amplify start-deployment --app-id d147btk08obxux --branch-name main --job-id <jobId> --region us-east-1
```

To switch to automatic builds, connect the repository in the Amplify console (it uses `amplify.yml`) and add the same `VITE_*` environment variables.

## What gets deployed

| Part | How | Required? |
| --- | --- | --- |
| Data pipeline and API: EventBridge Scheduler, two Lambdas, S3, API Gateway HTTP API, SQS DLQ, CloudWatch | `sam deploy` (infrastructure/template.yaml) | Recommended. Without it, the app reads USGS directly and population exposure is disabled |
| Amazon Location API key (map tiles, optional routing) | Same stack (`CreateMapApiKey=true`), or the console/CLI | Optional. Without it, the app uses an open basemap |
| Frontend | AWS Amplify Hosting (`amplify.yml`), or any static host | Optional. `npm run dev` works locally |

## 1. Prerequisites

- An AWS account and an IAM principal that can create CloudFormation stacks, IAM roles, Lambda functions, S3 buckets, API Gateway HTTP APIs, EventBridge Scheduler schedules, SQS queues, CloudWatch alarms and log groups (plus SNS and Amazon Location if you use those options)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) 1.120 or newer
- Node.js 20+ and npm, and Git. Docker is **not** required, because `sam build` bundles with esbuild locally.

```bash
aws --version && sam --version && node --version
aws configure            # or: aws sso login --profile <profile> && export AWS_PROFILE=<profile>
export AWS_REGION=us-east-1   # any region where Lambda, S3, API Gateway, Scheduler and Amazon Location Maps v2 are available
aws sts get-caller-identity   # confirm which account you are deploying to
```

## 2. Build and test locally

```bash
git clone https://github.com/TanseerS/GeoRescue-Mapping-Disaster-Impact-and-Emergency-Response-Gaps.git
cd GeoRescue-Mapping-Disaster-Impact-and-Emergency-Response-Gaps
npm ci && npm test && npm run build          # frontend
cd infrastructure
npm ci && npm test                           # Lambda unit tests
sam validate --lint                          # template validation
sam build                                    # bundles both Lambdas with esbuild
```

## 3. Deploy the stack

For the first deployment, use guided mode. It saves your answers to `samconfig.toml`.

```bash
sam deploy --guided
```

Or deploy non-interactively. Replace the origins and referrers with your frontend URLs (keep `http://localhost:5173` for local development):

```bash
sam deploy \
  --stack-name georescue \
  --region "$AWS_REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --parameter-overrides \
    AllowedOrigins="http://localhost:5173" \
    CreateMapApiKey=true \
    EnableMapRouting=false \
    MapAllowedReferers="http://localhost:5173/*" \
    AlarmEmail=you@example.com
```

| Parameter | Default | Notes |
| --- | --- | --- |
| `AllowedOrigins` | `http://localhost:5173,http://localhost:4173` | Exact origins allowed by CORS, comma-separated, with no trailing slash |
| `CreateMapApiKey` | `false` | Creates a referrer-restricted Amazon Location key for map tiles |
| `EnableMapRouting` | `false` | Also allows the key to call `geo-routes:CalculateRoutes` |
| `MapAllowedReferers` | `http://localhost:5173/*` | Up to 5 referrer patterns for the key |
| `AlarmEmail` | *(empty)* | Emails ingestion alarm state changes. Confirm the SNS subscription email |
| `IngestionSchedule` / `IngestionScheduleState` | `rate(5 minutes)` / `ENABLED` | Set `DISABLED` to pause ingestion |
| `WindowDays`, `HistoryRetentionDays`, `LogRetentionDays` | `30`, `90`, `14` | Data window, snapshot expiry and log retention |

> **Redeploys.** Pass every non-default parameter on each `sam deploy` (or keep them in `samconfig.toml` via `--guided`). Don't assume an omitted parameter keeps its previous value: it can revert to the template default and, for example, remove the map key or alarm email.

Then capture the outputs:

```bash
outputs() { aws cloudformation describe-stacks --stack-name georescue --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
API_URL=$(outputs ApiUrl)
INGEST_FN=$(outputs IngestFunctionName)
BUCKET=$(outputs DataBucketName)
echo "$API_URL  $INGEST_FN  $BUCKET"
```

## 4. Run the first ingestion

The schedule fires every 5 minutes. To populate data immediately:

```bash
aws lambda invoke --function-name "$INGEST_FN" --cli-binary-format raw-in-base64-out --payload '{}' response.json && cat response.json
# {"status":"success","feedGenerated":...}
```

The first run also seeds the 30-day window from the USGS `all_month` feed.

## 5. Verify the API

```bash
curl -s "$API_URL/health"                                   # {"status":"ok",...}
curl -s "$API_URL/earthquakes/metadata"                     # last ingestion statistics
curl -s --compressed "$API_URL/earthquakes?range=day&minMagnitude=2.5" | head -c 400

# CORS: only configured origins receive Access-Control-Allow-Origin
curl -s -o /dev/null -D - -H "Origin: http://localhost:5173" "$API_URL/health" | grep -i access-control-allow-origin

# Population exposure (WorldPop, two steps)
curl -s "$API_URL/population?lat=37.77&lon=-122.42&radii=10,25,50"   # 202 {"status":"pending","tasks":[...]}
curl -s "$API_URL/population/tasks?lat=37.77&lon=-122.42&radii=10,25,50&ids=<id1>,<id2>,<id3>"   # repeat until 200

# Logs
sam logs --stack-name georescue -n IngestFunction --tail
```

Population routes need no configuration. They call WorldPop's free public API from the API Lambda, and stricter per-route throttles apply (`/population` allows a burst of 5 at 1 request/second, `/population/tasks` a burst of 10 at 5/second).

## 6. Amazon Location API key

If you deployed with `CreateMapApiKey=true`, read the key value:

```bash
aws location describe-key --key-name georescue-maps --query Key --output text
```

Otherwise, create a key yourself. In the [console](https://console.aws.amazon.com/location/), go to **API keys → Create** and allow **only** `geo-maps:GetTile` on `arn:aws:geo-maps:<region>::provider/default`, with your referrers. Or use the CLI:

```bash
aws location create-key --key-name georescue-maps --no-expiry --restrictions '{
  "AllowActions": ["geo-maps:GetTile"],
  "AllowResources": ["arn:aws:geo-maps:'"$AWS_REGION"'::provider/default"],
  "AllowReferers": ["http://localhost:5173/*"]
}'
```

Style descriptors, sprites and glyphs need no authorization, so tiles are the only gated call. If the key is missing or rejected, the app falls back to the open basemap automatically.

### Optional: driving routes

Redeploy with `EnableMapRouting=true`, or add `geo-routes:CalculateRoutes` on `arn:aws:geo-routes:<region>::provider/default` to your key. Then set `VITE_AWS_LOCATION_ENABLE_ROUTING=true` in the frontend.

## 7. Configure and run the frontend locally

Create `.env.local` in the repository root (it's ignored by Git):

```bash
cat > .env.local <<EOF
VITE_API_BASE_URL=$API_URL
VITE_API_FALLBACK_TO_USGS=true
VITE_AWS_REGION=$AWS_REGION
VITE_AWS_LOCATION_API_KEY=$(aws location describe-key --key-name georescue-maps --query Key --output text)
VITE_AWS_LOCATION_ENABLE_ROUTING=false
EOF
npm run dev
```

The header should show **Data: AWS API** and **Amazon Location**. The About page shows live ingestion status.

## 8. Host the frontend on AWS Amplify

`amplify.yml` in the repository root defines the build: `npm ci`, `npm run build`, publish `dist/`.

1. Open the [Amplify console](https://console.aws.amazon.com/amplify/) and choose **Create new app → GitHub**. Authorize access, then pick this repository and the `main` branch.
2. Amplify detects `amplify.yml`. Leave the app root as the repository root.
3. Under **Advanced settings → Environment variables**, add the same `VITE_*` values as in `.env.local`. They are compiled into the bundle at build time.
4. **Save and deploy.** Note the domain, for example `https://main.<app-id>.amplifyapp.com`.
5. Allow that domain in the backend and the map key, then redeploy the stack:

   ```bash
   cd infrastructure
   sam deploy --parameter-overrides \
     AllowedOrigins="http://localhost:5173,https://main.<app-id>.amplifyapp.com" \
     CreateMapApiKey=true \
     EnableMapRouting=false \
     MapAllowedReferers="http://localhost:5173/*,https://main.<app-id>.amplifyapp.com/*" \
     AlarmEmail=you@example.com
   ```

6. Whenever you change a `VITE_*` variable in Amplify, run a new build (**Redeploy this version**).

Any static host also works: run `npm run build` and serve `dist/`.

## 9. Pause or tear down

```bash
# Pause ingestion without deleting anything (repeat your other non-default parameters)
cd infrastructure && sam deploy --parameter-overrides IngestionScheduleState=DISABLED AllowedOrigins="..." CreateMapApiKey=true MapAllowedReferers="..."

# Delete the Amplify app (console: App settings → General → Delete app)

# Delete the stack (Lambdas, API, schedule, queue, alarm, roles, log groups, map key)
sam delete --stack-name georescue --region "$AWS_REGION"

# The data bucket is retained by design. Remove it when you no longer need the data:
aws s3 rm "s3://$BUCKET" --recursive
aws s3 rb "s3://$BUCKET"
```

## Cost

At the default 5-minute schedule with demo traffic, the pipeline is estimated at **well under $1 per month**. Lambda and EventBridge Scheduler usage fit within their free tiers, and S3, API Gateway and CloudWatch cost cents. There are no always-on resources: no VPC, no NAT Gateway, no database. Amazon Location bills per map tile and route request, and Amplify Hosting bills for build minutes, storage and data served. See [infrastructure/README.md](../infrastructure/README.md#cost) for the breakdown and check the AWS pricing pages before deploying.
