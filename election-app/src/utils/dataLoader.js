/**
 * Load all historical election data and GeoJSON.
 * Data files are served from /public/.
 */

const YEARS = [2022, 2023, 2024, 2025];

const BASE = import.meta.env.BASE_URL;

/**
 * Remap 2022 precinct data from old precinct numbers to current DIST_NUM keys.
 * Uses the precinct_crosswalk_2022_to_2023 field embedded in the 2022 JSON.
 * When two old precincts share the same new key, their vote counts are summed.
 */
function remap2022(yearData) {
  const crosswalk = yearData.precinct_crosswalk_2022_to_2023;
  if (!crosswalk || !yearData.precincts) return yearData;

  const remapped = {};
  for (const [oldKey, row] of Object.entries(yearData.precincts)) {
    const entry = crosswalk[oldKey];
    if (!entry) continue; // no crosswalk entry — skip
    const newKey = entry.new[0];

    if (!remapped[newKey]) {
      // First precinct mapping to this new key — copy all fields
      remapped[newKey] = { ...row };
    } else {
      // Collision — sum numeric fields
      const existing = remapped[newKey];
      for (const [field, val] of Object.entries(row)) {
        if (typeof val === 'number') {
          existing[field] = (existing[field] ?? 0) + val;
        }
      }
    }
  }

  return { ...yearData, precincts: remapped };
}

export async function loadAll() {
  const [geojson, slates, ...yearResults] = await Promise.all([
    fetch(`${BASE}precincts.geojson`).then(r => r.json()),
    fetch(`${BASE}slates.json`).then(r => r.json()),
    ...YEARS.map(y => fetch(`${BASE}fhsd_${y}.json`).then(r => r.json())),
  ]);

  const electionData = {};
  YEARS.forEach((y, i) => {
    electionData[y] = y === 2022 ? remap2022(yearResults[i]) : yearResults[i];
  });

  return { geojson, slates, electionData };
}
