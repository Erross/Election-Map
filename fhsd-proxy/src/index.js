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
    const key = name.toUpperCase() === 'WRITE-IN' ? 'WRITE IN' : name;
    entry[key] = votes;
  }

  return entry;
}

/**
 * Generic section parser. Finds all "Precinct: X - Contest: <contestPattern>" sections
 * in the HTML and returns { pid -> parsedPrecinct }.
 * Deduplicates the doubled anchors the page emits for each section.
 */
function parseContest(html, contestPattern) {
  const sectionRe = new RegExp(
    `Precinct:\\s*([\\w\\s]+?)\\s*-\\s*Contest:\\s*${contestPattern}`,
    'gi'
  );

  const sections = [];
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const pid = m[1].trim();
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

    const tbodyMatch = chunk.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    // For FHSD: restrict to known precincts. For others: accept all.
    precincts[pid] = parsePrecinct(tbodyMatch[1]);
  }

  return Object.keys(precincts).length ? precincts : null;
}

function computeHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}

function precinctHashString(precincts) {
  return Object.keys(precincts).sort().map(p =>
    `${p}:${precincts[p].total_votes}`
  ).join('|');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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

    // Timestamp
    const tsMatch = html.match(/lblLastPublishedDateTime[^>]*>([^<]+)/i);
    const sourceUpdated = tsMatch ? tsMatch[1].trim() : null;

    // ── FHSD school board ────────────────────────────────────────────
    const fhsdRaw = parseContest(html, 'FRANCIS HOWELL R-III SCHOOL BOARD MEMBER');

    if (!fhsdRaw) {
      return jsonResponse(
        {
          error: 'Results not available yet',
          detail: 'The FRANCIS HOWELL race was not found on the results page.',
          parsedAt,
        },
        503,
        origin,
      );
    }

    const fhsdMap = {};
    const fhsdNonMap = {};
    for (const [k, v] of Object.entries(fhsdRaw)) {
      if (FHSD_PRECINCTS.has(k)) fhsdMap[k] = v;
      else if (SPECIAL_KEYS[k.toUpperCase()]) fhsdNonMap[SPECIAL_KEYS[k.toUpperCase()]] = v;
    }
    const fhsdReporting = Object.values(fhsdMap).filter(v => v.total_votes > 0).length;

    // ── Proposition RT ───────────────────────────────────────────────
    const propRTRaw = parseContest(html, 'ST\\.\\s*CHARLES\\s+COUNTY\\s+PROPOSITION RT');
    let propRT = null;
    if (propRTRaw) {
      const propRTReporting = Object.values(propRTRaw).filter(v => v.total_votes > 0).length;
      propRT = {
        race: 'PROPOSITION RT',
        precincts: propRTRaw,
        reportingCount: propRTReporting,
        totalPrecincts: 116,
      };
    }

    // ── ETag / 304 ───────────────────────────────────────────────────
    const hashInput = precinctHashString(fhsdMap)
      + (propRT ? '||' + precinctHashString(propRT.precincts) : '');
    const dataHash = computeHash(hashInput);

    const clientETag = request.headers.get('If-None-Match');
    if (clientETag === dataHash) {
      return new Response(null, { status: 304, headers: corsHeaders(origin) });
    }

    return jsonResponse({
      fhsd: {
        race: 'FRANCIS HOWELL R-III SCHOOL BOARD MEMBER',
        precincts: fhsdMap,
        non_map_precincts: fhsdNonMap,
        reportingCount: fhsdReporting,
        totalPrecincts: 38,
      },
      propRT,
      dataHash,
      parsedAt,
      sourceUpdated,
    }, 200, origin, { ETag: dataHash });
  },
};
