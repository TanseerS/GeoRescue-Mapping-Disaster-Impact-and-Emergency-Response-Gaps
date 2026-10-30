# GeoRescue: three-minute demo video script

**Target length:** 2:50 to 2:55 · **Format:** 1920×1080 screen recording with voice-over · **Pace:** about 150 words per minute

Every step below uses features that exist in the application today. Bracketed alternatives cover optional AWS configuration that may not be set up when you record.

---

## Before recording (about 10 minutes)

1. **Start the data pipeline locally,** or use your deployed API:
   ```bash
   cd infrastructure && npm run local                      # terminal 1: http://localhost:3001
   VITE_API_BASE_URL=http://localhost:3001 npm run dev      # terminal 2, repository root
   ```
   If you have an Amazon Location key, also set `VITE_AWS_LOCATION_API_KEY` and `VITE_AWS_REGION`. Set `VITE_AWS_LOCATION_ENABLE_ROUTING=true` only if the key allows `geo-routes:CalculateRoutes`.
2. **Open the app** in Chrome at 1920×1080, zoom 100%, with the browser in full-screen mode (F11 / ⌃⌘F). Hide bookmarks and extensions.
3. **Warm the caches.** OpenStreetMap and WorldPop can take 10–60 s on first use. Before recording:
   - Go to **Earthquake Map**, type `, CA` in the search box, choose **Strongest**, and click the first event (or any land-based event with nearby towns). Wait until the facilities and the population estimate have loaded.
   - Open **Response Gap Analysis** once and let the population estimate finish.
   - Note the event's name: you will select it again on camera, and it will now load instantly from cache.
4. **Reset the view.** Click **Overview**, close the selection (✕), click the globe button (**Reset to global view**), set **7d**, and choose **Clusters** and **Magnitude**.
5. Have the GitHub repository open in a second browser tab, and `README.md` open in the editor at the **Architecture** diagram.

---

## Script

### 0:00–0:20 · The problem

**Screen:** The Overview at the global view, clustered earthquakes, the header showing **Data: AWS API** and **Live**. Slowly hover across the map.

> "Hundreds of earthquakes are recorded every day. Most are harmless. But when one strikes, the first questions are geographic: what's nearby, how far away is it, and who lives there? The answers are scattered across separate public datasets. GeoRescue brings them together."

### 0:20–0:45 · The global map and visualization modes

**Screen:**
1. Click **Heatmap** (top-left of the map) and pause for 2 s.
2. Click **Markers**, then **Depth**. Pause, then switch back to **Magnitude** and **Clusters**.
3. In the right panel, scroll briefly past *Magnitude categories*, *Earthquakes by depth* and *Most active regions*. Click a region, such as *Alaska*, so the map zooms there.

> "This is live USGS data: a week of events, refreshed every five minutes. I can switch between individual markers, clusters, and a magnitude-weighted heatmap, and color events by depth. The overview breaks activity down by magnitude, depth and region, and one click zooms to the busiest areas."

### 0:45–1:15 · Select an earthquake and see nearby infrastructure

**Screen:**
1. Click **Earthquake Map** in the sidebar, search `, CA`, choose **Strongest**, and click the event you warmed up.
2. While the map flies in, point at the pulsing epicenter, the labeled rings and the dotted line to the nearest hospital.
3. In the panel, show the counts (*Hospitals / Clinics / Emergency*) and the nearest-facilities list.
4. Click a facility in the list: the map zooms and the **facility details card** opens. Close it.

> "Let's select an event. GeoRescue queries OpenStreetMap for hospitals, clinics, fire, ambulance and police stations within fifty kilometres, and Turf.js measures the distance to each one. The rings mark the analysis radii, and the dotted line points to the nearest mapped hospital. Clicking a facility shows its real OpenStreetMap details, and nothing is invented."

### 1:15–1:45 · Configurable response gap analysis

**Screen:**
1. Click **Gap analysis** (or **Response Gap Analysis** in the sidebar).
2. Point at the coverage banner (for example, *Limited proximity: nearest mapped hospital 25–50 km away*) and the four-step threshold scale.
3. Click **Urban**: the rings shrink on the map and the table changes to 5 / 10 / 20 km. Then click **Rural**, then **Standard**.
4. Briefly show the per-type table and the *Facility distribution by radius* chart.

> "This is the core of GeoRescue: response gap analysis. Coverage is classified by the distance to the nearest mapped hospital, against radii you choose. Urban, standard or rural presets change the rings, the counts and the classification instantly. It's deliberately honest: this is geographic proximity, not response capacity, and the panel says so."

### 1:45–2:05 · Population exposure

**Screen:** Scroll to **Population exposure (estimate)** and show the three values (for example *≈ 1,440 residents ≤ 25 km*). Hover over the WorldPop attribution line.

> "Now add people. Using WorldPop's hundred-metre population grid, GeoRescue estimates how many residents live within each radius. That runs through our API, as asynchronous WorldPop tasks. These are residents, not casualty estimates, and the interface makes that explicit."

### 2:05–2:25 · Intelligence brief and optional routing

**Screen:**
1. Click **Earthquake Map** (or **Overview**) so the selected event's panel shows the **Intelligence brief**. Read the coverage line, then click **Copy**.
2. **If routing is configured:** click a facility, choose **Driving route to epicenter**, and show the white route line plus the road distance and drive time.
   **If not:** point to the note in Gap Analysis that driving routes are an optional Amazon Location feature.

> "Everything comes together in an intelligence brief, generated from the calculated numbers, not from a language model, with its limitations attached. One click copies it into a report. With Amazon Location routing enabled, GeoRescue can also compare straight-line distance with real road distance and drive time."
>
> *[Without routing:]* "...and with Amazon Location routing enabled, it can compare straight-line distance with road distance and drive time."

### 2:25–2:45 · AWS architecture

**Screen:** Switch to `README.md` at the **Architecture** Mermaid diagram (or the rendered version on GitHub). Move the cursor along the flow: Scheduler → Lambda → S3 → Lambda → API Gateway → app.

> "Under the hood is a serverless pipeline defined in AWS SAM. EventBridge Scheduler triggers a Lambda every five minutes to ingest USGS data into private S3. A second Lambda serves it, plus population estimates, through API Gateway. CloudWatch and an SQS dead-letter queue catch failures."

### 2:45–2:55 · Close

**Screen:** Back to the app at the global view, then switch to the GitHub repository tab.

> "GeoRescue: disaster locations, emergency infrastructure and population exposure, combined to reveal potential response gaps. The code, the architecture and the deployment guide are all on GitHub."

*(Show and mention the live app: **main.d147btk08obxux.amplifyapp.com**.)*

---

## Recording checklist

- [ ] The header shows **Data: AWS API** (local pipeline or deployed API). Otherwise, the population section will say it isn't enabled.
- [ ] The warmed-up event loads facilities and population instantly.
- [ ] Use a large cursor, smooth mouse movements and no notification pop-ups.
- [ ] Don't show `.env.local`, terminal environment variables or API keys on screen.
- [ ] Only claim routing, Amazon Location maps or a live URL if they're configured during the recording.
- [ ] The final cut is under 3:00. Add captions for key terms (USGS, OpenStreetMap, WorldPop, AWS SAM).
