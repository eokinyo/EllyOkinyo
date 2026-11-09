#!/usr/bin/env node
/* Tests for the Writing list (team-ops #99). No network, no packages.

     node scripts/test-writing-index.js

   - Every writing/*.html is in the committed writing/index.json with the
     fields from its meta tags, and the file is up to date.
   - build-writing-index.js --check fails on a temporary copy with a page
     that is not in the manifest, with a page missing from sitemap.xml, with
     a stale manifest, and with a page that lacks a meta tag.
   - mergeWriting: dedupe by slug, staticOnly set, sorted newest first,
     same-site /writing/ urls only, stored posts not changed.
   - index.html has the inlined merge, identical to scripts/writing-merge.js,
     and firebase.json runs the build and the check before the other steps.
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const idx = require("./build-writing-index.js");
const { mergeWriting, writingPagePath } = require("./writing-merge.js");

const root = path.resolve(__dirname, "..");
const script = path.join(__dirname, "build-writing-index.js");
let failed = 0;
function check(name, cond) { if (cond) console.log("ok  " + name); else { failed++; console.log("FAIL " + name); } }

function run(args) {
  try { const out = execFileSync(process.execPath, [script].concat(args), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return { code: 0, out: out }; }
  catch (e) { return { code: e.status, out: String(e.stdout || "") + String(e.stderr || "") }; }
}

/* 1. The committed manifest covers every page. */
const pages = fs.readdirSync(path.join(root, "writing")).filter(function (f) { return /\.html$/.test(f); });
const manifest = JSON.parse(fs.readFileSync(path.join(root, "writing", "index.json"), "utf8"));
check("writing/index.json is an array", Array.isArray(manifest));
check("manifest has one entry per page (" + pages.length + ")", manifest.length === pages.length);
pages.forEach(function (f) {
  const slug = f.replace(/\.html$/, "");
  const e = manifest.find(function (x) { return x.slug === slug; });
  const r = idx.readPage(path.join(root, "writing", f));
  check(slug + " is in the manifest", !!e);
  check(slug + " has the fields from its meta tags", !!e && !r.error &&
    JSON.stringify(Object.keys(e)) === JSON.stringify(["slug", "title", "date", "category", "description", "url"]) &&
    JSON.stringify(e) === JSON.stringify(r.entry));
  check(slug + " title has no HTML entities", !!e && !/&(#x?[0-9a-f]+|amp|quot|lt|gt);/i.test(e.title + e.description));
});
check("manifest is sorted newest first", manifest.every(function (e, i) { return i === 0 || manifest[i - 1].date >= e.date; }));
check("committed manifest equals a fresh build", fs.readFileSync(path.join(root, "writing", "index.json"), "utf8") === idx.serialise(idx.buildIndex(root).entries));
check("--check passes on the repo", run(["--check"]).code === 0);

/* 2. --check on temporary copies. */
function tempCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writing-index-test-"));
  fs.mkdirSync(path.join(dir, "writing"));
  pages.forEach(function (f) { fs.copyFileSync(path.join(root, "writing", f), path.join(dir, "writing", f)); });
  fs.copyFileSync(path.join(root, "writing", "index.json"), path.join(dir, "writing", "index.json"));
  fs.copyFileSync(path.join(root, "sitemap.xml"), path.join(dir, "sitemap.xml"));
  return dir;
}
const temps = [];
function newPage(dir, slug, opts) {
  let html = fs.readFileSync(path.join(root, "writing", pages[0]), "utf8");
  const old = pages[0].replace(/\.html$/, "");
  html = html.split(old).join(slug);
  if (opts && opts.dropDescription) html = html.replace(/<meta name="description"[^>]*>/, "");
  fs.writeFileSync(path.join(dir, "writing", slug + ".html"), html);
}
function addToSitemap(dir, slug) {
  const p = path.join(dir, "sitemap.xml");
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("</urlset>",
    "  <url>\n    <loc>https://ellyokinyo.com/writing/" + slug + ".html</loc>\n  </url>\n</urlset>"));
}

