#!/usr/bin/env node
/* Checks for the "Share this article" block (share.js). No network.

     node scripts/test-share.js

   - share.js builds the LinkedIn, X and email links from the URL and title.
   - share.js loads no third-party code and stores nothing on the device.
   - Every article page in writing/ loads share.js once.
   - Pages written by build-posts.js load share.js.
   - The home page loads share.js with data-auto="off" and renders the block
     for each Writing post.
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const problems = [];
function check(cond, msg) { if (!cond) problems.push(msg); }

const src = fs.readFileSync(path.join(root, "share.js"), "utf8");

/* 1. Pure link builder, run in a sandbox with data-auto="off". */
const sandbox = {
  document: { currentScript: { getAttribute: function (k) { return k === "data-auto" ? "off" : null; } } },
  navigator: {},
  location: { origin: "https://ellyokinyo.com", pathname: "/" }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "share.js" });
const S = sandbox.EOShare;
check(S && typeof S.render === "function" && typeof S.links === "function", "share.js does not expose EOShare.render/links");
const url = "https://ellyokinyo.com/writing/kenya-remittance-costs-2026.html";
const title = "The 1% US tax is not the biggest cost & more";
const l = S.links(url, title);
check(l.linkedin === "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url), "LinkedIn link wrong: " + l.linkedin);
check(l.x === "https://x.com/intent/post?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(title), "X link wrong: " + l.x);
check(l.email.indexOf("mailto:?subject=" + encodeURIComponent(title)) === 0 && l.email.indexOf(encodeURIComponent(url)) > 0, "Email link wrong: " + l.email);
check(S.cleanTitle("A title \u2014 Elly Okinyo") === "A title", "cleanTitle does not drop the site name");

/* 2. No third-party code, embeds or storage. */
const hosts = (src.match(/https?:\/\/[^\/"'\s]+/g) || []).map(function (u) { return u.replace(/^https?:\/\//, ""); });
const allowed = { "ellyokinyo.com": 1, "www.linkedin.com": 1, "x.com": 1 };
hosts.forEach(function (h) { check(allowed[h], "share.js mentions an unexpected host: " + h); });
["<iframe", "createElement(\"script\")", "createElement('script')", "fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "document.cookie", "sendBeacon"].forEach(function (n) {
  check(src.indexOf(n) === -1, "share.js must not use " + n);
});

/* 3. Every static article page loads share.js exactly once. */
const writing = path.join(root, "writing");
fs.readdirSync(writing).filter(function (f) { return /\.html$/.test(f); }).forEach(function (f) {
  const html = fs.readFileSync(path.join(writing, f), "utf8");
  const n = (html.match(/<script src="\/share\.js" defer><\/script>/g) || []).length;
  check(n === 1, "writing/" + f + " loads share.js " + n + " times (want 1)");
  check(/<article[\s>]/.test(html) || /<main[\s>]/.test(html), "writing/" + f + " has no <article> or <main> for the block");
  check(/<link rel="canonical" href="https:\/\/ellyokinyo\.com\//.test(html), "writing/" + f + " has no canonical ellyokinyo.com URL");
});

/* 4. build-posts.js pages load share.js. */
const bp = fs.readFileSync(path.join(root, "scripts/build-posts.js"), "utf8");
check(bp.indexOf('<script src="/share.js" defer></script>') !== -1, "build-posts.js page template does not load share.js");

/* 5. Home page wiring. */
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
check(/<script src="\/share\.js" data-auto="off" defer><\/script>/.test(index), "index.html does not load share.js with data-auto=\"off\"");
check(index.indexOf("EOShare.render(") !== -1, "index.html does not render the share block for posts");

if (problems.length) {
  problems.forEach(function (p) { console.error("FAIL", p); });
  process.exit(1);
}
console.log("share test ok");
