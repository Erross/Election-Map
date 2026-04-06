# FHSD Election Map

An interactive precinct-level map for Francis Howell School District (R-III) school board elections in St. Charles County, Missouri. Displays historical results from 2022–2025 and supports live election-night tracking for 2026.

---

## What It Does

### Precinct Map

The map shows the 38 FHSD precincts coloured by which slate won and by how much. Amber indicates an FH Families win, teal indicates an FH Forward win, and colour intensity scales with the margin size. Precincts outside the FHSD boundary are shown in a neutral grey.

Hovering over a precinct shows a tooltip with:
- Total votes cast and registered voters
- Per-candidate vote counts and percentages, grouped by slate
- The overall margin for that precinct
- The swing versus the selected comparison year

### Sidebar Controls

**Year selector** — Switch between 2022, 2023, 2024, 2025, and 2026 (live). All years are always available.

**Map labels** — Toggle what is printed on each precinct:
- *Margin* — e.g. `Fam+14%` or `Fwd+6%`
- *Swing* — directional shift versus the comparison year, e.g. `3.2% →FHFam`
- *Turnout* — actual votes cast with the turnout-rate delta beneath it

**Compare swing to** — Choose which historical year the swing and turnout delta are calculated against.

### Summary Stats

The sidebar shows district-wide aggregates for the selected year:
- Total votes cast
- Number of precincts reporting (out of 38)
- Overall margin across all FHSD precincts
- Swing versus the selected comparison year

A bar chart shows the swing versus every other available year simultaneously.

### Color Legend

FH Forward (teal) on the left, FH Families (amber) on the right, with a gradient bar showing the ±20% scale. Labels indicate the direction and intensity.

---

## Slate Logic

Each election year has a configured slate in `public/slates.json` defining which candidates belong to FH Families, FH Forward, and independent groupings.

**Margin formula:** `(FH Families votes − FH Forward votes) / (FH Families votes + FH Forward votes)` — independents are excluded from the denominator so they don't dilute the two-slate comparison.

**Swing formula:** `current margin − comparison margin` per precinct, averaged across all 38 precincts. A positive swing means movement toward FH Families.

**2022 note:** The 2022 election used different precinct boundaries. A crosswalk maps the 48 old precinct numbers to the 38 current DIST_NUM keys (summing votes where multiple old precincts collapse into one new precinct). There was no formal FH Forward slate in 2022 — the four non-FH-Families candidates are grouped as the opposition baseline.

---

## Live Election Night (2026)

### Auto-Refresh

The app polls a Cloudflare Worker proxy (`fhsd-proxy`) that fetches and parses the St. Charles County live results page (`livevoterturnout.com`) and returns clean JSON in the same shape as the historical data files.

Polling is phase-aware:

| Phase | Condition | Behaviour |
|---|---|---|
| Pre-polls | Before 7:00 PM CT | No polling. Button shows "Monitoring — polls close 7pm CT" |
| Active | After 7pm, results incomplete | Polls every 5 minutes |
| Burst | New data just arrived | Polls every 30 seconds for 5 minutes, resetting on each new result |
| Complete | All 38 precincts reported | Polling stops entirely |

On every page load the app makes one unconditional fetch regardless of button state, so the map always shows the latest data on open even after polling has stopped.

The Worker returns a `dataHash` (FNV-1a hash of all vote totals). The app sends this as an `If-None-Match` header on subsequent requests; if nothing has changed the Worker returns `304 Not Modified` and no data is re-rendered.

### New Data Indicator

When new results arrive while the user is viewing a historical year, a pulsing green dot appears on the 2026 button and a green banner appears at the top of the sidebar. Clicking either switches to the live view and clears the indicator.

### Manual Paste Fallback

If the Worker is unavailable, results can be pasted directly from the county results page using the "Paste Results Manually" button. The paste parser handles the raw text format and produces the same data structure as the auto-fetch path.

---

## Data Files

| File | Description |
|---|---|
| `public/precincts.geojson` | GeoJSON boundaries for all St. Charles County precincts |
| `public/fhsd_2022.json` | 2022 election results with precinct crosswalk |
| `public/fhsd_2023.json` | 2023 election results |
| `public/fhsd_2024.json` | 2024 election results |
| `public/fhsd_2025.json` | 2025 election results |
| `public/slates.json` | Slate configuration for all years |

---

## Project Structure

```
election-app/          React + Vite frontend
  src/
    components/
      Dashboard.jsx    Sidebar controls and summary stats
      ElectionMap.jsx  GeoJSON choropleth layer
      LabelLayer.jsx   Per-precinct map labels
      PrecinctTooltip.jsx  Hover tooltip
      ResultsPaster.jsx    Manual paste modal
    utils/
      colorScale.js    Margin → colour mapping
      dataLoader.js    Fetches and remaps all data files on load
      liveFetcher.js   Cloudflare Worker client with ETag support
      resultParser.js  Parses pasted raw results text
      slateCalculator.js  Margin, swing, turnout calculations

fhsd-proxy/            Cloudflare Worker
  src/index.js         Fetches livevoterturnout.com, parses HTML, returns JSON
  wrangler.toml        Worker config (URL, CORS, cache TTL)
```

---

## Local Development

```bash
cd election-app
npm install
npm run dev
```

The app will use the deployed Worker at `https://fhsd-proxy.ewanrross.workers.dev` by default. To test against a local Worker:

```bash
cd fhsd-proxy
npx wrangler dev
```

Then set `VITE_PROXY_URL=http://localhost:8787` in `election-app/.env`.
