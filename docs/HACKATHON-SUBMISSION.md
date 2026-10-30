# GeoRescue – Mapping Disaster Impact and Emergency Response Gaps

**AWS Builder Weekend Challenge submission**

![GeoRescue response gap analysis](screenshots/gap-analysis.png)

---

## A. Short description

> GeoRescue maps live USGS earthquakes against OpenStreetMap hospitals and emergency services and WorldPop population to reveal potential geographic response gaps, powered by a serverless AWS pipeline and Amazon Location maps.

*(224 characters)*

## B. Problem statement

Hundreds of earthquakes are recorded every day. Most are harmless. A few strike places where help is far away. After an event, the first questions people ask are geographic: *what's nearby, how far is it, and who lives there?*

The data to answer these questions is public but fragmented:

- **Earthquakes** are in USGS feeds.
- **Hospitals, clinics, fire, ambulance and police stations** are in OpenStreetMap.
- **Where people live** is in gridded population datasets such as WorldPop.

Combining them normally takes GIS software, manual downloads and specialist time. So the question *"is this event in a place with poor access to emergency infrastructure?"* often goes unasked until much later.

## C. Solution overview

GeoRescue is a browser-based disaster intelligence dashboard that answers that question in seconds.

1. **See the situation.** It shows live USGS earthquakes as markers, clusters or a magnitude-weighted heatmap, colored by severity or focal depth, with analytics for magnitude, depth, time and the most active regions.
2. **Select an event.** GeoRescue fetches real OpenStreetMap facilities within 50 km and draws configurable analysis rings (for example 10, 25 and 50 km). Turf.js measures the distance to every facility.
3. **Read the gap analysis.** It shows counts per facility type within each radius, the nearest hospital and fire station, and a clear coverage class, from *close hospital proximity* to *potential coverage gap*.
4. **Understand exposure.** It shows estimated residents within each radius, from WorldPop's ~100 m population grid.
5. **Share the finding.** A deterministic intelligence brief summarizes the event, infrastructure, coverage and exposure, with its limitations stated. It can be copied in one click.

**The central insight:** GeoRescue doesn't just visualize disasters. It combines disaster locations, emergency infrastructure and population exposure to reveal potential geographic response gaps.

## D. Originality and innovation

- **Three independent open datasets in one workflow.** Seismic events, crowd-mapped infrastructure and modelled population are joined at the moment you click an epicenter. Nothing is precomputed or invented.
- **Transparent, configurable gap analysis.** Coverage classes come from user-chosen radii (Urban, Standard, Rural or custom), and the method is shown next to the result. Proximity is never presented as response capability.
- **Honest by design.** Every figure comes from loaded data. Missing information is stated, not guessed: if facilities fail to load, the brief says so. Population is labeled as residents, not casualties. Straight-line distance is never called travel distance. Optional Amazon Location routing provides real road estimates for comparison.
- **No LLM needed.** The brief is generated deterministically from calculated values, so it's reproducible, auditable and fast.
- **Engineered for unreliable public services.** OpenStreetMap queries are hedged across mirrors and cached. WorldPop runs as async tasks so it never hits API Gateway's 30-second limit. Every data source has explicit loading, empty, error and retry states, and the AWS API falls back to the direct USGS feed.

## E. Dataset information

| Dataset | Provider and access | What GeoRescue uses | License |
| --- | --- | --- | --- |
| **USGS earthquake feeds** | U.S. Geological Survey GeoJSON summary feeds (`all_day`, `all_week`, `all_month`) | Location, magnitude, depth, time, place, tsunami flag, PAGER alert. Malformed records are excluded, never estimated | Public domain |
| **OpenStreetMap** | Overpass API (three mirrors with hedged failover) | Hospitals, clinics, fire stations, ambulance stations and police stations within 50 km of an epicenter, or within the visible map area. Only OSM tags that exist are shown | © OpenStreetMap contributors, ODbL |
| **WorldPop** | WorldPop stats API (Global Population 2020, unconstrained, 3 arc-seconds ≈ 100 m) | Total residents inside geodesic circles around the epicenter | CC BY 4.0 |

## F. How AWS is used

GeoRescue has a complete, tested AWS SAM stack in `infrastructure/`, and it is **deployed in us-east-1**. It backs the live application at https://main.d147btk08obxux.amplifyapp.com, with the frontend on AWS Amplify Hosting. The stack passes `sam validate --lint` and `sam build`, and its logic is covered by unit tests.

