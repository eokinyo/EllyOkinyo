#!/usr/bin/env node
/* Tests for read counter fields (team-ops #99). No network beyond 127.0.0.1, no packages.

     node scripts/test-counters.js

   - Owner UI (scripts/owner-ui.js, run in a sandbox with a fake Firestore):
     missing fields are created at 0, an existing count is never reset or
     written, a missing counters/site doc is created, nothing is written when
     nothing is missing, and reserved or bad slugs are skipped.
   - scripts/check-counters.js against a local HTTP server: a missing counter
     fails, --allow-missing-counter and ALLOW_MISSING_COUNTER allow it, a 404
     doc fails, and an unreachable server warns and exits 0 (exit 1 with
     --require-network) with a clear message.
   - counter.js display thresholds: 20 reads per article, 100 for the site.
   - firebase.json runs the check in predeploy.
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const path = require("path");
const http = require("http");
const vm = require("vm");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
let failed = 0;
function check(name, cond) { if (cond) console.log("ok  " + name); else { failed++; console.log("FAIL " + name); } }

/* ---- fake Firestore (compat-style) ---- */
function FieldPath(name) { this.name = name; }
const Timestamp = { fromMillis: function (ms) { return { ts: ms }; } };
function fakeDb(initial) {
  const state = { data: initial === undefined ? null : JSON.parse(JSON.stringify(initial)), writes: [] };
  const ref = { path: "counters/site" };
  state.db = {
    collection: function (c) { return { doc: function (d) { if (c + "/" + d !== "counters/site") throw new Error("wrong doc " + c + "/" + d); return ref; } }; },
    runTransaction: async function (fn) {
      const tx = {
        get: async function () { return { exists: state.data !== null, data: function () { return JSON.parse(JSON.stringify(state.data)); } }; },
        set: function (r, v) { state.writes.push(["set", v]); state.data = JSON.parse(JSON.stringify(v)); },
        update: function (r) {
          const args = Array.prototype.slice.call(arguments, 1), upd = {};
          for (let i = 0; i < args.length; i += 2) {
            if (!(args[i] instanceof FieldPath)) throw new Error("update must use FieldPath");
            upd[args[i].name] = args[i + 1];
          }
          state.writes.push(["update", upd]);
          Object.assign(state.data, upd);
        }
      };
      return fn(tx);
    }
  };
  return state;
}

/* ---- load owner-ui.js in a sandbox ---- */
const sandbox = { window: {}, console: { info: function () {}, warn: function () {}, log: function () {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "owner-ui.js"), "utf8"), sandbox, { filename: "owner-ui.js" });
const O = sandbox.OwnerUI;
const fsApi = { FieldPath: FieldPath, Timestamp: Timestamp };

