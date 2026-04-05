/**
 * Load all historical election data and GeoJSON.
 * Data files are served from /public/.
 */

const YEARS = [2022, 2023, 2024, 2025];

const BASE = import.meta.env.BASE_URL;

export async function loadAll() {
  const [geojson, slates, ...yearResults] = await Promise.all([
    fetch(`${BASE}precincts.geojson`).then(r => r.json()),
    fetch(`${BASE}slates.json`).then(r => r.json()),
    ...YEARS.map(y => fetch(`${BASE}fhsd_${y}.json`).then(r => r.json())),
  ]);

  const electionData = {};
  YEARS.forEach((y, i) => { electionData[y] = yearResults[i]; });

  return { geojson, slates, electionData };
}