| AWS service | Role in GeoRescue | Status |
| --- | --- | --- |
| **Amazon EventBridge Scheduler** | Triggers ingestion every 5 minutes, with a retry policy | **Deployed** (us-east-1) |
| **AWS Lambda** (Node.js 24, arm64) | **Ingestion:** fetch USGS with retries, validate, normalize, merge a rolling 30-day window, write hourly history. **API:** serve earthquakes, metadata, health and WorldPop population estimates | **Deployed**; also runs locally with `npm run local` |
| **Amazon S3** | Private GeoJSON storage (`latest`, 30-day window, hourly history, metadata), with conditional writes for concurrency safety | **Deployed**; Block Public Access, encryption and a TLS-only policy |
| **Amazon API Gateway (HTTP API)** | Public endpoint with a CORS allow-list and global and per-route throttling | **Deployed** |
| **Amazon CloudWatch** | Structured JSON logs, an ingestion error alarm, API access logs, 14-day retention | **Deployed** |
| **Amazon SQS** | Dead-letter queue for undeliverable schedule events | **Deployed** |
| **Amazon Location Service** | **Maps v2** basemap tiles via a referrer-restricted API key. **Routes v2** driving routes from a facility to the epicenter | **Deployed and verified live**: a referrer-restricted key renders the basemap, and real Routes v2 driving routes work. Without a key, an open basemap is used automatically |
| **AWS Amplify Hosting** | Hosts the React frontend | **Deployed** (manual zip deployments); `amplify.yml` is provided for Git-connected builds |

**Design choices for judges:** serverless end to end with no always-on resources (no VPC, NAT Gateway or database). Least-privilege IAM scoped to S3 prefixes and each function's own log group. An estimated cost of well under $1 per month at demo traffic.

## G. How users explore the map

1. **Open the app.** A global view loads live earthquakes from the past 7 days. The header shows whether data comes from the AWS API or directly from USGS.
2. **Change the view.** Switch between *Markers*, *Clusters* and *Heatmap*, and color by *Magnitude* or *Depth*. Use the sidebar to filter by time range (24 h, 7 d, 30 d), minimum magnitude and severity.
3. **Find important events.** Use the "Strongest" card, the spotlight in the Overview, the searchable event list, or click a region to zoom to it.
4. **Select an earthquake.** The map flies to the epicenter. Rings, a nearest-hospital line, nearby facilities and the intelligence brief appear.
5. **Inspect facilities.** Click any facility icon or list item to see its OpenStreetMap details and its distance from the epicenter. Optionally, calculate a driving route.
6. **Run the gap analysis.** Choose a radius preset or set custom radii. The counts, coverage class, rings and chart update immediately, and population exposure appears per radius.
7. **Share.** Copy the intelligence brief as text.

## H. Impact and potential use cases

- **Humanitarian and NGO analysts** can quickly see which new events fall in areas with sparse mapped health infrastructure, and prioritize them for situational reports.
- **Emergency management planners** can explore how facility coverage changes with distance assumptions in their region, using the Urban, Standard and Rural presets.
- **OpenStreetMap communities** can find "potential coverage gap" areas that may actually be *mapping* gaps, which is a starting point for targeted mapping campaigns.
- **Journalists and educators** can explain an event's context (depth, exposure, nearby services) with transparent, sourced figures.
- **Researchers** can extend the open, deterministic method to other hazards and datasets.

## I. Limitations and responsible use

- **Proximity is not response capability.** GeoRescue measures straight-line distance to *mapped* facilities. Facility availability, capacity, staffing, damage, road conditions and real response times are unknown, and the interface says so wherever results appear.
- **OpenStreetMap coverage is uneven.** A missing facility may be unmapped, not absent.
- **Population figures are modelled 2020 residential estimates.** They don't describe current, daytime or displaced populations, and they are **not casualty or impact estimates**.
- **Driving routes** are Amazon Location estimates for typical traffic, not live emergency travel times.
- **Public services can be slow or unavailable** (Overpass, WorldPop). GeoRescue shows a clear retry state rather than partial or invented data.
- GeoRescue is a **decision-support visualization**, not an alerting, dispatch or life-safety system.

## J. GitHub repository

https://github.com/TanseerS/GeoRescue-Mapping-Disaster-Impact-and-Emergency-Response-Gaps

## K. Live application

**https://main.d147btk08obxux.amplifyapp.com**

*(Frontend on AWS Amplify Hosting; backend SAM stack in us-east-1. Run locally with `npm install && npm run dev`, or deploy your own copy with [DEPLOYMENT.md](DEPLOYMENT.md).)*

## L. Demo video

**[Demo video URL: to be added]**

A silent 2:11 walkthrough of the real application is in the repository: [demo/georescue-demo.mp4](demo/georescue-demo.mp4). It uses live data served by the GeoRescue API running locally, with on-screen captions. A narrated version can be recorded with [DEMO-VIDEO-SCRIPT.md](DEMO-VIDEO-SCRIPT.md).
