#!/usr/bin/env node
/* Plain Node tests for the CV date parser and display sort. No packages. */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var sort = require("./cv-sort");
var parseCvPeriod = sort.parseCvPeriod;
var sortCvEntries = sort.sortCvEntries;

var failed = 0;
function check(name, cond) {
  if (cond) {
    console.log("ok  " + name);
    return;
  }
  failed++;
  console.error("FAIL " + name);
}

function sameDate(label, text, expect) {
  var got = parseCvPeriod(text);
  var ok = !!got === !!expect;
  if (got && expect) {
    ok = !!got.ongoing === !!expect.ongoing
      && (!!got.start) === (!!expect.start)
      && (!!got.end) === (!!expect.end);
    if (ok && expect.start) ok = got.start.y === expect.start.y && got.start.m === expect.start.m;
    if (ok && expect.end) ok = got.end.y === expect.end.y && got.end.m === expect.end.m;
  }
  if (!ok) {
    failed++;
    console.error("FAIL " + label + " <= " + JSON.stringify(text));
    console.error("     got    " + JSON.stringify(got));
    console.error("     expect " + JSON.stringify(expect));
    return;
  }
  console.log("ok  " + label);
}

function point(y, m) { return { y: y, m: m }; }
function range(text, sy, sm, ey, em) {
  sameDate(text, text, { ongoing: false, start: point(sy, sm), end: point(ey, em) });
}
function ongoing(text, sy, sm) {
  sameDate(text, text, { ongoing: true, start: sy == null ? null : point(sy, sm), end: null });
}

range("Feb 2026", 2026, 2, 2026, 2);
range("February 2026", 2026, 2, 2026, 2);
range("  feb   2026  ", 2026, 2, 2026, 2);
range("Sept 2024", 2024, 9, 2024, 9);

range("Feb 2026 – Apr 2026", 2026, 2, 2026, 4);
range("Feb 2026 — Apr 2026", 2026, 2, 2026, 4);
range("Feb 2026 - Apr 2026", 2026, 2, 2026, 4);
range("Feb 2026-Apr 2026", 2026, 2, 2026, 4);
range("Feb 2026 to Apr 2026", 2026, 2, 2026, 4);
range("Feb 2026  to  Apr 2026", 2026, 2, 2026, 4);
range("February 2026 to April 2026", 2026, 2, 2026, 4);

range("Sep–Dec 2025", 2025, 9, 2025, 12);
range("Sep-Dec 2025", 2025, 9, 2025, 12);
range("September–December 2025", 2025, 9, 2025, 12);
range("Sep to Dec 2025", 2025, 9, 2025, 12);
range("Jul 2016 – Dec 2020", 2016, 7, 2020, 12);
range("July 2016 - December 2020", 2016, 7, 2020, 12);
range("2020", 2020, 0, 2020, 0);
range("2019–2021", 2019, 0, 2021, 0);
range("2019-2021", 2019, 0, 2021, 0);
range("2019 to 2021", 2019, 0, 2021, 0);
range("2019 — 2021", 2019, 0, 2021, 0);

ongoing("Aug 2026 – present", 2026, 8);
ongoing("Aug 2026 – Present", 2026, 8);
ongoing("Aug 2026 – CURRENT", 2026, 8);
ongoing("Aug 2026 - now", 2026, 8);
ongoing("Aug 2026 — ongoing", 2026, 8);
ongoing("Aug 2026 –", 2026, 8);
ongoing("Aug 2026-", 2026, 8);
ongoing("Aug 2026 —", 2026, 8);
ongoing("Aug 2026 to", 2026, 8);
ongoing("present", null, null);
ongoing("2020 – present", 2020, 0);

sameDate("empty", "", null);
sameDate("blank", "   ", null);
sameDate("garbage", "not a date", null);
sameDate("bad month", "Foo 2026", null);
sameDate("half range", "Feb 2026 – someday", null);

var newestFirst = [
  { period: "not a date", role: "bad-a" },
  { period: "Feb 2026 – Apr 2026", role: "feb" },
  { period: "", role: "bad-b" },
  { period: "Aug 2026 – present", role: "now" },
  { period: "Sep–Dec 2025", role: "sep" },
  { period: "2019–2021", role: "years" },
  { period: "2020", role: "y2020" },
  { period: "Jul 2016 – Dec 2020", role: "jul" }
];
var original = newestFirst.map(function (e) { return e.role; });
var sorted = sortCvEntries(newestFirst, "period");
check("does not reorder the stored array", original.join(",") === newestFirst.map(function (e) { return e.role; }).join(","));
check("reverse chronological order", sorted.map(function (r) { return r.item.role; }).join(",") === "now,feb,sep,years,jul,y2020,bad-a,bad-b");
check("unparsed entries keep original order", sorted.slice(-2).map(function (r) { return r.index; }).join(",") === "0,2");
check("returned indexes point at stored rows", sorted.every(function (r) { return newestFirst[r.index] === r.item; }));

