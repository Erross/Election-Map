/**
 * Parse pasted live results text from livevoterturnout.com
 * for the 2026 FHSD race.
 *
 * The site renders HTML tables. When the user copies the page text,
 * it arrives as tab/newline-delimited rows like:
 *
 *   PRECINCT 213
 *   Candidate Name    Party    Votes    Pct
 *   LAUREN GREENWOOD           123      34.56%
 *   ...
 *
 * We extract FHSD precincts by detecting the "FRANCIS HOWELL" heading
 * and parsing candidate rows until the next precinct.
 */

const FHSD_CANDIDATES_2026 = [
  'LAUREN GREENWOOD', 'DAVID JAWORSKI', 'JANE PUSZKAR',  // FH Families
  'JASON ADAMS', 'SARA DILLARD', 'KEVIN MCGUIRE',         // FH Forward
];

const FHSD_PRECINCTS = new Set([
  "213","214","215","301","303","304","305","306","307",
  "316","317","401","506","508","509","510","511","512",
  "514","515","516","517","616","617","701","702","703",
  "704","705","706","707","708","709","710","711","712",
  "713","714"
]);

/**
 * Parse pasted text and return a yearData-shaped object for 2026.
 * Returns null on failure with an error message.
 */
export function parseLiveResults(rawText) {
  if (!rawText || rawText.trim().length < 50) {
    return { error: 'Pasted text is too short. Please paste the full results page.' };
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Find FRANCIS HOWELL section
  let fhsdStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/FRANCIS HOWELL/i.test(lines[i])) {
      fhsdStart = i;
      break;
    }
  }
  if (fhsdStart === -1) {
    return { error: 'Could not find "FRANCIS HOWELL" section. Make sure you copied the full results page.' };
  }

  const precincts = {};
  let currentPrecinct = null;
  const slates2026 = {
    fh_families: ['LAUREN GREENWOOD', 'DAVID JAWORSKI', 'JANE PUSZKAR'],
    fh_forward: ['JASON ADAMS', 'SARA DILLARD', 'KEVIN MCGUIRE'],
  };

  for (let i = fhsdStart; i < lines.length; i++) {
    const line = lines[i];

    // Detect precinct header, e.g. "Precinct 213" or "213"
    const precinctMatch = line.match(/(?:Precinct\s+)?^(\d{3})$/i) ||
                          line.match(/(?:Precinct\s+)(\d{3})\b/i) ||
                          line.match(/^(\d{3})\s/);
    if (precinctMatch) {
      const pid = precinctMatch[1];
      if (FHSD_PRECINCTS.has(pid)) {
        currentPrecinct = pid;
        if (!precincts[pid]) {
          precincts[pid] = { reg_voters: 0, total_votes: 0 };
          for (const c of FHSD_CANDIDATES_2026) precincts[pid][c] = 0;
        }
      } else {
        currentPrecinct = null;
      }
      continue;
    }

    if (!currentPrecinct) continue;

    // Try to match "CANDIDATE NAME   123   45.67%"
    const voteMatch = line.match(/^([A-Z][A-Z\s.'-]+?)\s{2,}(\d+)\s+([\d.]+)%/);
    if (voteMatch) {
      const name = voteMatch[1].trim().toUpperCase();
      const votes = parseInt(voteMatch[2], 10);
      // Find best matching candidate
      const matched = FHSD_CANDIDATES_2026.find(c =>
        c.includes(name) || name.includes(c.split(' ').pop())
      );
      if (matched) {
        precincts[currentPrecinct][matched] = votes;
        precincts[currentPrecinct].total_votes += votes;
      }
    }

    // Reg voters line: "Registered Voters: 2398"
    const regMatch = line.match(/Registered\s+Voters[:\s]+(\d+)/i);
    if (regMatch && currentPrecinct) {
      precincts[currentPrecinct].reg_voters = parseInt(regMatch[1], 10);
    }
  }

  const reportingCount = Object.keys(precincts).length;
  if (reportingCount === 0) {
    return { error: 'No FHSD precincts found. The format may have changed — try pasting again.' };
  }

  return {
    year: 2026,
    election_date: '2026-04-07',
    race: 'FRANCIS HOWELL R-III SCHOOL BOARD MEMBER',
    seats: 3,
    candidates: FHSD_CANDIDATES_2026,
    slates: slates2026,
    precincts,
    non_map_precincts: {},
    live: true,
    reportingCount,
    parsedAt: new Date().toISOString(),
  };
}
