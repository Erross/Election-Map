# FHSD Election Map

Interactive precinct-level election results map for Francis Howell School District board elections.

## Quick Start with Claude Code

```bash
cd fhsd-election-map
# Tell Claude Code:
# "Read SPEC.md and build this app. Start by downloading the 2022 and 2023 PDFs, parsing the FHSD race data, then build the React app with Leaflet."
```

## Files Included

- `SPEC.md` — Full specification with ArcGIS endpoint, architecture, and UI requirements
- `slates.json` — Candidate-to-slate mapping for all years (2022–2026)
- `data/fhsd_2025.json` — Pre-extracted precinct results for April 2025
- `data/fhsd_2024.json` — Pre-extracted precinct results for April 2024

## PDFs to Download

Place these in `data/pdfs/` — Claude Code should download and parse them:

| Year | Direct PDF URL |
|------|----------------|
| 2025 | https://www.sccmo.org/ArchiveCenter/ViewFile/Item/5185 |
| 2024 | https://www.sccmo.org/ArchiveCenter/ViewFile/Item/5056 |
| 2023 | https://www.sccmo.org/ArchiveCenter/ViewFile/Item/4928 |
| 2022 | https://www.sccmo.org/ArchiveCenter/ViewFile/Item/4798 |

The 2024 and 2025 data has already been extracted into JSON. Claude Code needs to parse 2022 and 2023 from their PDFs. Look for the **"FRANCIS HOWELL R-III SCHOOL BOARD MEMBER"** section in each PDF.

## ArcGIS Precinct Polygons

Query URL for all St. Charles County voting district boundaries:
```
https://maps.sccmo.org/scc_gis/rest/services/appservices/votinginformation/MapServer/1/query?where=1%3D1&outFields=DIST_NUM,LONGNAME,SHORTNAME,DISTRICT&f=geojson&outSR=4326&returnGeometry=true
```

Save result as `data/precincts.geojson`. Filter to only FHSD precincts (those appearing in the election data).
