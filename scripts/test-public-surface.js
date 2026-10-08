#!/usr/bin/env node
/* Fail when a file Firebase Hosting would upload contains owner-tool copy,
   or analytics/tracking code, or when /owner-ui.js would be part of that upload.
   No dependencies. Also run by hosting predeploy. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const CHROME = [
  "isn't the owner",
  "isn\u2019t the owner",
  "Today's Tasks",
  "Today\u2019s Tasks",
  "Signed in, but",
  "Lm1lDi6wjRfPVbd6SfxfFZfa6RC3",
  "wantsAdmin",
  "#admin",
  "?admin",
  'has("admin")',
  "has('admin')"
];

/* Markup that lives only in the owner tools. A public file must not carry it. */
const OWNER_MARKUP = [
  "Portfolio data (not shown publicly)",
  "owner-banner",
  "paste it into"
];

/* The site is cookieless and runs no analytics (removed 8 Oct 2026).
   Any of these in an uploaded file stops the deploy. */
const ANALYTICS = [
  "googletagmanager",
  "gtag(",
  "google-analytics",
  "firebase-analytics",
  "getAnalytics("
];

const TEXT_EXT = {
  ".html": true,
  ".js": true,
  ".css": true,
  ".svg": true,
  ".txt": true,
  ".xml": true,
  ".json": true
};

function loadHosting() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  const hosting = cfg && cfg.hosting;
  if (!hosting || !Array.isArray(hosting.ignore) || !Array.isArray(hosting.rewrites)) {
    throw new Error("firebase.json hosting.ignore and hosting.rewrites are required");
  }
  return hosting;
}

/* Gitignore-style match for the patterns in firebase.json hosting.ignore.
   Checked against the `ignore` package for every file in this repo. */
function globBody(pattern) {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 3;
        continue;
      }
      out += ".*";
      i += 2;
      continue;
    }
    if (c === "*") { out += "[^/]*"; i++; continue; }
    if (c === "?") { out += "[^/]"; i++; continue; }
    if ("\\^$+()|{}[].".includes(c)) out += "\\" + c;
    else out += c;
    i++;
  }
  return out;
}

function ignoreMatch(pattern, rel) {
  let p = pattern;
  if (p.endsWith("/")) p = p.slice(0, -1);
  const hasSlash = p.includes("/");
  if (p.startsWith("/")) p = p.slice(1);
  const body = globBody(p);
  if (!hasSlash) return new RegExp("(?:^|/)" + body + "$").test(rel);
  return new RegExp("^" + body + "$").test(rel);
}

function isIgnored(rel, patterns) {
  return patterns.some(function (p) { return ignoreMatch(p, rel); });
}

function walk(dir, base, patterns, found) {
  const names = fs.readdirSync(dir);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name === ".git" || name === "node_modules") continue;
    const rel = base ? base + "/" + name : name;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (!isIgnored(rel, patterns)) walk(abs, rel, patterns, found);
      continue;
    }
    if (!st.isFile()) continue;
    if (isIgnored(rel, patterns)) continue;
    found.push(rel);
  }
}

function findHit(text, needles) {
  for (let i = 0; i < needles.length; i++) {
    const n = needles[i];
    const at = text.indexOf(n);
    if (at !== -1) return n;
  }
  return "";
}

function main() {
  const problems = [];
  const hosting = loadHosting();
  const patterns = hosting.ignore;

  if (patterns.indexOf("owner-ui.js") === -1) {
    problems.push('hosting ignore list does not contain "owner-ui.js"');
  }
  if (patterns.indexOf("scripts/**") === -1) {
    problems.push('hosting ignore list does not contain "scripts/**"');
  }

  const samples = {
    "owner-ui.js": true,
    "scripts/owner-ui.js": true,
    "dev/fixtures.js": true,
    "theme-preview.html": true,
    "firestore.rules": true,
    "DEPLOY.md": true,
    ".firebaserc": true,
    ".git/config": true,
    "firebase.json": true,
    "index.html": false,
    "writing/kenya-remittances-2026.html": false,
    "robots.txt": false,
    "sitemap.xml": false,
    "favicon.svg": false,
    "config.js": false,
    "counter.js": false
  };
  Object.keys(samples).forEach(function (rel) {
    const got = isIgnored(rel, patterns);
    if (got !== samples[rel]) {
      problems.push("ignore matcher: " + rel + " expected " + (samples[rel] ? "ignored" : "uploaded") + " but was " + (got ? "ignored" : "uploaded"));
    }
  });

  const rewrite = hosting.rewrites.find(function (r) { return r && r.destination === "/index.html"; });
  if (!rewrite || rewrite.source !== "!/**/owner-ui.js") {
    problems.push('hosting rewrites must send every path except **/owner-ui.js to /index.html so /owner-ui.js 404s');
  }
  const catchAll = hosting.rewrites.find(function (r) { return r && (r.source === "**" || r.source === "/**"); });
  if (catchAll) {
    problems.push("a catch-all rewrite would serve index.html for /owner-ui.js instead of 404");
  }

  if (fs.existsSync(path.join(root, "owner-ui.js"))) {
    problems.push("owner-ui.js is still in the hosting root; move it under scripts/ so the upload cannot include it");
  }

  const ownerPath = path.join(root, "scripts", "owner-ui.js");
  if (!fs.existsSync(ownerPath)) {
    problems.push("scripts/owner-ui.js is missing");
  } else {
    const owner = fs.readFileSync(ownerPath, "utf8");
    const hit = findHit(owner, CHROME);
    if (hit) problems.push("scripts/owner-ui.js contains " + JSON.stringify(hit));
    if (owner.indexOf("window.OwnerUI") === -1) problems.push("scripts/owner-ui.js does not install window.OwnerUI");
  }

  const uploaded = [];
  walk(root, "", patterns, uploaded);
  uploaded.forEach(function (rel) {
    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_EXT[ext]) return;
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const hit = findHit(text, CHROME.concat(OWNER_MARKUP));
    if (hit) problems.push(rel + " contains " + JSON.stringify(hit));
    const tracker = findHit(text, ANALYTICS);
    if (tracker) problems.push(rel + " contains analytics code " + JSON.stringify(tracker) + " (the site is cookieless; remove it)");
  });

  if (problems.length) {
    console.error("Public surface check failed.");
    problems.forEach(function (line) { console.error("  - " + line); });
    process.exit(1);
  }
  console.log("Public surface check passed. " + uploaded.length + " uploaded files scanned.");
}

main();
