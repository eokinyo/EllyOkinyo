/* Cookieless read counter for ellyokinyo.com.

   What it does
   - Reads one public Firestore document, counters/site, which holds `total`
     and one number per article slug.
   - Adds 1 to `total` and to the article's field after the article has been
     visible for 15 seconds. Reloads, back/forward visits and obvious bots are
     not counted. Nothing is stored on the device: no cookies, no
     localStorage, no sessionStorage, no identifiers.
   - Shows "N reads" only once an article has 50 reads, and
     "N reads across the site" only once the total reaches 500. Below that,
     nothing is added to the page.

   Firestore rules (firestore.rules, block "counters") accept only +1 on
   `total` plus one existing article field, with lastWrite set to the server
   time, at most once every 6 seconds. A read that lands inside that gap is
   retried once; if that also fails it is dropped.

   Article pages: <script src="/counter.js" data-slug="<slug>" defer></script>
   The home page calls window.EOCounter directly. */
(function () {
  "use strict";
  var ARTICLE_MIN = 50;
  var SITE_MIN = 500;
  var VISIBLE_MS = 15000;
  var COUNT_HOSTS = { "ellyokinyo.com": true, "www.ellyokinyo.com": true };
  var BOT_UA = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|preview|whatsapp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|phantomjs|selenium|puppeteer|playwright/i;
  var SLUG = /^[A-Za-z0-9_-]+$/;

  var me = document.currentScript;
  var cfgPromise = null;
  var countsPromise = null;
  var tracked = {};
  var cancelPending = null;

  function config() {
    if (cfgPromise) return cfgPromise;
    cfgPromise = new Promise(function (resolve) {
      if (window.firebaseConfig) return resolve(window.firebaseConfig);
      var s = document.createElement("script");
      s.src = "/config.js";
      s.onload = function () { resolve(window.firebaseConfig || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
    return cfgPromise;
  }

  function docsUrl(cfg) {
    return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) + "/databases/(default)/documents";
  }

  /* One public read per page load. Resolves to {total, articles} or null. */
  function getCounts() {
    if (countsPromise) return countsPromise;
    countsPromise = config().then(function (cfg) {
      if (!cfg || !cfg.projectId || !cfg.apiKey) return null;
      return fetch(docsUrl(cfg) + "/counters/site?key=" + encodeURIComponent(cfg.apiKey), { credentials: "omit", cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (doc) {
          if (!doc || !doc.fields) return null;
          var out = { total: 0, articles: {} };
          Object.keys(doc.fields).forEach(function (k) {
            var v = doc.fields[k];
            if (!v || v.integerValue === undefined) return;
            var n = Number(v.integerValue);
            if (k === "total") out.total = n; else out.articles[k] = n;
          });
          return out;
        });
    }).catch(function () { return null; });
    return countsPromise;
  }

  function navigationType() {
    try {
      var e = performance.getEntriesByType("navigation")[0];
      if (e && e.type) return e.type;
    } catch (err) {}
    try {
      var t = performance.navigation.type;
      return t === 1 ? "reload" : (t === 2 ? "back_forward" : "navigate");
    } catch (err) {}
    return "navigate";
  }

  function looksAutomated() {
    try { if (navigator.webdriver) return true; } catch (err) {}
    return BOT_UA.test(String(navigator.userAgent || ""));
  }

  /* Calls fn once the page has been visible for `ms` in total. */
  function afterVisibleFor(ms, fn) {
    var spent = 0, since = null, timer = null, over = false;
    function visible() { return document.visibilityState === "visible"; }
    function start() {
      if (over || since !== null) return;
      since = Date.now();
      timer = setTimeout(check, Math.max(0, ms - spent));
    }
    function stop() {
      if (since === null) return;
      spent += Date.now() - since;
      since = null;
      clearTimeout(timer);
    }
    function check() {
      stop();
      if (spent >= ms - 50) { finish(); fn(); } else start();
    }
    function onChange() { if (visible()) start(); else stop(); }
    function finish() { over = true; stop(); document.removeEventListener("visibilitychange", onChange); }
    document.addEventListener("visibilitychange", onChange);
    if (visible()) start();
    return finish;
  }

  function commit(slug, retried) {
    return config().then(function (cfg) {
      if (!cfg || !cfg.projectId || !cfg.apiKey) return false;
      var name = "projects/" + cfg.projectId + "/databases/(default)/documents/counters/site";
      var body = {
        writes: [{
          transform: {
            document: name,
            fieldTransforms: [
              { fieldPath: "total", increment: { integerValue: "1" } },
              { fieldPath: "`" + slug + "`", increment: { integerValue: "1" } },
              { fieldPath: "lastWrite", setToServerValue: "REQUEST_TIME" }
            ]
          },
          currentDocument: { exists: true }
        }]
      };
      return fetch(docsUrl(cfg) + ":commit?key=" + encodeURIComponent(cfg.apiKey), {
        method: "POST",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (r.ok) return true;
        if (!retried && r.status === 403) {
          /* Most likely another read landed inside the 6-second gap. */
          return new Promise(function (res) { setTimeout(res, 7000 + Math.floor(Math.random() * 5000)); })
            .then(function () { return commit(slug, true); });
        }
        return false;
      });
    }).catch(function () { return false; });
  }

  /* Count one read of `slug`, at most once per page load.
     opts.pageLoad: true when this article is what the browser loaded
     (then reloads and back/forward visits are skipped). */
  function track(slug, opts) {
    opts = opts || {};
    if (!SLUG.test(String(slug || "")) || slug === "total" || slug === "lastWrite") return;
    if (!COUNT_HOSTS[String(location.hostname || "").toLowerCase()]) return;
    if (tracked[slug]) return;
    if (looksAutomated()) return;
    if (opts.pageLoad !== false && navigationType() !== "navigate") return;
    cancel();
    tracked[slug] = "pending";
    cancelPending = afterVisibleFor(VISIBLE_MS, function () {
      cancelPending = null;
      tracked[slug] = "sent";
      commit(slug, false);
    });
    cancelPending.slug = slug;
  }

  /* Stop a pending count (e.g. the reader left the post before 15 s). */
  function cancel() {
    if (!cancelPending) return;
    var slug = cancelPending.slug;
    cancelPending();
    cancelPending = null;
    if (tracked[slug] === "pending") delete tracked[slug];
  }

  function format(n) {
    return Number(n).toLocaleString("en-GB") + " reads";
  }
  function articleLabel(counts, slug) {
    var n = counts && counts.articles ? counts.articles[slug] : undefined;
    return typeof n === "number" && n >= ARTICLE_MIN ? format(n) : "";
  }
  function siteLabel(counts) {
    var n = counts ? counts.total : undefined;
    return typeof n === "number" && n >= SITE_MIN ? format(n) + " across the site" : "";
  }

  window.EOCounter = {
    track: track,
    cancel: cancel,
    getCounts: getCounts,
    articleLabel: articleLabel,
    siteLabel: siteLabel,
    ARTICLE_MIN: ARTICLE_MIN,
    SITE_MIN: SITE_MIN
  };

  /* Article pages. */
  var pageSlug = me && me.getAttribute("data-slug");
  if (pageSlug) {
    var run = function () {
      track(pageSlug, { pageLoad: true });
      getCounts().then(function (counts) {
        var a = articleLabel(counts, pageSlug);
        if (a) {
          var line = document.createElement("p");
          line.className = "reads";
          line.textContent = a;
          var byline = document.querySelector(".byline") || document.querySelector(".kicker");
          if (byline && byline.parentNode) byline.parentNode.insertBefore(line, byline.nextSibling);
        }
        var s = siteLabel(counts);
        var spot = document.querySelector("footer.foot") || document.querySelector("footer");
        if (s && spot) {
          var span = document.createElement("span");
          span.className = "site-reads";
          span.textContent = s;
          spot.appendChild(span);
        }
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }
})();
