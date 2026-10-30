# Image guide for the GeoRescue AWS Builder Center article

This guide covers every image placeholder in [ARTICLE.md](ARTICLE.md). All images are **real captures of GeoRescue** or renders of the **project's own Mermaid diagram**. There are no stock photos and no generated illustrations.

Ready-to-use files for every image already exist in [`docs/screenshots/`](screenshots/). They were captured from the running application at 1440×900 (CSS pixels), using live USGS, OpenStreetMap and WorldPop data and the local GeoRescue pipeline (`npm run local`). You can publish them as-is, or re-capture them for fresher data using the instructions below.

## Checklist

| # | Placeholder in ARTICLE.md | Location | Ready file | Status |
| --- | --- | --- | --- | --- |
| 1 | `[IMAGE 1: GeoRescue dashboard screenshot]` | Directly below the title and links (hero) | `screenshots/earthquake-details.png` | ☐ inserted |
| 2 | `[IMAGE 2: GeoRescue AWS architecture diagram]` | Section 4, *Architecture overview*, before the Mermaid block | `screenshots/architecture.png` | ☐ inserted |
| 3 | `[IMAGE 3: Global earthquake map with clusters]` | Start of section 8, *Earthquake intelligence* | `screenshots/overview.png` | ☐ inserted |
| 4 | `[IMAGE 4: Magnitude-weighted earthquake heatmap]` | Section 8, after the paragraph about the two GeoJSON sources | `screenshots/heatmap.png` | ☐ inserted |
| 5 | `[IMAGE 5: Selected earthquake with nearby emergency infrastructure]` | Start of section 9, *Emergency infrastructure mapping* | `screenshots/facilities.png` | ☐ inserted |
| 6 | `[IMAGE 6: Response gap analysis with configurable radii]` | Start of section 10, *Response gap analysis* | `screenshots/gap-analysis.png` | ☐ inserted |
| 7 | `[IMAGE 7: WorldPop population exposure estimates]` | Start of section 11, *Population exposure* | `screenshots/population-exposure.png` | ☐ inserted |
| 8 | `[IMAGE 8: GeoRescue data pipeline status in the application]` | Section 14, *Security, reliability and cost*, before **Reliability** | `screenshots/pipeline-status.png` | ☐ inserted |
| 9 | `[IMAGE 9: GeoRescue GitHub repository]` | Section 18, *GitHub repository and project links* | `screenshots/github-repository.png` | ☐ re-capture recommended (see below) |

Before publishing, also replace `[LIVE APP URL — add after deployment]` (two occurrences) and `[DEMO VIDEO URL — add after recording]` (two occurrences) in ARTICLE.md. If the app isn't deployed, remove the live-URL lines instead of leaving placeholders.

---

## Shared capture setup

1. Start the local pipeline and the app (the app shows **Data: AWS API**):
   ```bash
   cd infrastructure && npm install && npm run local                 # terminal 1
   VITE_API_BASE_URL=http://localhost:3001 npm run dev                # terminal 2, repository root
   ```
   If you deploy the stack first, use `VITE_API_BASE_URL=<ApiUrl>` instead. If you have an Amazon Location key, set `VITE_AWS_LOCATION_API_KEY` and `VITE_AWS_REGION` so the screenshots show the AWS basemap.
2. In Chrome, set the window to **1440×900**, zoom **100%**, and capture with DevTools device emulation or a full-window screenshot tool. For crisp images on Builder Center, capture at a device pixel ratio of 2 (2880×1800).
3. **Warm the caches first.** OpenStreetMap and WorldPop can take 10–60 s on first use. Select the event you plan to show once before capturing.
4. Don't capture `.env.local`, API keys, terminal environment variables or your browser profile.

**Attribution for every application screenshot (1, 3–8).** The map shows basemap data, so the caption or image credit must include:
- With the default open basemap: *"Basemap © CARTO, map data © OpenStreetMap contributors."*
- With Amazon Location: *"Map © AWS, © HERE."*

Images showing facilities (1, 5, 6) also need *"Facility data © OpenStreetMap contributors (ODbL)."* Images showing earthquakes (1, 3–6) should credit *"Earthquake data: U.S. Geological Survey."* Image 7 needs *"Population data © WorldPop, CC BY 4.0."* The attribution line at the end of ARTICLE.md covers all of these; keep it.

---

## IMAGE 1: Hero, the GeoRescue dashboard

