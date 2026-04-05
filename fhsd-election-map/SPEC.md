# FHSD School Board Election Precinct Map — Specification

## Overview
Build an interactive web application that visualizes Francis Howell School District (FHSD) school board election results on a precinct-level choropleth map. The app colors precincts red (FH Families slate) or blue (FH Forward slate) based on vote margins, shows swing data on hover, and supports both live election night use and historical comparison.

## Data Sources

### 1. Precinct Polygon Boundaries (Live ArcGIS Query)
**Endpoint:** `https://maps.sccmo.org/scc_gis/rest/services/appservices/votinginformation/MapServer/1/query`

Query parameters:
- `where=1%3D1` (all features)
- `outFields=DIST_NUM,LONGNAME,SHORTNAME,DISTRICT`
- `f=geojson`
- `outSR=4326` (WGS84 lat/lng)
- `returnGeometry=true`

This returns GeoJSON polygons for ALL St. Charles County voting districts. The `DIST_NUM` field matches the precinct numbers in election results (e.g., "213", "701").

**CORS Note:** If the ArcGIS server blocks CORS from the browser, fetch the GeoJSON once and embed it in the codebase as a static file. The query URL to test: `https://maps.sccmo.org/scc_gis/rest/services/appservices/votinginformation/MapServer/1/query?where=1%3D1&outFields=DIST_NUM,LONGNAME,SHORTNAME,DISTRICT&f=geojson&outSR=4326&returnGeometry=true`

**MaxRecordCount is 1000**, and there are ~116 precincts, so a single query returns all features.

### 2. FHSD-Relevant Precincts
Not all STCC precincts are in FHSD. The FHSD precincts are identified by which precincts have votes in the "FRANCIS HOWELL R-III SCHOOL BOARD MEMBER" contest. From 2025 data, these are:

**38 precincts:** 213, 214, 215, 301, 303, 304, 305, 306, 307, 316, 317, 401, 506, 508, 509, 510, 511, 512, 514, 515, 516, 517, 616, 617, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714

Plus CENTRAL 1 (early/provisional) and ABSENTEE — these should be shown in the summary dashboard but NOT on the map.

**Note:** Some precincts are split between FHSD and another district. The `Reg. Voters` column in the FHSD race may differ from the precinct's total registered voters. Use the FHSD-specific registered voter count for turnout calculations.

### 3. Election Results PDFs (Statement of Votes Cast)
Download these PDFs and parse the "FRANCIS HOWELL R-III SCHOOL BOARD MEMBER" sections:

| Year | URL |
|------|-----|
| 2025 | `https://www.sccmo.org/ArchiveCenter/ViewFile/Item/5185` |
| 2024 | `https://www.sccmo.org/ArchiveCenter/ViewFile/Item/5056` |
| 2023 | `https://www.sccmo.org/ArchiveCenter/ViewFile/Item/4928` |
| 2022 | `https://www.sccmo.org/ArchiveCenter/ViewFile/Item/4798` |

The PDFs are formatted as tabular text. For each precinct in the FHSD race, extract:
- Precinct number
- Registered voters (FHSD portion)
- Ballots cast
- Vote counts for each candidate

**Pre-extracted data for 2024 and 2025 is provided in `data/fhsd_2024.json` and `data/fhsd_2025.json`.** Parse 2022 and 2023 from the PDFs.

### 4. Live Election Night Results (2026)
**URL:** `https://www.livevoterturnout.com/ENR/stcharlesmoenr/31/en/Index_31.html`

This site will publish real-time precinct-level results on April 7, 2026. It renders as HTML tables grouped by precinct, showing candidate names and vote counts. The format is the same as the 2025 results at `/30/en/Index_30.html`.

**CORS will block direct browser fetch.** Options:
1. **Manual paste mode:** Provide a textarea where the user can paste raw results text, with a parser that extracts FHSD data
2. **Bookmarklet:** Provide a bookmarklet that scrapes the results page and copies structured data to clipboard
3. **Proxy server:** If deploying on a server, add a proxy endpoint

For the MVP, implement option 1 (manual paste).

## Slate Mappings

See `slates.json` for the complete mapping. Summary:

| Year | FH Families (Red) | FH Forward (Blue) | Other | Seats |
|------|---|---|---|---|
| **2026** | Greenwood, Jaworski, Puszkar | Adams, Dillard, McGuire | — | 3 |
| **2025** | Cook, Sturm | Gryder, Oelke | — | 2 |
| **2024** | Kuhn, Young | Blair, Owens | — | 2 |
| **2023** | Harmon, Ponder, Puszkar | Easterling, Flett, Harris | Ziegemeier, Lane, Treece (independent) | 3 |
| **2022** | Bertrand, Cook | *(did not run as slate)* | Others TBD from PDF | 2 |