(async function () {
  check("owner-ui.js exposes ensureCounterFields and counterFieldPlan", O && typeof O.ensureCounterFields === "function" && typeof O.counterFieldPlan === "function");

  let s = fakeDb({ total: 34, lastWrite: { ts: 5 }, "kenya-remittances-2026": 0, "global-public-debt-2026": 14 });
  let r = await O.ensureCounterFields(s.db, fsApi, ["global-public-debt-2026", "food-after-oil-2026", "kenya-remittances-2026"]);
  check("missing field is created at 0", s.data["food-after-oil-2026"] === 0 && JSON.stringify(r.added) === '["food-after-oil-2026"]' && r.created === false);
  check("existing count is not reset (14 stays 14, 0 stays 0, total 34)", s.data["global-public-debt-2026"] === 14 && s.data["kenya-remittances-2026"] === 0 && s.data.total === 34);
  check("only the missing field is written", s.writes.length === 1 && JSON.stringify(Object.keys(s.writes[0][1])) === '["food-after-oil-2026"]');

  s = fakeDb({ total: 34, "global-public-debt-2026": 14, "food-after-oil-2026": 7 });
  r = await O.ensureCounterFields(s.db, fsApi, ["global-public-debt-2026", "food-after-oil-2026"]);
  check("nothing is written when every slug has a counter", s.writes.length === 0 && r.added.length === 0 && s.data["food-after-oil-2026"] === 7);

  s = fakeDb({ total: 9, "a-slug": 3 });
  r = await O.ensureCounterFields(s.db, fsApi, ["total", "lastWrite", "bad slug", "x');alert(1)//", "a-slug", "new-one", "new-one"]);
  check("reserved, bad and duplicate slugs are skipped", JSON.stringify(r.added) === '["new-one"]' && s.data.total === 9 && s.data["a-slug"] === 3 && !("lastWrite" in s.data));

  s = fakeDb(null);
  r = await O.ensureCounterFields(s.db, fsApi, ["a", "b"]);
  check("a missing counters/site doc is created with total 0 and the slugs at 0", r.created === true && s.data.total === 0 && s.data.a === 0 && s.data.b === 0 && s.data.lastWrite.ts === 0);

  const plan = O.counterFieldPlan({ a: 5, total: 1 }, ["a", "b"]);
  check("counterFieldPlan never lists an existing field", plan.create === false && JSON.stringify(plan.add) === '["b"]');

  const src = fs.readFileSync(path.join(__dirname, "owner-ui.js"), "utf8");
  check("owner-ui.js runs the counter step only for the owner", /if\(isOwner && !countersEnsured/.test(src));

  /* ---- check-counters.js against a local server ---- */
  let body = JSON.stringify({ fields: {} }), status = 200;
  const server = http.createServer(function (req, res) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(body); });
  await new Promise(function (ok) { server.listen(0, "127.0.0.1", ok); });
  const url = "http://127.0.0.1:" + server.address().port + "/counters/site";
  function run(args, env) {
    return new Promise(function (ok) {
      execFile(process.execPath, [path.join(__dirname, "check-counters.js")].concat(args),
        { env: Object.assign({}, process.env, { ALLOW_MISSING_COUNTER: "" }, env || {}), encoding: "utf8" },
        function (err, out, errOut) { ok({ code: err ? err.code : 0, out: out + errOut }); });
    });
  }
  const slugs = fs.readdirSync(path.join(root, "writing")).filter(function (f) { return /\.html$/.test(f); }).map(function (f) { return f.replace(/\.html$/, ""); });
  const all = {}; slugs.forEach(function (sl) { all[sl] = { integerValue: "1" }; }); all.total = { integerValue: "6" };
  const some = Object.assign({}, all); delete some["food-after-oil-2026"];

  body = JSON.stringify({ fields: all });
  let x = await run(["--url", url]);
  check("check passes when every article has a counter", x.code === 0 && /Counter check passed\. 6 of 6/.test(x.out));

  body = JSON.stringify({ fields: some });
  x = await run(["--url", url]);
  check("missing counter fails and names the slug", x.code === 1 && /food-after-oil-2026/.test(x.out) && /Counter check failed/.test(x.out));
  x = await run(["--url", url, "--allow-missing-counter", "food-after-oil-2026"]);
  check("--allow-missing-counter allows it, visibly", x.code === 0 && /ALLOWED: food-after-oil-2026/.test(x.out));
  x = await run(["--url", url], { ALLOW_MISSING_COUNTER: "food-after-oil-2026" });
  check("ALLOW_MISSING_COUNTER env allows it (for predeploy)", x.code === 0 && /ALLOWED: food-after-oil-2026/.test(x.out));
  x = await run(["--url", url, "--allow-missing-counter", "kenya-remittances-2026"]);
  check("allowing a different slug still fails", x.code === 1 && /food-after-oil-2026/.test(x.out));
  x = await run(["--url", url, "--allow-missing-counter", "no-such-page"]);
  check("allowing a slug with no page fails", x.code === 1 && /names no writing/.test(x.out));

  status = 404; body = JSON.stringify({ error: { code: 404 } });
  x = await run(["--url", url]);
  check("a missing counters/site doc fails for every article", x.code === 1 && /does not exist yet/.test(x.out) && slugs.every(function (sl) { return x.out.indexOf(sl) !== -1; }));

  status = 503; body = "{}";
  x = await run(["--url", url]);
  check("an HTTP error warns and does not fail", x.code === 0 && /WARNING: could not read counters\/site \(HTTP 503\)/.test(x.out));

  await new Promise(function (ok) { server.close(ok); });
  x = await run(["--url", url, "--timeout-ms", "3000"]);
  check("unreachable network warns clearly and exits 0", x.code === 0 && /WARNING: could not read counters\/site \(network error: ECONNREFUSED\)\. Read counters were NOT checked/.test(x.out));
  x = await run(["--url", url, "--timeout-ms", "3000", "--require-network"]);
  check("unreachable network fails with --require-network", x.code === 1 && /Counter check failed: could not read counters\/site \(network error: ECONNREFUSED\)/.test(x.out));

  /* ---- display thresholds (counter.js) ---- */
  const cs = { window: {}, document: { currentScript: null }, console: sandbox.console };
  cs.window = cs; vm.createContext(cs);
  vm.runInContext(fs.readFileSync(path.join(root, "counter.js"), "utf8"), cs, { filename: "counter.js" });
  const E = cs.EOCounter;
  check("thresholds are 20 per article and 100 for the site", E.ARTICLE_MIN === 20 && E.SITE_MIN === 100);
  check("article label hidden at 19, shown at 20", E.articleLabel({ articles: { a: 19 } }, "a") === "" && E.articleLabel({ articles: { a: 20 } }, "a") === "20 reads");
  check("site label hidden at 99, shown at 100", E.siteLabel({ total: 99 }) === "" && E.siteLabel({ total: 100 }) === "100 reads across the site");

  /* ---- wiring ---- */
  const C = require("./check-counters.js");
  check("URL is the public REST doc, key only if present",
    C.counterUrl({ projectId: "p", apiKey: "" }) === "https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/counters/site" &&
    /\?key=k$/.test(C.counterUrl({ projectId: "p", apiKey: "k" })));
  check("project id falls back to .firebaserc", (C.projectConfig(root) || {}).projectId === JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8")).projects.default || fs.existsSync(path.join(root, "config.js")));
  const pre = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).hosting.predeploy;
  check("predeploy runs check-counters.js after the Writing list check", pre.indexOf("node scripts/check-counters.js") === pre.indexOf("node scripts/build-writing-index.js --check") + 1);

  if (failed) { console.error(failed + " failed"); process.exit(1); }
  console.log("All counter tests passed.");
})();