let d = tempCopy(); temps.push(d);
check("--check passes on an unchanged copy", run(["--check", "--root", d]).code === 0);

d = tempCopy(); temps.push(d);
newPage(d, "extra-test-page"); addToSitemap(d, "extra-test-page");
let r = run(["--check", "--root", d]);
check("--check fails on a page that is not in the manifest", r.code === 1 && /extra-test-page\.html is not in writing\/index\.json/.test(r.out));
check("build then --check passes again", run(["--root", d]).code === 0 && run(["--check", "--root", d]).code === 0);

d = tempCopy(); temps.push(d);
newPage(d, "no-sitemap-page");
run(["--root", d]);
r = run(["--check", "--root", d]);
check("--check fails on a page missing from sitemap.xml", r.code === 1 && /no-sitemap-page\.html is not in sitemap\.xml/.test(r.out));

d = tempCopy(); temps.push(d);
const mp = path.join(d, "writing", "index.json");
const stale = JSON.parse(fs.readFileSync(mp, "utf8")); stale[0].title = "Changed title"; fs.writeFileSync(mp, JSON.stringify(stale, null, 2) + "\n");
r = run(["--check", "--root", d]);
check("--check fails on a stale manifest", r.code === 1 && /stale/.test(r.out));

d = tempCopy(); temps.push(d);
fs.unlinkSync(path.join(d, "writing", "index.json"));
r = run(["--check", "--root", d]);
check("--check fails when writing/index.json is missing", r.code === 1 && /missing/.test(r.out));

d = tempCopy(); temps.push(d);
newPage(d, "bad-meta-page", { dropDescription: true }); addToSitemap(d, "bad-meta-page");
r = run(["--root", d]);
check("build fails and names the page that lacks a meta tag", r.code === 1 && /bad-meta-page\.html: missing meta description/.test(r.out));
check("failed build leaves writing/index.json unchanged", fs.readFileSync(path.join(d, "writing", "index.json"), "utf8") === fs.readFileSync(path.join(root, "writing", "index.json"), "utf8"));

