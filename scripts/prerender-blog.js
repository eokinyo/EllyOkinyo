#!/usr/bin/env node
/* Pre-render public blog posts to blog/<slug>.html so link previews and
   crawlers can read them without running the app.

   Firebase Hosting serves a real file before the rewrite to index.html.

   Usage (from the repo root):
     node scripts/prerender-blog.js

   Reads config.js (gitignored) and fetches Firestore document public/blog.
   Read-only: this script never writes to Firestore.

   With no config.js it exits without changing files. Pass --fixtures only
   together with --out <dir> (it will not write sample posts into blog/).

     node scripts/prerender-blog.js --self-test
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const blogDir = path.join(root, "blog");
const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const useFixtures = args.includes("--fixtures");
const outFlag = args.indexOf("--out");
const outDir = outFlag >= 0 ? path.resolve(args[outFlag + 1] || "") : blogDir;

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}

function safeUrl(u) {
  const s = String(u || "").trim();
  if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return s;
  return "";
}

function markdownToHtml(md) {
  const lines = escapeHtml(md).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let list = null;
  function closeList() {
    if (list) { html.push("</" + list + ">"); list = null; }
  }
  function inline(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
        const href = safeUrl(url);
        if (!href) return escapeHtml(alt);
        return '<img src="' + escapeHtml(href) + '" alt="' + alt + '">';
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, url) {
        const href = safeUrl(url);
        if (!href) return text;
        return '<a href="' + escapeHtml(href) + '">' + text + "</a>";
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(t))) {
      closeList();
      const level = m[1].length;
      html.push("<h" + level + ">" + inline(m[2]) + "</h" + level + ">");
      continue;
    }
    if ((m = /^[-*]\s+(.*)$/.exec(t))) {
      if (list !== "ul") { closeList(); list = "ul"; html.push("<ul>"); }
      html.push("<li>" + inline(m[1]) + "</li>");
      continue;
    }
    if ((m = /^\d+\.\s+(.*)$/.exec(t))) {
      if (list !== "ol") { closeList(); list = "ol"; html.push("<ol>"); }
      html.push("<li>" + inline(m[1]) + "</li>");
      continue;
    }
    if (/^>\s?/.test(t)) {
      closeList();
      html.push("<blockquote><p>" + inline(t.replace(/^>\s?/, "")) + "</p></blockquote>");
      continue;
    }
    closeList();
    html.push("<p>" + inline(t) + "</p>");
  }
  closeList();
  return html.join("\n");
}

function excerpt(md) {
  const t = String(md || "").replace(/[#*_`>\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 180 ? t.slice(0, 180) + "…" : t;
}

function categoryLabel(p) {
  return p && p.category === "notes" ? "Notes from Helsinki" : "Economics";
}

function pageHtml(post) {
  const slug = String(post.slug);
  const url = "https://ellyokinyo.com/blog/" + encodeURIComponent(slug);
  const title = String(post.title || "Note");
  const desc = excerpt(post.body);
  const fullTitle = title + " — Elly Okinyo";
  const json = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    datePublished: post.date || undefined,
    author: { "@type": "Person", name: "Elly Okinyo", url: "https://ellyokinyo.com/" },
    mainEntityOfPage: url,
    description: desc,
    articleSection: categoryLabel(post)
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://ellyokinyo.com/elly.jpg">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="https://ellyokinyo.com/elly.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&amp;family=Source+Serif+4:opsz,wght@8..60,600&amp;display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(json)}</script>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f3f0e8; color: #1a1814; font-family: "Source Sans 3", "Segoe UI", sans-serif; font-size: 18px; line-height: 1.65; }
  header, main, footer { max-width: 42rem; margin: 0 auto; padding: 1.25rem; }
  header { padding-bottom: 0; }
  a { color: #1a365d; }
  .name { font-family: "Source Serif 4", Georgia, serif; font-size: 1.25rem; font-weight: 600; color: #1a1814; text-decoration: none; }
  .kicker { color: #3f3a34; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
  h1 { font-family: "Source Serif 4", Georgia, serif; font-weight: 600; font-size: clamp(1.8rem, 4vw, 2.4rem); line-height: 1.2; letter-spacing: -0.02em; margin: 0.35rem 0 1rem; }
  .prose { font-family: "Source Serif 4", Georgia, serif; font-size: 1.15rem; }
  .prose p { margin: 0.85em 0; }
  footer { color: #3f3a34; font-size: 0.95rem; border-top: 1px solid #e0d8cc; }
</style>
</head>
<body>
<header>
  <a class="name" href="https://ellyokinyo.com/">Elly Okinyo</a>
</header>
<main>
  <p class="kicker">${escapeHtml(categoryLabel(post))}${post.date ? " · " + escapeHtml(post.date) : ""}</p>
  <h1>${escapeHtml(title)}</h1>
  <div class="prose">
${markdownToHtml(post.body || "")}
  </div>
</main>
<footer>
  <a href="https://ellyokinyo.com/#blog">All writing</a>
</footer>
</body>
</html>
`;
}

function writePosts(posts) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const post of posts) {
    const slug = String(post.slug || "");
    if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
      console.warn("Skipping post with an unsafe slug:", slug);
      continue;
    }
    fs.writeFileSync(path.join(outDir, slug + ".html"), pageHtml(post));
    written.push(post);
    console.log("Wrote", path.join(outDir, slug + ".html"));
  }
  if (outDir === blogDir) writeSitemap(written);
  return written;
}

function writeSitemap(posts) {
  const urls = ['  <url><loc>https://ellyokinyo.com/</loc></url>'];
  posts.forEach(function (p) {
    const loc = "https://ellyokinyo.com/blog/" + encodeURIComponent(p.slug);
    const last = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || "")) ? "<lastmod>" + p.date + "</lastmod>" : "";
    urls.push("  <url><loc>" + loc + "</loc>" + last + "</url>");
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(root, "sitemap.xml"), xml);
  console.log("Updated sitemap.xml");
}

function decodeFirestore(v) {
  if (!v || typeof v !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(v, "stringValue")) return v.stringValue;
  if (Object.prototype.hasOwnProperty.call(v, "integerValue")) return Number(v.integerValue);
  if (Object.prototype.hasOwnProperty.call(v, "doubleValue")) return Number(v.doubleValue);
  if (Object.prototype.hasOwnProperty.call(v, "booleanValue")) return v.booleanValue;
  if (Object.prototype.hasOwnProperty.call(v, "nullValue")) return null;
  if (Object.prototype.hasOwnProperty.call(v, "timestampValue")) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeFirestore);
  if (v.mapValue) {
    const out = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach(function (k) { out[k] = decodeFirestore(fields[k]); });
    return out;
  }
  return null;
}

function loadFixtures() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "dev/fixtures.js"), "utf8"), sandbox, { filename: "fixtures.js" });
  return (sandbox.window.MOCK_DATA && sandbox.window.MOCK_DATA.blog) || [];
}

function loadConfig() {
  const configPath = path.join(root, "config.js");
  if (!fs.existsSync(configPath)) return null;
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(configPath, "utf8"), sandbox, { filename: "config.js" });
  return sandbox.window.firebaseConfig || null;
}

async function loadBlogFromFirestore(cfg) {
  if (!cfg || !cfg.projectId || !cfg.apiKey) throw new Error("config.js is missing projectId or apiKey");
  const url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) + "/databases/(default)/documents/public/blog?key=" + encodeURIComponent(cfg.apiKey);
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Firestore read failed (" + res.status + ")");
  const json = await res.json();
  const value = json.fields && json.fields.value ? decodeFirestore(json.fields.value) : [];
  return Array.isArray(value) ? value : [];
}

async function main() {
  if (selfTest) {
    const html = markdownToHtml("# Title\n\nHello **bold** and *em* and [a link](https://example.com).\n\n- one\n- two\n");
    if (!html.includes("<h1>Title</h1>") || !html.includes("<strong>bold</strong>") || !html.includes("<em>em</em>") || !html.includes('href="https://example.com"') || !html.includes("<ul>")) {
      console.error(html);
      process.exit(1);
    }
    const blocked = markdownToHtml("[x](javascript:alert(1))");
    if (blocked.includes("javascript:")) {
      console.error(blocked);
      process.exit(1);
    }
    console.log("prerender self-test ok");
    return;
  }
  if (useFixtures) {
    if (outDir === blogDir) {
      console.error("Refusing to write preview fixtures into blog/. Pass --out <directory>.");
      process.exit(1);
    }
    writePosts(loadFixtures());
    return;
  }
  const cfg = loadConfig();
  if (!cfg) {
    console.log("No config.js — nothing to pre-render. The site still serves posts in the app, and /blog/<slug> works once this script has been run with Firebase config.");
    return;
  }
  const posts = await loadBlogFromFirestore(cfg);
  if (!posts.length) {
    console.log("public/blog is empty — no post pages written.");
    return;
  }
  writePosts(posts);
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
