/* Merge the Firestore Writing posts with writing/index.json for display.
   Does not change the stored posts: the owner tools still save only the
   Firestore list. Inlined into index.html (scripts/ is not published).
   Node tests require this file. */
var WRITING_SLUG_RE = /^[A-Za-z0-9_-]+$/;

/* "/writing/<slug>.html" for a same-site article url, otherwise "". */
function writingPagePath(url) {
  var m = String(url || "").match(/^(?:https:\/\/(?:www\.)?ellyokinyo\.com)?(\/writing\/[A-Za-z0-9_-]+\.html)$/);
  return m ? m[1] : "";
}

function mergeWriting(blog, manifest) {
  var out = [], index = {};
  (Array.isArray(blog) ? blog : []).forEach(function (p) {
    if (!p || typeof p !== "object") return;
    var copy = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) copy[k] = p[k];
    out.push(copy);
    if (copy.slug && !Object.prototype.hasOwnProperty.call(index, copy.slug)) index[copy.slug] = copy;
  });
  (Array.isArray(manifest) ? manifest : []).forEach(function (e) {
    if (!e || typeof e !== "object") return;
    var slug = String(e.slug || "");
    var path = writingPagePath(e.url);
    if (!WRITING_SLUG_RE.test(slug) || path !== "/writing/" + slug + ".html") return;
    if (Object.prototype.hasOwnProperty.call(index, slug)) {
      if (!index[slug].url) index[slug].url = String(e.url);
      return;
    }
    var post = {
      slug: slug,
      title: String(e.title || ""),
      date: String(e.date || ""),
      category: e.category === "notes" ? "notes" : "economics",
      body: String(e.description || ""),
      url: String(e.url),
      staticOnly: true
    };
    index[slug] = post;
    out.push(post);
  });
  out.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { mergeWriting: mergeWriting, writingPagePath: writingPagePath };
}