var tied = [
  { date: "Jan 2024", name: "first" },
  { date: "Jan 2024", name: "second" },
  { date: "Mar 2023", name: "older" }
];
var tiedSort = sortCvEntries(tied, "date");
check("same date stays in original order", tiedSort.map(function (r) { return r.item.name; }).join(",") === "first,second,older");

var ongoingPair = [
  { period: "Feb 2020 – present", role: "older-ongoing" },
  { period: "Aug 2026 – present", role: "newer-ongoing" }
];
check("ongoing roles sort by start date", sortCvEntries(ongoingPair, "period").map(function (r) { return r.item.role; }).join(",") === "newer-ongoing,older-ongoing");

var sameEnd = [
  { period: "Jan 2020 – Dec 2021", role: "earlier-start" },
  { period: "Jun 2021 – Dec 2021", role: "later-start" }
];
check("same end date uses start date", sortCvEntries(sameEnd, "period").map(function (r) { return r.item.role; }).join(",") === "later-start,earlier-start");

var pinned = [
  { period: "Aug 2026 – present", role: "newest" },
  { period: "2010", role: "second-pin", order: 2 },
  { period: "1999", role: "first-pin", order: "1" },
  { period: "nope", role: "loose" }
];
check("numeric order comes first, ascending", sortCvEntries(pinned, "period").map(function (r) { return r.item.role; }).join(",") === "first-pin,second-pin,newest,loose");

var orderTie = [
  { period: "2020", role: "a", order: 1 },
  { period: "2024", role: "b", order: 1 }
];
check("equal order stays in original order", sortCvEntries(orderTie, "period").map(function (r) { return r.item.role; }).join(",") === "a,b");
check("order zero is set", sortCvEntries([{ period: "1990", role: "z", order: 0 }, { period: "2024 – present", role: "n" }], "period")[0].item.role === "z");
check("non-numeric order is ignored", sortCvEntries([{ period: "1990", role: "old", order: "first" }, { period: "2024", role: "new" }], "period")[0].item.role === "new");

var sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "dev", "fixtures.js"), "utf8"), sandbox);
var cv = sandbox.window.MOCK_DATA.cv;
var expBefore = cv.experience.map(function (e) { return e.period; });
var expView = sortCvEntries(cv.experience, "period");
check("fixture experience order", expView.map(function (r) { return r.item.role + " | " + r.item.period; }).join("\n") === [
  "Research Assistant (CHARM Project) | Aug 2026 – present",
  "Research Assistant | Feb 2026 – Apr 2026",
  "Research Trainee | Sep 2025 – Dec 2025",
  "Administrator – Student Mentoring Services | Apr 2022 – Mar 2023",
  "Assistant Project Manager | Jan 2021 – Feb 2022",
  "Research Assistant | May 2020 – Jan 2021"
].join("\n"));
check("fixture experience stored indexes", expView.map(function (r) { return r.index; }).join(",") === "5,0,1,2,3,4");
check("fixture array was not rewritten", expBefore.join("\n") === cv.experience.map(function (e) { return e.period; }).join("\n"));

var eduView = sortCvEntries(cv.education, "period");
check("fixture education stays in order", eduView.map(function (r) { return r.item.degree; }).join(" | ") === [
  "Research Master's in Economics",
  "BBA in Computer Applications",
  "BBSc in Financial Economics"
].join(" | "));
check("fixture education indexes", eduView.map(function (r) { return r.index; }).join(",") === "0,1,2");

var certView = sortCvEntries(cv.certifications, "date");
check("fixture certifications newest first", certView.map(function (r) { return r.item.name + " | " + r.item.date; }).join("\n") === [
  "Python Essentials 1 | Jan 2024",
  "Data Analytics Essentials | Jan 2024",
  "Introduction to Data Science | Dec 2023",
  "Impact Evaluation Training for Researchers in East Africa | Mar 2023"
].join("\n"));
check("fixture certification indexes", certView.map(function (r) { return r.index; }).join(",") === "1,2,3,0");

var stored = cv.experience.map(function (e) { return Object.assign({}, e); });
var display = sortCvEntries(stored, "period");
stored.splice(display[0].index, 1);
check("deleting the first displayed row removes the stored CHARM entry", stored.every(function (e) { return e.role.indexOf("CHARM") === -1; }));
check("the February 2026 entry is still first in storage", stored[0].period === "Feb 2026 – Apr 2026");
var afterDelete = sortCvEntries(stored, "period");
check("after that delete, February 2026 is shown first", afterDelete[0].item.period === "Feb 2026 – Apr 2026" && afterDelete[0].index === 0);

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
var start = html.indexOf("/* cv-sort:start */");
var end = html.indexOf("/* cv-sort:end */");
check("index.html has the inlined sort", start !== -1 && end > start);
if (start !== -1 && end > start) {
  var inline = html.slice(start + "/* cv-sort:start */".length, end).trim();
  var file = fs.readFileSync(path.join(__dirname, "cv-sort.js"), "utf8").trim();
  var fromFile = file.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/\nif \(typeof module[\s\S]*$/, "").trim();
  check("inlined sort matches scripts/cv-sort.js", inline === fromFile);
}

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("All CV sort tests passed.");
