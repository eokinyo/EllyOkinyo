/* "Share this article" block for ellyokinyo.com.

   What it does
   - Adds a small block at the end of an article: a Share button that opens
     the device's share sheet (Web Share API), or Copy link where the browser
     has no share sheet, plus plain links to share on LinkedIn, X and by email.
   - Links are built from the article's canonical URL and title.
   - No third-party scripts, trackers, embeds, cookies or storage. Nothing is
     sent anywhere until a visitor clicks a link.

   Article pages (writing/*.html, blog/*.html):
     <script src="/share.js" defer></script>
   The block is added to the end of <article> (or <main>), using
   <link rel="canonical"> and og:title, falling back to the page URL and <h1>.

   The home page (Writing posts loaded from Firestore public/blog) loads it with
   data-auto="off" and calls window.EOShare.render(container, {url, title})
   each time a post is shown. */
(function () {
  "use strict";
  var SITE = "https://ellyokinyo.com";
  var me = document.currentScript;
  var seq = 0;

  function cleanTitle(t) {
    return String(t || "").replace(/\s+[\u2014\u2013-]\s+Elly Okinyo\s*$/, "").replace(/\s+/g, " ").trim();
  }

  function absUrl(u) {
    var s = String(u || "").trim();
    if (/^https:\/\//i.test(s)) return s;
    if (s.charAt(0) === "/") return SITE + s;
    return "";
  }

  /* Pure: the share targets for one article. */
  function links(url, title) {
    var u = encodeURIComponent(url);
    var t = encodeURIComponent(title);
    return {
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + u,
      x: "https://x.com/intent/post?url=" + u + "&text=" + t,
      email: "mailto:?subject=" + t + "&body=" + encodeURIComponent(title + "\n\n" + url)
    };
  }

  function pageInfo() {
    var c = document.querySelector('link[rel="canonical"]');
    var og = document.querySelector('meta[property="og:title"]');
    var h1 = document.querySelector("article h1, main h1, h1");
    var url = absUrl(c && c.getAttribute("href")) || (location.origin + location.pathname);
    var title = cleanTitle((og && og.getAttribute("content")) || (h1 && h1.textContent) || document.title);
    return { url: url, title: title };
  }

  var CSS =
    ".eo-share{margin:2.4em 0 .5em;padding:16px 18px;border:1px solid var(--line,rgba(204,36,29,.55));border-radius:12px;font-family:inherit}" +
    ".eo-share h2.eo-share-title{margin:0 0 12px;font-size:15px;font-weight:700;color:var(--cream,#fbf1c7);letter-spacing:.01em}" +
    ".eo-share-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}" +
    ".eo-share-btn{display:inline-flex;align-items:center;min-height:40px;padding:8px 14px;border:1px solid rgba(184,187,38,.6);border-radius:12px;background:transparent;" +
    "color:var(--olive,#b8bb26);font:inherit;font-size:14px;line-height:1.2;cursor:pointer;text-decoration:none}" +
    ".eo-share-btn:hover{border-color:var(--olive,#b8bb26);color:var(--bg,#1d2021);background:var(--olive,#b8bb26)}" +
    ".eo-share-btn:focus-visible{outline:2px solid var(--yellow,#fabd2f);outline-offset:2px}" +
    ".eo-share-status{min-height:1.2em;margin:8px 0 0;font-size:13px;color:var(--muted,#948676)}" +
    ".eo-share-url{width:100%;margin-top:8px;padding:6px 8px;font:inherit;font-size:13px;color:var(--cream,#fbf1c7);background:transparent;border:1px solid var(--line,rgba(204,36,29,.55));border-radius:8px}" +
    "@media print{.eo-share{display:none}}";

  function addStyle() {
    if (document.getElementById("eo-share-style")) return;
    var s = document.createElement("style");
    s.id = "eo-share-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = el("textarea", { readonly: "", "aria-hidden": "true", style: "position:fixed;top:-1000px;opacity:0" });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function render(container, info) {
    if (!container) return null;
    info = info || pageInfo();
    var url = absUrl(info.url);
    var title = cleanTitle(info.title);
    if (!url || !title) return null;
    var old = container.querySelector(".eo-share");
    if (old) old.parentNode.removeChild(old);
    addStyle();

    var id = "eo-share-h-" + (++seq);
    var box = el("section", { "class": "eo-share", "aria-labelledby": id });
    box.appendChild(el("h2", { "class": "eo-share-title", id: id }, "Share this article"));
    var row = el("div", { "class": "eo-share-row" });
    var status = el("p", { "class": "eo-share-status", role: "status", "aria-live": "polite" });
    var canShare = typeof navigator.share === "function";

    var main = el("button", { type: "button", "class": "eo-share-btn eo-share-main" }, canShare ? "Share\u2026" : "Copy link");
    function doCopy() {
      copyText(url).then(function (ok) {
        if (ok) { status.textContent = "Link copied."; return; }
        status.textContent = "Copy this link:";
        var inp = box.querySelector(".eo-share-url") || el("input", { "class": "eo-share-url", type: "text", readonly: "", "aria-label": "Article link" });
        inp.value = url;
        if (!inp.parentNode) box.appendChild(inp);
        inp.focus(); inp.select();
      });
    }
    main.addEventListener("click", function () {
      status.textContent = "";
      if (!canShare) return doCopy();
      navigator.share({ title: title, url: url }).catch(function (err) {
        if (!err || err.name !== "AbortError") doCopy();
      });
    });
    row.appendChild(main);

    var l = links(url, title);
    var ext = { target: "_blank", rel: "noopener noreferrer" };
    function link(href, label, aria, newTab) {
      var a = el("a", { "class": "eo-share-btn", href: href, "aria-label": aria }, label);
      if (newTab) Object.keys(ext).forEach(function (k) { a.setAttribute(k, ext[k]); });
      row.appendChild(a);
    }
    link(l.linkedin, "LinkedIn", "Share on LinkedIn (opens in a new tab)", true);
    link(l.x, "X", "Share on X (opens in a new tab)", true);
    link(l.email, "Email", "Share by email", false);

    box.appendChild(row);
    box.appendChild(status);
    container.appendChild(box);
    return box;
  }

  function auto() {
    var target = document.querySelector("article") || document.querySelector("main");
    if (target) render(target, pageInfo());
  }

  window.EOShare = { render: render, links: links, cleanTitle: cleanTitle };
  if (me && me.getAttribute("data-auto") === "off") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();
