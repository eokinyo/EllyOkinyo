#!/usr/bin/env node
/* Check that an article page's visible text matches its approved review PDF.

     node scripts/check-article-text.js writing/<slug>.html <review.pdf> [--allow-extra "text"]...

   Needs pdftotext (poppler-utils). No network, no packages.

   - Page side: the text inside <article>, tags removed, entities decoded.
     Image alt text is not visible, so it is not compared.
   - PDF side: `pdftotext -layout`, without the review banner line
     ("Review copy for approval ...") and without lone page-number lines;
     list bullets (•) are dropped.
   - Both sides: whitespace collapsed to single spaces, then a word diff.

   Every difference is printed. Each one is tagged:
     line wrap      the words are equal once spaces are removed (the PDF broke
                    a URL or word across lines)
     same character U+2011 non-breaking hyphen in the PDF against "-" on the page
     allowed extra  page text passed with --allow-extra (site template text,
                    such as the byline), printed so it is not hidden
     TEXT DIFF      anything else; the script exits 1
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const allow = [];
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--allow-extra") allow.push(norm(args[++i] || ""));
  else pos.push(args[i]);
}
if (pos.length !== 2) {
  console.error('Usage: node scripts/check-article-text.js <page.html> <review.pdf> [--allow-extra "text"]');
  process.exit(2);
}

function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (m, c) {
    const k = c.toLowerCase();
    if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[k];
  });
}

function pageText(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!m) throw new Error("no <article> element in " + file);
  const body = m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/figcaption|\/ul|\/figure)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return norm(decode(body));
}

function pdfText(file) {
  const raw = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", file, "-"], { encoding: "utf8" });
  const lines = raw.replace(/\f/g, "\n").split("\n").filter(function (l) {
    const t = l.trim();
    if (/^Review copy for approval\b/.test(t)) return false;
    if (/^\d{1,3}$/.test(t)) return false;
    return true;
  });
  return norm(lines.join("\n").replace(/^\s*•\s*/gm, " "));
}

function diff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, function () { return new Uint32Array(m + 1); });
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hunks = [];
  let i = 0, j = 0, cur = null;
  function flush() { if (cur) { hunks.push(cur); cur = null; } }
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
    if (!cur) cur = { at: i, pdf: [], page: [] };
    if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) cur.page.push(b[j++]);
    else cur.pdf.push(a[i++]);
  }
  flush();
  return hunks;
}

const pdf = pdfText(pos[1]);
const page = pageText(pos[0]);
const A = pdf.split(" "), B = page.split(" ");
const hunks = diff(A, B);
let bad = 0;
console.log("PDF words: " + A.length + ", page words: " + B.length + ", differences: " + hunks.length);
hunks.forEach(function (h, k) {
  const p = h.pdf.join(" "), q = h.page.join(" ");
  let tag;
  if (p.replace(/ /g, "") === q.replace(/ /g, "")) tag = "line wrap";
  else if (p.replace(/\u2011/g, "-").replace(/ /g, "") === q.replace(/ /g, "")) tag = "same character";
  else if (!p && allow.indexOf(norm(q)) >= 0) tag = "allowed extra";
  else { tag = "TEXT DIFF"; bad++; }
  const ctx = A.slice(Math.max(0, h.at - 4), h.at).join(" ");
  console.log((k + 1) + ". [" + tag + "] after \"" + ctx + "\"");
  console.log("   PDF:  " + JSON.stringify(p));
  console.log("   page: " + JSON.stringify(q));
});
if (bad) { console.log("FAIL: " + bad + " text difference(s)."); process.exit(1); }
console.log("PASS: visible text matches the PDF text (differences above are line wraps, the same character, or allowed extras).");
