/**
 * Compute per-precinct slate margins and swing.
 * margin = fhFamilies_share - fhForward_share  (positive = FH Families leads)
 * swing  = current_margin - comparison_margin   (positive = shift toward FH Families)
 */

const FHSD_PRECINCTS = new Set([
  "213","214","215","301","303","304","305","306","307",
  "316","317","401","506","508","509","510","511","512",
  "514","515","516","517","616","617","701","702","703",
  "704","705","706","707","708","709","710","711","712",
  "713","714"
]);

/**
 * Normalize slate config: slates.json uses { candidates: [...] } objects,
 * while per-year JSON files use flat arrays. Always return arrays.
 */
function getCandidates(slateEntry) {
  if (!slateEntry) return [];
  if (Array.isArray(slateEntry)) return slateEntry;
  if (Array.isArray(slateEntry.candidates)) return slateEntry.candidates;
  return [];
}

/**
 * For a single precinct row and slate config, compute margin.
 * Returns null if the precinct has no votes.
 */
export function computeMargin(precinctRow, slateConfig) {
  const fh_families = getCandidates(slateConfig.fh_families);
  const fh_forward = getCandidates(slateConfig.fh_forward);
  const total = precinctRow.total_votes;
  if (!total) return null;

  const famVotes = fh_families.reduce((s, c) => s + (precinctRow[c] ?? 0), 0);
  const fwdVotes = fh_forward.reduce((s, c) => s + (precinctRow[c] ?? 0), 0);

  // Normalize by candidate count so a 3-seat race doesn't inflate one slate's totals
  const famAvg = famVotes / (fh_families.length || 1);
  const fwdAvg = fwdVotes / (fh_forward.length || 1);
  const denominator = famAvg + fwdAvg;
  if (!denominator) return null;

  return (famAvg - fwdAvg) / denominator; // positive = FH Families ahead
}

/**
 * Build a { precinctId -> margin } map for a given year's data + slates config.
 */
export function buildMarginMap(yearData, slatesConfig) {
  const year = String(yearData.year);
  const slateYear = slatesConfig.slates[year];
  if (!slateYear) return {};

  const result = {};
  for (const [pid, row] of Object.entries(yearData.precincts ?? {})) {
    if (!FHSD_PRECINCTS.has(pid)) continue;
    const m = computeMargin(row, slateYear);
    if (m !== null) result[pid] = m;
  }
  return result;
}

/**
 * Build a { precinctId -> turnout } map (total_votes / reg_voters).
 */
export function buildTurnoutMap(yearData) {
  const result = {};
  for (const [pid, row] of Object.entries(yearData.precincts ?? {})) {
    if (!FHSD_PRECINCTS.has(pid)) continue;
    if (row.reg_voters > 0) result[pid] = row.total_votes / row.reg_voters;
  }
  return result;
}

/**
 * Compute aggregate totals across all map precincts.
 */
export function computeAggregate(yearData, slatesConfig) {
  const year = String(yearData.year);
  const slateYear = slatesConfig.slates[year];
  if (!slateYear) return null;

  const fh_families = getCandidates(slateYear.fh_families);
  const fh_forward = getCandidates(slateYear.fh_forward);
  let famTotal = 0, fwdTotal = 0, totalVotes = 0;

  for (const [pid, row] of Object.entries(yearData.precincts ?? {})) {
    if (!FHSD_PRECINCTS.has(pid)) continue;
    famTotal += fh_families.reduce((s, c) => s + (row[c] ?? 0), 0);
    fwdTotal += fh_forward.reduce((s, c) => s + (row[c] ?? 0), 0);
    totalVotes += row.total_votes ?? 0;
  }

  // Include non-map precincts (ABSENTEE, CENTRAL) in vote totals
  for (const row of Object.values(yearData.non_map_precincts ?? {})) {
    famTotal += fh_families.reduce((s, c) => s + (row[c] ?? 0), 0);
    fwdTotal += fh_forward.reduce((s, c) => s + (row[c] ?? 0), 0);
    totalVotes += row.total_votes ?? 0;
  }

  const famAvg = famTotal / (fh_families.length || 1);
  const fwdAvg = fwdTotal / (fh_forward.length || 1);
  const denom = famAvg + fwdAvg;
  const margin = denom ? (famAvg - fwdAvg) / denom : 0;
  return { famTotal, fwdTotal, totalVotes, margin };
}

/**
 * For display: number of FHSD precincts that have reported (total_votes > 0).
 */
export function countReporting(yearData) {
  let count = 0;
  for (const [pid, row] of Object.entries(yearData.precincts ?? {})) {
    if (FHSD_PRECINCTS.has(pid) && row.total_votes > 0) count++;
  }
  return count;
}

/**
 * Compute aggregate margin for a year from its totals object.
 * Works for 2022 which has no per-precinct geo match.
 */
export function computeAggregateMarginFromTotals(yearData, slatesConfig) {
  const year = String(yearData.year);
  const slateYear = slatesConfig.slates[year];
  if (!slateYear) return null;
  const fh_families = getCandidates(slateYear.fh_families);
  const fh_forward = getCandidates(slateYear.fh_forward);
  const totals = yearData.totals ?? {};
  const famVotes = fh_families.reduce((s, c) => s + (totals[c] ?? 0), 0);
  const fwdVotes = fh_forward.reduce((s, c) => s + (totals[c] ?? 0), 0);
  const famAvg = famVotes / (fh_families.length || 1);
  const fwdAvg = fwdVotes / (fh_forward.length || 1);
  const denom = famAvg + fwdAvg;
  return denom ? (famAvg - fwdAvg) / denom : null;
}

export { FHSD_PRECINCTS };