- **Shows:** The full dashboard with a selected land-based earthquake. The map shows labeled analysis rings, the pulsing epicenter, facility icons and the dotted nearest-hospital line. The right panel shows the event details and the intelligence brief.
- **Location:** Directly under the article title and the links line.
- **Dimensions:** 16:10 (1440×900, or 2880×1800 at 2×). Crop to 16:9 (1440×810) if Builder Center's hero slot requires it.
- **Caption:** *GeoRescue's interactive disaster intelligence dashboard. A selected earthquake shows analysis rings, nearby mapped facilities and a generated intelligence brief.*
- **Source:** Use `docs/screenshots/earthquake-details.png`, or capture it: **Earthquake Map** → search `, CA` → **Strongest** → click the first event → wait for facilities and the population estimate → capture.
- **Attribution:** USGS, OpenStreetMap (ODbL), CARTO or AWS basemap credit (see above).

## IMAGE 2: AWS architecture diagram

- **Shows:** The project's architecture: EventBridge Scheduler, ingestion Lambda, S3, API Lambda, API Gateway, CloudWatch, the SQS DLQ, optional SNS and the Location key, Amazon Location, the browser frontend, and the external USGS, OpenStreetMap and WorldPop sources.
- **Location:** Section 4, immediately before the Mermaid code block. If Builder Center renders Mermaid natively, you can keep only the code block and drop this image.
- **Dimensions:** About 2.2:1 landscape (`architecture.png` is a 2× render of the Mermaid diagram).
- **Caption:** *GeoRescue architecture. Solid orange nodes are created by the SAM stack; dashed nodes are optional; blue cylinders are external public data services.*
- **Source:** Use `docs/screenshots/architecture.png`, an exact render of the Mermaid block in the repository [README](../README.md#architecture). To regenerate it, paste that block into https://mermaid.live and export as PNG or SVG, or use the GitHub-rendered README.
- **Attribution:** Original project diagram; no third-party attribution required. If you redraw it with official AWS service icons, download them from the [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) page and follow the usage terms published there.

## IMAGE 3: Global earthquake map with clusters

- **Shows:** A global view of the past 7 days of live USGS earthquakes in **Clusters** mode, colored by **Magnitude**, with the overview analytics panel (spotlight, magnitude categories, distributions).
- **Location:** Top of section 8.
- **Dimensions:** 16:10 (1440×900).
- **Caption:** *A week of live USGS earthquakes, clustered and colored by the strongest event in each cluster.*
- **Source:** Use `docs/screenshots/overview.png`, or capture it: load the app → **Overview** → **7d** → **Clusters** + **Magnitude** → click the globe button (**Reset to global view**) → wait 5 s → capture.
- **Attribution:** USGS; CARTO/OpenStreetMap or AWS/HERE basemap credit.

## IMAGE 4: Magnitude-weighted heatmap

- **Shows:** The same global view in **Heatmap** mode, with the heatmap legend visible.
- **Location:** Section 8, before the `heatmap-weight` code snippet.
- **Dimensions:** 16:10 (1440×900).
- **Caption:** *The heatmap weights each event by magnitude, so large earthquakes aren't drowned out by swarms of micro-quakes.*
- **Source:** Use `docs/screenshots/heatmap.png`, or capture it: from IMAGE 3's state, click **Heatmap** (top-left of the map) → wait 2 s → capture.
- **Attribution:** USGS; basemap credit.

## IMAGE 5: Emergency infrastructure around an epicenter

- **Shows:** The **Emergency Facilities** view for a selected event: the per-type filter tiles (Hospitals, Clinics, Fire stations, Ambulance, Police), the distance-sorted list, and the map zoomed to a hospital with its **facility details card** open (operator, address, phone, hours, from OSM tags).
- **Location:** Top of section 9.
- **Dimensions:** 16:10 (1440×900).
- **Caption:** *OpenStreetMap hospitals, clinics and emergency services around a selected epicenter, with a facility details card.*
- **Source:** Use `docs/screenshots/facilities.png`, or capture it: select the IMAGE 1 event → **Emergency Facilities** → click a hospital in the list → wait for the map to zoom → capture.
- **Attribution:** OpenStreetMap contributors (ODbL) for the facility data and details; basemap credit. The card shows public institutional contact details from OSM. Don't capture facilities tied to private individuals.

## IMAGE 6: Response gap analysis

- **Shows:** **Response Gap Analysis** for the selected event: the radius presets and sliders, the coverage classification banner with its threshold scale, the per-type table for ≤ 10, 25 and 50 km, and the labeled rings on the map.
- **Location:** Top of section 10.
- **Dimensions:** 16:10 (1440×900).
- **Caption:** *Configurable radii drive the per-type facility counts, the map rings and the coverage classification.*
- **Source:** Use `docs/screenshots/gap-analysis.png`, or capture it: select the event → **Response Gap Analysis** → choose **Standard** → capture. An optional second shot with **Urban** selected shows the rings shrinking.
- **Attribution:** OpenStreetMap (ODbL), USGS, basemap credit.

## IMAGE 7: Population exposure

- **Shows:** The **Population exposure (estimate)** section with residents per radius, the WorldPop dataset line, and the "not a casualty estimate" wording.
- **Location:** Top of section 11.
- **Dimensions:** 16:10 (1440×900). Optionally crop to the right-hand panel (about 3:4).
- **Caption:** *Estimated residents within each analysis radius, from WorldPop's 2020 ~100 m gridded population dataset.*
- **Source:** Use `docs/screenshots/population-exposure.png`, or capture it: in Response Gap Analysis, scroll the panel to **Population exposure (estimate)** after the values load (requires `VITE_API_BASE_URL`) → capture.
- **Attribution:** *Population data © WorldPop (www.worldpop.org), CC BY 4.0*, plus basemap and OSM credits for the visible map.

## IMAGE 8: Data pipeline status

- **Shows:** The About page's **Data pipeline · AWS serverless** card: the stage chain (USGS feed → EventBridge Scheduler → Lambda ingestion → Amazon S3 → Lambda API → API Gateway), the active source, last ingestion time, stored events in the 30-day window, and the last attempt status.
- **Why this image:** IMAGE 2 already shows the architecture, so this image shows the pipeline *working*, using real metadata served by `GET /earthquakes/metadata`, rather than duplicating the diagram.
- **Location:** Section 14, before the **Reliability** paragraph.
- **Dimensions:** About 4:1 (`pipeline-status.png` is 848×210). Display at full content width.
- **Caption:** *The About page's pipeline card reads live ingestion status from `GET /earthquakes/metadata` (shown here against the local pipeline).*
- **Source:** Use `docs/screenshots/pipeline-status.png`, or capture it: with `VITE_API_BASE_URL` set, open **About** → scroll to **Data pipeline · AWS serverless** → capture just that card. After deploying, re-capture against the deployed API and change the caption to say so. **Keep "local pipeline" in the caption unless the API is actually deployed.**
- **Attribution:** None required (application UI).

## IMAGE 9: GitHub repository

- **Shows:** The public repository page with the file tree (`docs/`, `infrastructure/`, `src/`, `amplify.yml`, `README.md`) and the top of the README.
- **Location:** Section 18.
- **Dimensions:** 16:10 (1440×900).
- **Caption:** *The public GeoRescue repository, with the application, the AWS SAM infrastructure and the deployment guide.*
- **Source:** https://github.com/TanseerS/GeoRescue-Mapping-Disaster-Impact-and-Emergency-Response-Gaps. A capture exists at `docs/screenshots/github-repository.png`, but **re-capture it before publishing**. First add a repository description, a website link (once live) and topics in GitHub → **About ⚙**. The current capture shows "No description, website, or topics provided" and relative commit times.
- **Attribution:** Screenshot of your own repository; GitHub's interface appears incidentally. Don't crop or alter GitHub branding in a misleading way.

---

## Optional external visual references

Use these only if you redraw or extend diagrams. None are required, because the article's visuals are all original project captures.

| Resource | URL | Why it's relevant | Usage notes |
| --- | --- | --- | --- |
| AWS Architecture Icons | https://aws.amazon.com/architecture/icons/ | Official icons for EventBridge, Lambda, S3, API Gateway, CloudWatch, SQS, SNS and Location Service, if you redraw IMAGE 2 in AWS style | Download the official icon package and follow the usage terms on that page. Don't modify the icons |
| AWS Architecture Center | https://aws.amazon.com/architecture/ | Reference architectures and diagramming conventions for serverless patterns | Link only; don't copy diagrams |
| USGS Earthquake Hazards Program | https://earthquake.usgs.gov/ | Source of all earthquake data; useful as a linked reference | USGS-authored information is generally in the U.S. public domain; see the [USGS copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). Credit "U.S. Geological Survey" |
| OpenStreetMap | https://www.openstreetmap.org/ | Source of facility data | Data is ODbL; see https://www.openstreetmap.org/copyright. Credit "© OpenStreetMap contributors" |
| WorldPop | https://www.worldpop.org/ | Source of population data | Datasets used are CC BY 4.0. Credit "WorldPop (www.worldpop.org)" |
| CARTO basemap attributions | https://carto.com/attributions | Required credit for the open fallback basemap visible in screenshots | Credit "© CARTO, © OpenStreetMap contributors" |

**Don't use** stock disaster photographs, news images or photos of real emergencies. They add no technical value, often carry restrictive licenses, and can be insensitive.
