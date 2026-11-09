#!/usr/bin/env node
/* Predeploy check: every article page has a read counter field.

     node scripts/check-counters.js
     node scripts/check-counters.js --allow-missing-counter <slug> [--allow-missing-counter <slug>]
     ALLOW_MISSING_COUNTER=<slug>[,<slug>] firebase deploy --only hosting

   Reads the public Firestore document counters/site over REST, with no
   credentials and no sign-in (firestore.rules let anyone read it), and lists
   every writing/*.html slug that has no field there. Visitors can only add 1 to
   an existing field, so an article without one is not counted.

   - A missing field fails the check (exit 1), unless that slug is allowed with
     --allow-missing-counter or ALLOW_MISSING_COUNTER (comma separated). Use that
     only for a brand-new article; the owner's next sign-in on the site creates
     the field at 0 (scripts/owner-ui.js).
   - If counters/site cannot be read (no network, timeout, HTTP error), the
     check prints a WARNING and exits 0, so a deploy is not blocked by the
     network. --require-network turns that into exit 1.

   Project id: config.js (firebaseConfig.projectId) if present, else .firebaserc.
   The API key from config.js is sent when present; the read works without it.
   Writes nothing. No dependencies. Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RESERVED = { total: true, lastWrite: true };

function articleSlugs(root) {
  const dir = path.join(root, "writing");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return /\.html$/.test(f); }).sort()
    .map(function (f) { return f.replace(/\.html$/, ""); });
}

function projectConfig(root) {
  const cfgPath = path.join(root, "config.js");
  if (fs.existsSync(cfgPath)) {
    try {
      const sandbox = { window: {} };
      vm.createContext(sandbox);
      vm.runInContext(fs.readFileSync(cfgPath, "utf8"), sandbox, { filename: "config.js" });
      const c = sandbox.window.firebaseConfig || sandbox.firebaseConfig;
      if (c && c.projectId) return { projectId: String(c.projectId), apiKey: c.apiKey ? String(c.apiKey) : "" };
    } catch (e) { /* fall back to .firebaserc */ }
  }
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
    if (rc.projects && rc.projects.default) return { projectId: String(rc.projects.default), apiKey: "" };
  } catch (e) {}
  return null;
}

function counterUrl(cfg) {
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) +
    "/databases/(default)/documents/counters/site" + (cfg.apiKey ? "?key=" + encodeURIComponent(cfg.apiKey) : "");
}

/* Field names of counters/site, or null if the doc does not exist (HTTP 404). */
async function readCounterFields(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("HTTP " + r.status);
    const doc = await r.json();
    return Object.keys((doc && doc.fields) || {});
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("timed out after " + timeoutMs + " ms");
    const c = e && e.cause;
    const code = c && (c.code || (Array.isArray(c.errors) && c.errors[0] && c.errors[0].code) || c.message);
    throw new Error(code ? "network error: " + code : (e && e.message) || String(e));
  } finally { clearTimeout(timer); }
}

function missingCounters(fields, slugs) {
  const have = new Set(fields || []);
  return slugs.filter(function (s) { return !RESERVED[s] && !have.has(s); });
}

function parseArgs(argv, env) {
  const o = { allow: [], requireNetwork: false, root: path.resolve(__dirname, ".."), url: "", timeoutMs: 10000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--allow-missing-counter") o.allow.push(String(argv[++i] || ""));
    else if (a === "--require-network") o.requireNetwork = true;
    else if (a === "--root") o.root = path.resolve(argv[++i] || "");
    else if (a === "--url") o.url = String(argv[++i] || "");           /* tests only */
    else if (a === "--timeout-ms") o.timeoutMs = Number(argv[++i]) || 10000;
    else throw new Error("unknown option " + a);
  }
  String((env && env.ALLOW_MISSING_COUNTER) || "").split(",").forEach(function (s) { if (s.trim()) o.allow.push(s.trim()); });
  return o;
}

async function main(argv, env) {
  let o;
  try { o = parseArgs(argv, env); }
  catch (e) { console.error("check-counters: " + e.message); return 2; }
  const slugs = articleSlugs(o.root);
  const bad = o.allow.filter(function (s) { return slugs.indexOf(s) === -1; });
  if (bad.length) { console.error("check-counters: --allow-missing-counter names no writing/<slug>.html: " + bad.join(", ")); return 1; }
  let url = o.url;
  if (!url) {
    const cfg = projectConfig(o.root);
    if (!cfg) { console.error("check-counters: no project id in config.js or .firebaserc"); return 1; }
    url = counterUrl(cfg);
  }
  let fields;
  try { fields = await readCounterFields(url, o.timeoutMs); }
  catch (e) {
    const msg = "could not read counters/site (" + e.message + "). Read counters were NOT checked for " + slugs.length + " articles.";
    if (o.requireNetwork) { console.error("Counter check failed: " + msg); return 1; }
    console.warn("WARNING: " + msg + " The deploy continues. Run node scripts/check-counters.js again when online.");
    return 0;
  }
  if (fields === null) console.log("counters/site does not exist yet.");
  const missing = missingCounters(fields || [], slugs);
  const allowed = missing.filter(function (s) { return o.allow.indexOf(s) !== -1; });
  const blocking = missing.filter(function (s) { return o.allow.indexOf(s) === -1; });
  o.allow.filter(function (s) { return missing.indexOf(s) === -1; }).forEach(function (s) {
    console.log("Note: " + s + " already has a counter; --allow-missing-counter is not needed for it.");
  });
  allowed.forEach(function (s) {
    console.warn("ALLOWED: " + s + " has no read counter yet (--allow-missing-counter). Sign in on ellyokinyo.com once after the deploy to create it at 0.");
  });
  if (blocking.length) {
    console.error("Counter check failed. These articles have no field in counters/site, so their reads are not counted:");
    blocking.forEach(function (s) { console.error("  - " + s); });
    console.error("Sign in on ellyokinyo.com as the owner (creates missing fields at 0), or, for a brand-new article, deploy with --allow-missing-counter <slug> (ALLOW_MISSING_COUNTER=<slug>).");
    return 1;
  }
  console.log("Counter check passed. " + (slugs.length - allowed.length) + " of " + slugs.length + " articles have a counter" +
    (allowed.length ? ", " + allowed.length + " allowed without one." : "."));
  return 0;
}

if (require.main === module) main(process.argv.slice(2), process.env).then(function (code) { process.exitCode = code; }); /* exitCode, not process.exit(): on Windows (Node 24) exiting with fetch sockets still closing trips a libuv assertion (0xC0000409) */
module.exports = { articleSlugs: articleSlugs, projectConfig: projectConfig, counterUrl: counterUrl, missingCounters: missingCounters, parseArgs: parseArgs, readCounterFields: readCounterFields, main: main };
