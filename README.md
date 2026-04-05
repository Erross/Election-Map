FHSD Election Map
Interactive precinct-level choropleth map for Francis Howell School District (FHSD) school board election results. Visualize vote margins, compare swing across years, and track results live on election night.
Features

Precinct choropleth map — 38 FHSD precincts colored on a red (FH Families) to blue (FH Forward) gradient by vote margin
Historical data (2022–2025) — Switch between election years to see how the district voted over time
Swing analysis — Compare any two years to see per-precinct and aggregate swing
Map overlays — Toggle between margin, swing, and turnout delta labels on the map
Hover tooltips — Precinct-level breakdowns with candidate vote counts, margin, and swing
Live mode (2026) — Paste results from livevoterturnout.com on election night for real-time map updates
Summary dashboard — Aggregate vote totals, overall margin, precincts reporting, and historical swing bars

Getting Started
Prerequisites

Node.js 20+
npm

Install and Run
bashcd election-app
npm install
npm run dev
The app will be available at http://localhost:5173.
Build for Production
bashnpm run build
Output is written to dist/.
Data Sources
SourceDescriptionSt. Charles County ArcGISPrecinct polygon boundaries (GeoJSON), cached in public/precincts.geojsonStatement of Votes Cast PDFsOfficial election results from sccmo.org, parsed into JSONslates.jsonCandidate-to-slate mapping for all years (2022–2026)
Election Data Files
Pre-parsed JSON files in public/:
FileYearNotesfhsd_2022.json2022Baseline year; aggregate only (precincts renumbered after 2022)fhsd_2023.json2023First year with formal FH Families vs FH Forward slatesfhsd_2024.json2024fhsd_2025.json2025
Slate Mappings
YearFH Families (Red)FH Forward (Blue)Seats2026Greenwood, Jaworski, PuszkarAdams, Dillard, McGuire32025Cook, SturmGryder, Oelke22024Kuhn, YoungBlair, Owens22023Harmon, Ponder, PuszkarEasterling, Flett, Harris32022Bertrand, Cook(no formal opposing slate)2
How It Works
Margin Calculation
For each precinct, margin is computed as the difference between FH Families and FH Forward vote shares, using only slate candidates in the denominator (independents excluded):
margin = (famVotes - fwdVotes) / (famVotes + fwdVotes)
Positive values indicate an FH Families lead; negative values indicate FH Forward.
Swing Calculation
Swing compares the margin of two election years:
swing = currentMargin - comparisonMargin
A positive swing means the precinct moved toward FH Families relative to the comparison year.
2022 Baseline
2022 used different precinct boundaries, so per-precinct geographic comparisons to 2022 are not available. Swing vs 2022 is shown as an aggregate-only figure.
Project Structure
election-app/
├── public/
│   ├── precincts.geojson      # Cached ArcGIS precinct polygons
│   ├── slates.json            # Candidate-to-slate config
│   ├── fhsd_2022–2025.json    # Parsed election results
│   └── favicon.svg
├── src/
│   ├── App.jsx                # Root layout — sidebar + map
│   ├── App.css                # All app styles
│   ├── components/
│   │   ├── ElectionMap.jsx    # Leaflet GeoJSON choropleth layer
│   │   ├── PrecinctTooltip.jsx# Hover tooltip with candidate details
│   │   ├── Dashboard.jsx      # Sidebar: year selector, stats, swings
│   │   ├── LabelLayer.jsx     # Map text overlays (margin/swing/turnout)
│   │   └── ResultsPaster.jsx  # Modal for pasting live 2026 results
│   └── utils/
│       ├── slateCalculator.js # Margin, swing, aggregate math
│       ├── colorScale.js      # Red–white–blue color gradient
│       ├── resultParser.js    # Parse pasted livevoterturnout.com HTML
│       └── dataLoader.js      # Fetch and merge all data at startup
├── package.json
├── vite.config.js
└── index.html
Tech Stack

React 19 + Vite 8
Leaflet + react-leaflet for the interactive map
Election data stored as static JSON served from public/

Live Mode (Election Night 2026)
On April 7, 2026, results will be published at livevoterturnout.com. Since CORS prevents direct fetching, the app provides a paste-based workflow:

Open the live results page in a separate tab
Select all and copy the page content
Click "Paste Results" in the app sidebar
The parser extracts FHSD precinct data and updates the map in real time

License
Private project — not licensed for redistribution.
