/**
 * Load all historical election data and GeoJSON.
 * Data files are served from /public/.
 */

const YEARS = [2022, 2023, 2024, 2025];

export async function loadAll() {
  const [geojson, slates, ...yearResults] = await Promise.all([
    fetch('/precincts.geojson').then(r => r.json()),
    fetch('/slates.json').then(r => r.json()),
    ...YEARS.map(y => fetch(`/fhsd_${y}.json`).then(r => r.json())),
  ]);

  const electionData = {};
  YEARS.forEach((y, i) => { electionData[y] = yearResults[i]; });

  return { geojson, slates, electionData };
}