### Swing Calculation
For each precinct, calculate:
- **Slate vote share** = (sum of all candidates on a slate) / (total votes cast in that precinct's FHSD race)
- **FH Families margin** = FH Families share - FH Forward share
- **Swing** = Current year margin - Prior year margin (positive = swing to FH Families, negative = swing to FH Forward)

For **2022 baseline:** Since FH Forward didn't run a formal slate, identify the non-FH-Families candidates from the PDF and group them as the opposing side. The swing from 2022→2023 shows how the electorate shifted once formal slates formed.

For **2023 independents** (Ziegemeier, Lane, Treece): Exclude their votes from slate calculations. Recalculate share as FH Families / (FH Families + FH Forward) only.

## UI Requirements

### Map View
- **Leaflet.js** choropleth map centered on FHSD area (~38.75°N, -90.7°W, zoom 11)
- Precincts filled with color gradient:
  - Deep red (#DC2626) = strong FH Families margin (>20%)
  - Light red (#FCA5A5) = lean FH Families (<10%)
  - White/neutral = even
  - Light blue (#93C5FD) = lean FH Forward (<10%)
  - Deep blue (#2563EB) = strong FH Forward margin (>20%)
- Precinct borders in dark gray
- Non-FHSD precincts shown with no fill or light gray

### Hover Tooltip
On hovering a precinct, show:
- Precinct number
- Total votes cast
- FH Families vote share (with candidate names and individual counts)
- FH Forward vote share (with candidate names and individual counts)
- Margin (e.g., "FH Forward +8.2%")
- Swing from selected comparison year (e.g., "Swing: FHF→FHFwd 3.1% since 2024")

### Summary Dashboard Panel
Fixed panel (sidebar or top bar) showing:
- **Current election year** being displayed
- **Total votes:** Sum across all FHSD precincts
- **Overall margin:** Aggregate FH Families vs FH Forward vote share
- **Precincts reporting:** X of 38 (for live mode)
- **Average swing from 2024** (1 year ago)
- **Average swing from 2023** (2 years ago)
- **Average swing from 2022** (3 years ago / baseline)

### Year Selector
- Dropdown or button group to switch between years: 2022, 2023, 2024, 2025, 2026
- When viewing historical data, the map recolors based on that year's results
- Swing comparisons update relative to the selected year

### Swing Comparison Selector
- Secondary dropdown: "Compare swing to: [2022 | 2023 | 2024 | 2025]"
- Changes the swing values shown on hover and the average swing in the dashboard

### Live Mode (2026)
- Toggle for "Live Mode" — when enabled:
  - Shows a "Paste Results" button that opens a modal with a textarea
  - User pastes raw HTML/text from livevoterturnout.com
  - Parser extracts FHSD precinct data and updates the map
  - Timestamp of last update shown
  - Auto-calculates all swing comparisons against historical data

## Technical Architecture

### Recommended Stack
- **React** single-page app (Vite or Create React App)
- **Leaflet** + **react-leaflet** for mapping
- **Tailwind CSS** for styling
- Data stored as JSON files in `data/` directory

### File Structure
```
fhsd-election-map/
├── SPEC.md
├── slates.json
├── data/
│   ├── fhsd_2022.json    # Parse from PDF
│   ├── fhsd_2023.json    # Parse from PDF
│   ├── fhsd_2024.json    # Provided
│   ├── fhsd_2025.json    # Provided
│   └── precincts.geojson  # Fetched from ArcGIS, cached locally
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── ElectionMap.jsx
│   │   ├── PrecinctTooltip.jsx
│   │   ├── Dashboard.jsx
│   │   ├── YearSelector.jsx
│   │   ├── LiveModePanel.jsx
│   │   └── ResultsPaster.jsx
│   ├── utils/
│   │   ├── slateCalculator.js   # Margin/swing math
│   │   ├── colorScale.js        # Red-white-blue gradient
│   │   ├── resultParser.js      # Parse pasted live results
│   │   └── dataLoader.js        # Load/merge historical data
│   └── data/
│       └── slates.js            # Candidate-to-slate mapping
├── public/
│   └── index.html
├── package.json
└── vite.config.js
```

### First Steps for Claude Code
1. **Fetch precinct GeoJSON:** Query the ArcGIS endpoint and save to `data/precincts.geojson`
2. **Parse remaining PDFs:** Download 2022 and 2023 PDFs, extract FHSD race data into JSON
3. **Build the map component:** Render precincts with Leaflet, color by margin
4. **Add interactivity:** Hover tooltips, year selector, dashboard
5. **Add live mode:** Paste parser for 2026 election night

### Key Implementation Notes
- The ArcGIS data uses State Plane Missouri East coordinates (WKID 102696) natively. Request `outSR=4326` in the query to get WGS84.
- Precinct numbers in the GeoJSON `DIST_NUM` field are strings (e.g., "213"). Match these to the election data precinct numbers.
- The "CENTRAL 1" and "ABSENTEE" entries in election data have no geographic precinct — include them in totals but not on the map.
- Some precincts are split between FHSD and another district (e.g., precinct 512 appears in both FHSD and Fort Zumwalt results with different registered voter counts). Use only the FHSD portion.
