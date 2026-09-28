/* Sort CV entries for display. Does not reorder the stored array.
   Inlined into index.html (scripts/ is not published). Node tests require this file. */
var CV_MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

function cvOngoingWord(s) {
  return /^(present|current|now|ongoing)$/i.test(String(s || "").trim());
}

function cvParsePoint(s) {
  var t = String(s || "").trim();
  if (!t) return null;
  if (cvOngoingWord(t)) return { ongoing: true };
  var m = t.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    var mon = CV_MONTHS[m[1].toLowerCase()];
    if (!mon) return null;
    return { y: Number(m[2]), m: mon };
  }
  m = t.match(/^([A-Za-z]+)$/);
  if (m && CV_MONTHS[m[1].toLowerCase()]) return { month: CV_MONTHS[m[1].toLowerCase()] };
  m = t.match(/^(\d{4})$/);
  if (m) return { y: Number(m[1]), m: 0 };
  return null;
}

function cvWithYear(point, year) {
  if (!point || point.ongoing) return null;
  if (point.y != null) return { y: point.y, m: point.m };
  if (point.month && year != null) return { y: year, m: point.month };
  return null;
}

function parseCvPeriod(text) {
  var raw = String(text == null ? "" : text).replace(/\u00a0/g, " ").trim();
  if (!raw) return null;
  raw = raw.replace(/[\u2013\u2014]/g, "-");
  var ongoing = false;
  if (/(?:-|\bto)\s*$/i.test(raw)) {
    ongoing = true;
    raw = raw.replace(/(?:-|\bto)\s*$/i, "").trim();
  }
  raw = raw.replace(/\s+to\s+/gi, " - ").replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
  if (!raw) return ongoing ? { ongoing: true, start: null, end: null } : null;
  var parts = raw.split(" - ");
  if (parts.length > 2) return null;
  var a = cvParsePoint(parts[0]);
  var b = parts.length === 2 ? cvParsePoint(parts[1]) : null;
  if (!a && !b) return null;
  if (a && a.ongoing) ongoing = true;
  if (b && b.ongoing) ongoing = true;
  if (parts.length === 1) {
    if (!a || a.ongoing) return ongoing ? { ongoing: true, start: null, end: null } : null;
    var only = cvWithYear(a, null);
    if (!only) return null;
    return { ongoing: ongoing, start: only, end: ongoing ? null : { y: only.y, m: only.m } };
  }
  var startYear = a && a.y != null ? a.y : (b && b.y != null ? b.y : null);
  var endYear = b && b.y != null ? b.y : (a && a.y != null ? a.y : null);
  var start = cvWithYear(a, startYear);
  var end = ongoing ? null : cvWithYear(b, endYear);
  if (!start && !end && !ongoing) return null;
  if (!ongoing && !end) return null;
  if (!start && !ongoing) return null;
  return { ongoing: ongoing, start: start, end: end };
}

function cvDateKey(d) {
  if (!d || d.y == null || !isFinite(d.y)) return null;
  return d.y * 12 + (d.m || 0);
}

function cvNumericOrder(item) {
  if (!item || item.order == null || item.order === "") return null;
  if (typeof item.order === "number") return isFinite(item.order) ? item.order : null;
  if (typeof item.order === "string" && /^-?\d+(\.\d+)?$/.test(item.order.trim())) {
    var n = Number(item.order.trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

function compareCvRows(a, b) {
  var aHas = a.order != null;
  var bHas = b.order != null;
  if (aHas || bHas) {
    if (aHas && bHas) {
      if (a.order !== b.order) return a.order - b.order;
      return a.index - b.index;
    }
    return aHas ? -1 : 1;
  }
  var ap = a.parsed;
  var bp = b.parsed;
  if (!ap && !bp) return a.index - b.index;
  if (!ap) return 1;
  if (!bp) return -1;
  if (!!ap.ongoing !== !!bp.ongoing) return ap.ongoing ? -1 : 1;
  if (!ap.ongoing) {
    var ae = cvDateKey(ap.end);
    var be = cvDateKey(bp.end);
    if (ae == null && be != null) return 1;
    if (be == null && ae != null) return -1;
    if (ae != null && be != null && ae !== be) return be - ae;
  }
  var as = cvDateKey(ap.start);
  var bs = cvDateKey(bp.start);
  if (as == null && bs != null) return 1;
  if (bs == null && as != null) return -1;
  if (as != null && bs != null && as !== bs) return bs - as;
  return a.index - b.index;
}

function sortCvEntries(entries, dateField) {
  var list = Array.isArray(entries) ? entries : [];
  var field = dateField || "period";
  var rows = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    rows.push({
      item: item,
      index: i,
      order: cvNumericOrder(item),
      parsed: parseCvPeriod(item && item[field])
    });
  }
  rows.sort(compareCvRows);
  return rows.map(function (row) { return { item: row.item, index: row.index }; });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseCvPeriod: parseCvPeriod, sortCvEntries: sortCvEntries };
}
