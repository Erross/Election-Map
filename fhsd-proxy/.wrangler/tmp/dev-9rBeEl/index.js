var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-DGBDje/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var FHSD_PRECINCTS = /* @__PURE__ */ new Set([
  "213",
  "214",
  "215",
  "301",
  "303",
  "304",
  "305",
  "306",
  "307",
  "316",
  "317",
  "401",
  "506",
  "508",
  "509",
  "510",
  "511",
  "512",
  "514",
  "515",
  "516",
  "517",
  "616",
  "617",
  "701",
  "702",
  "703",
  "704",
  "705",
  "706",
  "707",
  "708",
  "709",
  "710",
  "711",
  "712",
  "713",
  "714"
]);
var SPECIAL_KEYS = { ABSENTEE: "ABSENTEE", "CENTRAL 1": "CENTRAL 1" };
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}
__name(stripTags, "stripTags");
function dedupName(raw) {
  const s = raw.trim();
  const half = s.length / 2;
  if (Number.isInteger(half) && s.slice(0, half) === s.slice(half)) {
    return s.slice(0, half).trim();
  }
  return s;
}
__name(dedupName, "dedupName");
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
    const votes = parseInt(votesMatch[1].replace(/,/g, "").trim(), 10);
    if (!name || isNaN(votes)) continue;
    entry.total_votes += votes;
    const key = name.toUpperCase() === "WRITE-IN" ? "WRITE IN" : name;
    entry[key] = votes;
  }
  return entry;
}
__name(parsePrecinct, "parsePrecinct");
function parseResults(html) {
  const tsMatch = html.match(/lblLastPublishedDateTime[^>]*>([^<]+)/i);
  const sourceUpdated = tsMatch ? tsMatch[1].trim() : null;
  const sectionRe = /Precinct:\s*([\w\s]+?)\s*-\s*Contest:\s*FRANCIS HOWELL R-III SCHOOL BOARD MEMBER/gi;
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
    const upperPid = pid.toUpperCase();
    let key;
    if (FHSD_PRECINCTS.has(pid)) key = pid;
    else if (SPECIAL_KEYS[upperPid]) key = SPECIAL_KEYS[upperPid];
    else continue;
    const tbodyMatch = chunk.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;
    precincts[key] = parsePrecinct(tbodyMatch[1]);
  }
  return { precincts, sourceUpdated };
}
__name(parseResults, "parseResults");
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
function computeHash(precincts) {
  const input = Object.keys(precincts).sort().map(
    (p) => `${p}:${precincts[p].total_votes}`
  ).join("|");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}
__name(computeHash, "computeHash");
function jsonResponse(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
var src_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const parsedAt = (/* @__PURE__ */ new Date()).toISOString();
    let html;
    try {
      const upstream = await fetch(env.RESULTS_URL, {
        cf: { cacheTtl: 30 },
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FHSD-proxy/1.0)" }
      });
      if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
      html = await upstream.text();
    } catch (err) {
      return jsonResponse(
        { error: "Failed to fetch results page", detail: err.message, parsedAt },
        502,
        origin
      );
    }
    const parsed = parseResults(html);
    if (!parsed || !Object.keys(parsed.precincts).length) {
      return jsonResponse(
        {
          error: "Results not available yet",
          detail: "The FRANCIS HOWELL race was not found on the results page. The page may not be live yet.",
          parsedAt
        },
        503,
        origin
      );
    }
    const mapPrecincts = {};
    const nonMapPrecincts = {};
    for (const [k, v] of Object.entries(parsed.precincts)) {
      if (FHSD_PRECINCTS.has(k)) mapPrecincts[k] = v;
      else nonMapPrecincts[k] = v;
    }
    const reportingCount = Object.values(mapPrecincts).filter((v) => v.total_votes > 0).length;
    const dataHash = computeHash(mapPrecincts);
    const clientETag = request.headers.get("If-None-Match");
    if (clientETag === dataHash) {
      return new Response(null, { status: 304, headers: corsHeaders(origin) });
    }
    return jsonResponse({
      year: 2026,
      race: "FRANCIS HOWELL R-III SCHOOL BOARD MEMBER",
      election_date: "2026-04-07",
      live: true,
      precincts: mapPrecincts,
      non_map_precincts: nonMapPrecincts,
      reportingCount,
      totalPrecincts: 38,
      parsedAt,
      sourceUpdated: parsed.sourceUpdated,
      dataHash
    }, 200, origin, { ETag: dataHash });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-DGBDje/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-DGBDje/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
