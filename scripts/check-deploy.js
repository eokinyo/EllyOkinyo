#!/usr/bin/env node
/* Stop `firebase deploy` when the folder being published is missing
   config.js or elly.jpg, or when hosting.ignore does not contain
   ".git/**". On Windows the dotfile glob does not exclude the contents
   of .git, so the ignore list has to name that folder itself.
   config.js and elly.jpg are gitignored and live only in Elly's site
   folder. No dependencies. Works from the project root on Windows
   and Linux: `node scripts/check-deploy.js` */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function publicDir() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
    const rel = cfg && cfg.hosting && cfg.hosting.public;
    if (typeof rel === "string" && rel.trim()) return path.resolve(root, rel);
  } catch (e) {}
  return root;
}

function missingReason(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (e) {
    return "missing";
  }
  if (!st.isFile()) return "not a file";
  if (st.size === 0) return "empty";
  if (path.extname(file).toLowerCase() === ".js") {
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch (e) { return "unreadable"; }
    if (!text.trim()) return "empty";
  }
  return "";
}

function gitIgnoreMissing() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  } catch (e) {
    return true;
  }
  const ignore = cfg && cfg.hosting && cfg.hosting.ignore;
  return !Array.isArray(ignore) || ignore.indexOf(".git/**") === -1;
}

const dir = publicDir();
const required = ["config.js", "elly.jpg"];
const problems = [];
if (gitIgnoreMissing()) {
  problems.push('hosting ignore list does not contain ".git/**", so a deploy could publish the .git folder');
}
required.forEach(function (name) {
  const reason = missingReason(path.join(dir, name));
  if (reason) problems.push(name + " is " + reason);
});

/* The contact form's privacy line carries a marked placeholder for the retention
   period until Elly decides. Publishing it would show the placeholder text. */
try {
  const home = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  if (home.indexOf("data-placeholder=") !== -1 || home.indexOf("[PLACEHOLDER") !== -1) {
    problems.push("index.html still contains a [PLACEHOLDER ...] marker (contact form retention wording); replace it with Elly's wording first");
  }
} catch (e) {
  problems.push("index.html is unreadable");
}

if (problems.length) {
  console.error("Deploy stopped.");
  console.error("Folder: " + dir);
  problems.forEach(function (line) { console.error("  - " + line); });
  const missingSiteFile = problems.some(function (line) {
    return line.indexOf("config.js") === 0 || line.indexOf("elly.jpg") === 0;
  });
  if (missingSiteFile) {
    console.error("config.js and elly.jpg are not in git. Copy them into this folder, then run firebase deploy --only hosting again.");
  }
  process.exit(1);
}

console.log("Deploy check passed. config.js and elly.jpg are in " + dir);
