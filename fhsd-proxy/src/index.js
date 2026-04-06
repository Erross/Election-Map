const FHSD_PRECINCTS = new Set([
  "213","214","215","301","303","304","305","306","307",
  "316","317","401","506","508","509","510","511","512",
  "514","515","516","517","616","617","701","702","703",
  "704","705","706","707","708","709","710","711","712",
  "713","714",
]);

const SPECIAL_KEYS = { ABSENTEE: "ABSENTEE", "CENTRAL 1": "CENTRAL 1" };

/** Strip HTML tags from a string. */
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').trim();
}

/**
 * The live page puts the candidate name in a <td dc="true"> with two identical
 * <span> elements (visible + sr-only). Stripping tags concatenates them.
 * Deduplicate: if the string is "FOOFOO", return "FOO".
 */
function dedupName(raw) {
  const s = raw.trim();
  const half = s.length / 2;
  if (Number.isInteger(half) && s.slice(0, half) === s.slice(half)) {
    return s.slice(0, half).trim();
  }
  return s;
}

/**
 * Parse a <tbody> HTML string for one precinct's contest.
 * Each data row has:
 *   <td>           — color swatch (ignored)
 *   <td dc="true"> — candidate name (doubled spans)
 *   <td dw="true"> — empty
 *   <td dv="true"> — integer vote count
 *   <td dpe="true">— percentage (ignored)
 *   <td dpr="true">— progress bar (ignored)
 */
function parsePrecinct(tbodyHtml) {
  const entry = { reg_voters: 0, total_votes: 0 };
  const rowRe = /<tr\b[^>]*class="content-row"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRe.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[1];

    const nameMatch = rowHtml.match(/<td\b[^>]*\bdc="true"[^>]*>([\s\S]*?)<\/td>/i);
    const votesMatch = rowHtml.match(/<td\b[^>]*\bdv="true"[^>]*>([\s\S]*?)<\/td>/i);
    if (!nameMatch || !votesMatch) continue;

    const name = dedupName(stripTags(nameMatch[1]));
    const votes = parseInt(votesMatch[1].replace(/,/g, '').trim(), 10);
    if (!name || isNaN(votes)) continue;

    entry.total_votes += votes;
    // Normalize to match historic data keys
    const key = name.toUpperCase() === 'WRITE-IN' ? 'WRITE IN' : name;
    entry[key] = votes;
  }

  return entry;
}

function parseResults(html) {
  // Grab the timestamp from <span id="lblLastPublishedDateTime">
  const tsMatch = html.match(/lblLastPublishedDateTime[^>]*>([^<]+)/i);
  const sourceUpdated = tsMatch ? tsMatch[1].trim() : null;

  // Each Francis Howell precinct section starts with an anchor whose text contains:
  //   "Precinct: 213 - Contest: FRANCIS HOWELL R-III SCHOOL BOARD MEMBER"
  // The content div immediately follows the anchor.
  const sectionRe = /Precinct:\s*([\w\s]+?)\s*-\s*Contest:\s*FRANCIS HOWELL R-III SCHOOL BOARD MEMBER/gi;

  const sections = [];
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const pid = m[1].trim();
    // Skip duplicate anchor entries (the page has two anchors per section)
    if (!sections.length || sections[sections.length - 1].pid !== pid) {
      sections.push({ pid, pos: m.index });
    }
  }

  if (!sections.length) return null;

  const precincts = {};

  for (let i = 0; i < sections.length; i++) {
    const { pid, pos } = sections[i];
    const endPos = i + 1 < sections.length ? sections[i + 1].pos : html.length;
    const chunk = html.slice(pos, endPos);

    // Determine the output key
    const upperPid = pid.toUpperCase();
    let key;
    if (FHSD_PRECINCTS.has(pid)) key = pid;
    else if (SPECIAL_KEYS[upperPid]) key = SPECIAL_KEYS[upperPid];
    else continue;

    // Find the <tbody> in this chunk
    const tbodyMatch = chunk.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    precincts[key] = parsePrecinct(tbodyMatch[1]);
  }

  return { precincts, sourceUpdated };
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function computeHash(precincts) {
  const input = Object.keys(precincts).sort().map(p =>
    `${p}:${precincts[p].total_votes}`
  ).join('|');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}

function jsonResponse(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const parsedAt = new Date().toISOString();

    let html;
    try {
      const upstream = await fetch(env.RESULTS_URL, {
        cf: { cacheTtl: 30 },
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FHSD-proxy/1.0)' },
      });
      if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
      html = await upstream.text();
    } catch (err) {
      return jsonResponse(
        { error: 'Failed to fetch results page', detail: err.message, parsedAt },
        502,
        origin,
      );
    }

    const parsed = parseResults(html);

    if (!parsed || !Object.keys(parsed.precincts).length) {
      return jsonResponse(
        {
          error: 'Results not available yet',
          detail: 'The FRANCIS HOWELL race was not found on the results page. The page may not be live yet.',
          parsedAt,
        },
        503,
        origin,
      );
    }

    const mapPrecincts = {};
    const nonMapPrecincts = {};
    for (const [k, v] of Object.entries(parsed.precincts)) {
      if (FHSD_PRECINCTS.has(k)) mapPrecincts[k] = v;
      else nonMapPrecincts[k] = v;
    }

    const reportingCount = Object.values(mapPrecincts).filter(v => v.total_votes > 0).length;
    const dataHash = computeHash(mapPrecincts);

    // 304 Not Modified if client already has this data
    const clientETag = request.headers.get('If-None-Match');
    if (clientETag === dataHash) {
      return new Response(null, { status: 304, headers: corsHeaders(origin) });
    }

    return jsonResponse({
      year: 2026,
      race: 'FRANCIS HOWELL R-III SCHOOL BOARD MEMBER',
      election_date: '2026-04-07',
      live: true,
      precincts: mapPrecincts,
      non_map_precincts: nonMapPrecincts,
      reportingCount,
      totalPrecincts: 38,
      parsedAt,
      sourceUpdated: parsed.sourceUpdated,
      dataHash,
    }, 200, origin, { ETag: dataHash });
  },
};
