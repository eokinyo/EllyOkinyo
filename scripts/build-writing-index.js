#!/usr/bin/env node
/* Build writing/index.json, the Writing list, from the article pages.

     node scripts/build-writing-index.js            write writing/index.json
     node scripts/build-writing-index.js --check    write nothing; exit 1 if
                                                    writing/index.json is
                                                    missing or stale, or a page
                                                    is missing from it or from
                                                    sitemap.xml
     --root <dir>                                   use another folder (tests)

   writing/*.html is the source of truth. Each page must carry these meta tags:
     og:title                -> title
     article:published_time  -> date (YYYY-MM-DD)
     article:section         -> category, lowercased: "economics" or "notes"
     description             -> description
     og:url                  -> url, https://ellyokinyo.com/writing/<slug>.html
   The slug is the file name without .html. Entries are sorted by date,
   newest first (then by slug).

   No dependencies, no network. Hosting predeploy runs the build, then --check.
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const path = require("path");

const SITE = "https://ellyokinyo.com";
const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const FIELDS = [
  ["title", "property", "og:title"],
  ["date", "property", "article:published_time"],
  ["category", "property", "article:section"],
  ["description", "name", "description"],
  ["url", "property", "og:url"]
];

function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (m, c) {
    const k = c.toLowerCase();
    if (k[0] === "#") {
      const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" }[k];
  });
}

/* Map "property:og:title" / "name:description" -> content, from <meta> tags. */
function readMeta(html) {
  const out = {};
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  tags.forEach(function (tag) {
    const attrs = {};
    tag.replace(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, function (m, k, v, d, s) {
      attrs[k.toLowerCase()] = d !== undefined ? d : s;
      return m;
    });
    if (attrs.content === undefined) return;
    ["property", "name"].forEach(function (kind) {
      if (attrs[kind] !== undefined) {
        const key = kind + ":" + attrs[kind];
        if (!(key in out)) out[key] = decodeEntities(attrs.content).trim();
      }
    });
  });
  return out;
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

/* Read one page. Returns {entry} or {error}. */
function readPage(file) {
  const name = path.basename(file);
  const slug = name.replace(/\.html$/, "");
  if (!SLUG_RE.test(slug)) return { error: name + ": file name must be <slug>.html with letters, digits, - or _" };
  const meta = readMeta(fs.readFileSync(file, "utf8"));
  const entry = { slug: slug };
  const missing = [];
  FIELDS.forEach(function (f) {
    const v = meta[f[1] + ":" + f[2]];
    if (!v) missing.push(f[2]); else entry[f[0]] = v;
  });
  if (missing.length) return { error: name + ": missing meta " + missing.join(", ") };
  if (!validDate(entry.date)) return { error: name + ": bad article:published_time \"" + entry.date + "\" (need YYYY-MM-DD)" };
  entry.category = entry.category.toLowerCase();
  if (entry.category !== "economics" && entry.category !== "notes") {
    return { error: name + ": bad article:section \"" + meta["property:article:section"] + "\" (need Economics or Notes)" };
  }
  const want = SITE + "/writing/" + slug + ".html";
  if (entry.url !== want) return { error: name + ": og:url is \"" + entry.url + "\", expected " + want };
  return {
    entry: { slug: entry.slug, title: entry.title, date: entry.date, category: entry.category, description: entry.description, url: entry.url }
  };
}

function pageFiles(root) {
  const dir = path.join(root, "writing");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return /\.html$/.test(f); }).sort()
    .map(function (f) { return path.join(dir, f); });
}

function buildIndex(root) {
  const entries = [], errors = [];
  pageFiles(root).forEach(function (f) {
    const r = readPage(f);
    if (r.error) errors.push(r.error); else entries.push(r.entry);
  });
  entries.sort(function (a, b) { return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug); });
  return { entries: entries, errors: errors };
}

function serialise(entries) { return JSON.stringify(entries, null, 2) + "\n"; }

function checkIndex(root) {
  const built = buildIndex(root);
  const problems = built.errors.slice();
  const file = path.join(root, "writing", "index.json");
  let current = null, text = null;
  if (!fs.existsSync(file)) problems.push("writing/index.json is missing. Run: node scripts/build-writing-index.js");
  else {
    text = fs.readFileSync(file, "utf8");
    try { current = JSON.parse(text); } catch (e) { problems.push("writing/index.json is not valid JSON: " + e.message); }
    if (current !== null && !Array.isArray(current)) { problems.push("writing/index.json is not an array"); current = null; }
  }
  if (current) {
    const listed = new Set(current.map(function (e) { return e && e.slug; }));
    pageFiles(root).forEach(function (f) {
      const slug = path.basename(f, ".html");
      if (!listed.has(slug)) problems.push("writing/" + slug + ".html is not in writing/index.json");
    });
    if (!built.errors.length && text !== serialise(built.entries)) {
      problems.push("writing/index.json is stale (it differs from the pages). Run: node scripts/build-writing-index.js");
    }
  }
  const sm = path.join(root, "sitemap.xml");
  const sitemap = fs.existsSync(sm) ? fs.readFileSync(sm, "utf8") : "";
  if (!sitemap) problems.push("sitemap.xml is missing");
  pageFiles(root).forEach(function (f) {
    const slug = path.basename(f, ".html");
    if (sitemap && sitemap.indexOf("<loc>" + SITE + "/writing/" + slug + ".html</loc>") === -1) {
      problems.push("writing/" + slug + ".html is not in sitemap.xml");
    }
  });
  return { problems: problems, count: built.entries.length };
}

function main(argv) {
  const check = argv.includes("--check");
  const ri = argv.indexOf("--root");
  const root = ri >= 0 ? path.resolve(argv[ri + 1] || "") : path.resolve(__dirname, "..");
  if (check) {
    const r = checkIndex(root);
    if (r.problems.length) {
      console.error("Writing list check failed:");
      r.problems.forEach(function (p) { console.error("  - " + p); });
      return 1;
    }
    console.log("Writing list check passed. " + r.count + " articles in writing/index.json and sitemap.xml.");
    return 0;
  }
  const b = buildIndex(root);
  if (b.errors.length) {
    console.error("Cannot build writing/index.json:");
    b.errors.forEach(function (p) { console.error("  - " + p); });
    return 1;
  }
  fs.writeFileSync(path.join(root, "writing", "index.json"), serialise(b.entries));
  console.log("Wrote writing/index.json with " + b.entries.length + " articles.");
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { readMeta: readMeta, readPage: readPage, buildIndex: buildIndex, checkIndex: checkIndex, serialise: serialise, main: main };