d = tempCopy(); temps.push(d);
newPage(d, "bad-date-page"); addToSitemap(d, "bad-date-page");
const bp = path.join(d, "writing", "bad-date-page.html");
fs.writeFileSync(bp, fs.readFileSync(bp, "utf8").replace(/(article:published_time" content=")[^"]*/, "$12026-13-01").replace(/(article:section" content=")[^"]*/, "$1Economics"));
r = run(["--root", d]);
check("build fails on a bad date", r.code === 1 && /bad-date-page\.html: bad article:published_time/.test(r.out));
fs.writeFileSync(bp, fs.readFileSync(bp, "utf8").replace("2026-13-01", "2026-11-01").replace(/(article:section" content=")[^"]*/, "$1Sport"));
r = run(["--root", d]);
check("build fails on a bad category", r.code === 1 && /bad-date-page\.html: bad article:section/.test(r.out));

temps.forEach(function (t) { fs.rmSync(t, { recursive: true, force: true }); });

/* 3. mergeWriting. */
const fsPosts = [
  { id: 1, slug: "a", title: "A", date: "2026-10-01", category: "economics", body: "Firestore body A" },
  { id: 2, slug: "b", title: "B", date: "2026-10-20", category: "notes", body: "Firestore body B", url: "https://ellyokinyo.com/#post/b" }
];
const before = JSON.stringify(fsPosts);
const man = [
  { slug: "a", title: "A page", date: "2026-10-01", category: "economics", description: "Desc A", url: "https://ellyokinyo.com/writing/a.html" },
  { slug: "b", title: "B page", date: "2026-10-20", category: "notes", description: "Desc B", url: "https://ellyokinyo.com/writing/b.html" },
  { slug: "c", title: "C", date: "2026-11-10", category: "economics", description: "Desc C", url: "https://ellyokinyo.com/writing/c.html" },
  { slug: "evil", title: "X", date: "2026-12-01", category: "economics", description: "x", url: "https://example.com/writing/evil.html" },
  { slug: "x');alert(1);//", title: "X", date: "2026-12-01", category: "economics", description: "x", url: "https://ellyokinyo.com/writing/x.html" },
  { slug: "d", title: "D", date: "2026-12-01", category: "economics", description: "x", url: "https://ellyokinyo.com/writing/other.html" }
];
const merged = mergeWriting(fsPosts, man);
check("merge dedupes by slug", JSON.stringify(merged.map(function (p) { return p.slug; })) === JSON.stringify(["c", "b", "a"]));
check("merge sorts newest first", merged[0].date === "2026-11-10" && merged[2].date === "2026-10-01");
const c = merged[0];
check("manifest only entry is staticOnly with description as body", c.staticOnly === true && c.body === "Desc C" && c.url === "https://ellyokinyo.com/writing/c.html" && c.title === "C" && c.category === "economics");
const a = merged.find(function (p) { return p.slug === "a"; });
check("Firestore post keeps its body and title, gains url", a.body === "Firestore body A" && a.title === "A" && a.url === "https://ellyokinyo.com/writing/a.html" && !a.staticOnly);
const b = merged.find(function (p) { return p.slug === "b"; });
check("Firestore post keeps an existing url", b.url === "https://ellyokinyo.com/#post/b" && !b.staticOnly);
check("merge drops other sites, bad slugs and url/slug mismatches", !merged.some(function (p) { return p.slug === "evil" || p.slug === "d" || /alert/.test(p.slug); }));
check("merge does not change the stored Firestore posts", JSON.stringify(fsPosts) === before);
check("merge tolerates a missing manifest", mergeWriting(fsPosts, null).length === 2 && mergeWriting(null, man).length === 3);
check("writingPagePath accepts same-site /writing/ pages only",
  writingPagePath("https://ellyokinyo.com/writing/c.html") === "/writing/c.html" &&
  writingPagePath("https://www.ellyokinyo.com/writing/c.html") === "/writing/c.html" &&
  writingPagePath("/writing/c.html") === "/writing/c.html" &&
  writingPagePath("https://evil.com/writing/c.html") === "" &&
  writingPagePath("javascript:alert(1)") === "" &&
  writingPagePath("//evil.com/writing/c.html") === "" &&
  writingPagePath("/writing/../index.html") === "");
const live = mergeWriting([], manifest);
check("the real manifest merges to all " + manifest.length + " pages, all staticOnly", live.length === manifest.length && live.every(function (p) { return p.staticOnly; }));

/* 4. index.html and firebase.json wiring. */
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const s = html.indexOf("/* writing-merge:start */"), e = html.indexOf("/* writing-merge:end */");
check("index.html has the inlined merge", s !== -1 && e > s);
if (s !== -1 && e > s) {
  const inline = html.slice(s + "/* writing-merge:start */".length, e).trim();
  const fromFile = fs.readFileSync(path.join(__dirname, "writing-merge.js"), "utf8").trim()
    .replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/\nif \(typeof module[\s\S]*$/, "").trim();
  check("inlined merge matches scripts/writing-merge.js", inline === fromFile);
}
check("index.html fetches /writing/index.json with no-cache", /fetch\("\/writing\/index\.json", \{cache:"no-cache"\}\)/.test(html));
check("grid and Latest writing use the merged list", (html.match(/writingPosts\(\)/g) || []).length >= 4 && !/blog\.slice\(\)\.sort/.test(html));
const fb = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
const pre = fb.hosting.predeploy;
check("predeploy builds and then checks the Writing list first",
  pre[0] === "node scripts/build-writing-index.js" && pre[1] === "node scripts/build-writing-index.js --check");
check("writing/index.json is not in hosting.ignore", !fb.hosting.ignore.some(function (g) { return g === "writing/**" || g === "writing/index.json" || g === "**/*.json"; }));

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("All Writing list tests passed.");
