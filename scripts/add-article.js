#!/usr/bin/env node
/* Add or update ONE Writing post in Firestore public/blog.

   The Writing tab reads the single document public/blog, whose field
   `value` is an array of posts {id, slug, title, category, date, body}.
   This script inserts the post from a JSON file, or replaces the post
   that already has the same slug. Every other post is left untouched.

   It also makes sure the read counter document counters/site has a field
   for this slug (created at 0 only when it is missing; an existing count is
   never reset). --counter-only does just that and leaves public/blog alone.

   Dry run by default: prints what would change and writes nothing.

     npm install --no-save firebase-admin
     gcloud auth application-default login      # or set GOOGLE_APPLICATION_CREDENTIALS
     node scripts/add-article.js scripts/articles/kenya-remittances-2026.json
     node scripts/add-article.js scripts/articles/kenya-remittances-2026.json --write
     node scripts/add-article.js scripts/articles/kenya-remittances-2026.json --counter-only --write

   Deploy hosting first (firebase deploy --only hosting) so the chart
   images the post links to already exist on ellyokinyo.com.
   The Admin SDK uses IAM (project owner), not firestore.rules.
   Not deployed (scripts/ is in hosting.ignore). */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const counterOnly = args.includes("--counter-only");
const file = args.find(function (a) { return !a.startsWith("--"); });

function projectId() {
  if (process.env.FIREBASE_PROJECT) return process.env.FIREBASE_PROJECT;
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
    if (rc.projects && rc.projects.default) return rc.projects.default;
  } catch (e) {}
  return "personal-hub-eokinyo";
}

function validate(post) {
  const problems = [];
  if (!post || typeof post !== "object") return ["not an object"];
  if (!/^[A-Za-z0-9_-]+$/.test(String(post.slug || ""))) problems.push("slug must be letters, digits, - or _");
  if (!String(post.title || "").trim()) problems.push("title is empty");
  if (post.category !== "economics" && post.category !== "notes") problems.push('category must be "economics" or "notes"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.date || ""))) problems.push("date must be YYYY-MM-DD");
  if (!String(post.body || "").trim()) problems.push("body is empty");
  if (typeof post.id !== "number") problems.push("id must be a number");
  if (post.slug === "total" || post.slug === "lastWrite") problems.push('slug cannot be "total" or "lastWrite" (reserved in counters/site)');
  return problems;
}

async function main() {
  if (!file) {
    console.error("Usage: node scripts/add-article.js <post.json> [--write]");
    process.exit(1);
  }
  const post = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const problems = validate(post);
  if (problems.length) {
    console.error("Post JSON is not valid:");
    problems.forEach(function (p) { console.error("  - " + p); });
    process.exit(1);
  }

  let admin;
  try { admin = require("firebase-admin"); }
  catch (e) {
    console.error("firebase-admin is not installed. Run: npm install --no-save firebase-admin");
    process.exit(1);
  }
  const pid = projectId();
  admin.initializeApp({ projectId: pid });
  const db = admin.firestore();
  const ref = db.collection("public").doc("blog");

  /* Read counter field: create at 0 only if missing. Never resets a count. */
  const counterRef = db.collection("counters").doc("site");
  const counter = await db.runTransaction(async function (tx) {
    const snap = await tx.get(counterRef);
    const data = snap.exists ? snap.data() : null;
    if (data && Object.prototype.hasOwnProperty.call(data, post.slug)) {
      return { action: "field exists (" + data[post.slug] + "), left unchanged" };
    }
    if (!data) {
      const init = { total: 0, lastWrite: admin.firestore.Timestamp.fromMillis(0) };
      init[post.slug] = 0;
      if (write) tx.create(counterRef, init);
      return { action: "create counters/site with total 0 and " + post.slug + " 0" };
    }
    if (write) tx.update(counterRef, new admin.firestore.FieldPath(post.slug), 0);
    return { action: "add field " + post.slug + " = 0" };
  });

  if (counterOnly) {
    console.log("Project:  " + pid);
    console.log("Counter:  counters/site · " + counter.action);
    console.log(write ? "Written." : "Dry run. Nothing was written. Add --write to apply.");
    return;
  }

  const result = await db.runTransaction(async function (tx) {
    const snap = await tx.get(ref);
    const current = snap.exists && Array.isArray(snap.data().value) ? snap.data().value : [];
    const idx = current.findIndex(function (p) { return p && p.slug === post.slug; });
    const next = current.slice();
    if (idx >= 0) next[idx] = post; else next.unshift(post);
    if (write) tx.set(ref, { value: next }, { merge: true });
    return { before: current.length, after: next.length, replaced: idx >= 0 };
  });

  console.log("Project:  " + pid);
  console.log("Document: public/blog (field: value)");
  console.log("Post:     " + post.slug + " · " + post.category + " · " + post.date);
  console.log("Action:   " + (result.replaced ? "replace existing post with this slug" : "add new post at the top"));
  console.log("Posts:    " + result.before + " -> " + result.after);
  console.log("Counter:  counters/site · " + counter.action);
  if (!write) {
    console.log("Dry run. Nothing was written. Add --write to apply.");
  } else {
    console.log("Written. Check https://ellyokinyo.com/#writing/economics signed out.");
  }
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
