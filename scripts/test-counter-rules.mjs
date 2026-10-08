/* Emulator tests for firestore.rules: the read-counter block, plus the existing
   public, private and sanaPaivassa behaviour. Needs no credentials.

     npm install --no-save firebase-tools@15 @firebase/rules-unit-testing@4 firebase@11
     npx firebase emulators:exec --config scripts/rules-test.firebase.json --only firestore --project demo-hub "node scripts/test-counter-rules.mjs"

   Not deployed (scripts/ is in hosting.ignore). */
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp, Timestamp, deleteField } from "firebase/firestore";
import { readFileSync } from "node:fs";
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":").map((v, i) => i ? Number(v) : v);

const OWNER = "Lm1lDi6wjRfPVbd6SfxfFZfa6RC3";
const A = "kenya-remittances-2026", B = "kenya-remittance-costs-2026";
const env = await initializeTestEnvironment({
  projectId: "demo-hub",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: HOST, port: PORT }
});
const results = [];
async function t(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + (e && e.message || e)]); }
}
async function seed(extra = {}, lastWriteMs = 0) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "counters/site"), { total: 0, lastWrite: Timestamp.fromMillis(lastWriteMs), [A]: 0, [B]: 0, ...extra });
  });
}
async function raw() {
  let d; await env.withSecurityRulesDisabled(async (ctx) => { d = (await getDoc(doc(ctx.firestore(), "counters/site"))).data(); }); return d;
}
const anon = () => env.unauthenticatedContext().firestore();
const owner = () => env.authenticatedContext(OWNER).firestore();
const user = (u) => env.authenticatedContext(u).firestore();
const site = (db) => doc(db, "counters/site");
const plusOne = (slug) => ({ total: increment(1), [slug]: increment(1), lastWrite: serverTimestamp() });

// ---- counters: allowed
await t("anon can read counters/site", async () => { await seed(); await assertSucceeds(getDoc(site(anon()))); });
await t("+1 on total and one article (anon) is allowed", async () => {
  await seed(); await assertSucceeds(updateDoc(site(anon()), plusOne(A)));
  const d = await raw(); if (d.total !== 1 || d[A] !== 1 || d[B] !== 0) throw new Error(JSON.stringify(d));
});
await t("+1 from a signed-in non-owner is also allowed (same rule)", async () => { await seed(); await assertSucceeds(updateDoc(site(user("someone")), plusOne(B))); });
await t("second +1 inside the 6 s gap is denied", async () => {
  await seed(); await assertSucceeds(updateDoc(site(anon()), plusOne(A))); await assertFails(updateDoc(site(anon()), plusOne(A)));
});
await t("+1 when lastWrite is 5 s old is denied", async () => { await seed({}, Date.now() - 5000); await assertFails(updateDoc(site(anon()), plusOne(A))); });
await t("+1 when lastWrite is 7 s old is allowed", async () => { await seed({}, Date.now() - 7000); await assertSucceeds(updateDoc(site(anon()), plusOne(A))); });
// ---- counters: denied
await t("+2 on the article is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: increment(1), [A]: increment(2), lastWrite: serverTimestamp() })); });
await t("+2 on total is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: increment(2), [A]: increment(1), lastWrite: serverTimestamp() })); });
await t("+5 on both is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: increment(5), [A]: increment(5), lastWrite: serverTimestamp() })); });
await t("decrement is denied", async () => { await seed({ total: 5, [A]: 5 }); await assertFails(updateDoc(site(anon()), { total: increment(-1), [A]: increment(-1), lastWrite: serverTimestamp() })); });
await t("setting a value directly (total 1, article 1 from 0) without server lastWrite is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: 1, [A]: 1, lastWrite: Timestamp.now() })); });
await t("new field (unknown slug) is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), plusOne("new-slug"))); });
await t("extra unrelated field alongside a valid +1 is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { ...plusOne(A), foo: 1 })); });
await t("changing an unrelated existing field is denied", async () => { await seed({ note: "x" }); await assertFails(updateDoc(site(anon()), { ...plusOne(A), note: "y" })); });
await t("two articles +1 in one write is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { ...plusOne(A), [B]: increment(1) })); });
await t("total +1 without an article is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: increment(1), lastWrite: serverTimestamp() })); });
await t("article +1 without total is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { [A]: increment(1), lastWrite: serverTimestamp() })); });
await t("+1 without updating lastWrite is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { total: increment(1), [A]: increment(1) })); });
await t("removing a field is denied", async () => { await seed(); await assertFails(updateDoc(site(anon()), { ...plusOne(A), [B]: deleteField() })); });
await t("create (counters/other) is denied", async () => { await assertFails(setDoc(doc(anon(), "counters/other"), { total: 0 })); });
await t("overwrite counters/site with set() is denied", async () => { await seed(); await assertFails(setDoc(site(anon()), { total: 999, lastWrite: serverTimestamp(), [A]: 0, [B]: 0 })); });
await t("delete counters/site is denied", async () => { await seed(); await assertFails(deleteDoc(site(anon()))); });
await t("signed-in non-owner cannot create or delete", async () => { await seed(); await assertFails(deleteDoc(site(user("someone")))); await assertFails(setDoc(doc(user("someone"), "counters/x"), { total: 0 })); });
// ---- many articles (unrolled key check)
await t("62 articles: +1 on each article key position is allowed", async () => {
  const extra = {}; for (let i = 0; i < 60; i++) extra["a-" + String(i).padStart(2, "0")] = 0;  // 60 + A + B = 62 articles, 64 keys
  const keys = ["total", "lastWrite", A, B, ...Object.keys(extra)];
  for (const k of [A, B, ...Object.keys(extra)]) { await seed(extra); await assertSucceeds(updateDoc(site(anon()), plusOne(k))); }
  if (keys.length !== 64) throw new Error("keys " + keys.length);
});
await t("62 articles: +2 on the last key position is denied", async () => {
  const extra = {}; for (let i = 0; i < 60; i++) extra["z-" + String(i).padStart(2, "0")] = 0;
  await seed(extra); await assertFails(updateDoc(site(anon()), { total: increment(1), "z-59": increment(2), lastWrite: serverTimestamp() }));
});
await t("126 articles (128 keys): +1 on the last key allowed, +2 on keys in every block denied", async () => {
  const extra = {}; for (let i = 0; i < 124; i++) extra["b-" + String(i).padStart(3, "0")] = 0;
  await seed(extra); await assertSucceeds(updateDoc(site(anon()), plusOne("b-123")));
  for (let i = 0; i < 124; i += 7) { await seed(extra); await assertFails(updateDoc(site(anon()), { total: increment(1), ["b-" + String(i).padStart(3, "0")]: increment(2), lastWrite: serverTimestamp() })); }
});
await t("129 keys: visitor writes refused (documented limit)", async () => {
  const extra = {}; for (let i = 0; i < 125; i++) extra["b-" + String(i).padStart(3, "0")] = 0;
  await seed(extra); await assertFails(updateDoc(site(anon()), plusOne(A)));
});
// ---- owner keeps full control
await t("owner can create, overwrite, reset and delete counters", async () => {
  await assertSucceeds(setDoc(doc(owner(), "counters/test"), { total: 3 }));
  await seed(); await assertSucceeds(setDoc(site(owner()), { total: 0, lastWrite: Timestamp.fromMillis(0), [A]: 0, [B]: 0, "new-slug": 0 }));
  await assertSucceeds(updateDoc(site(owner()), { total: increment(-1) }));
  await assertSucceeds(deleteDoc(doc(owner(), "counters/test")));
});
// ---- existing behaviour unchanged
await t("public: anon read allowed", async () => { await assertSucceeds(getDoc(doc(anon(), "public/blog"))); });
await t("public: anon write denied", async () => { await assertFails(setDoc(doc(anon(), "public/blog"), { value: [] })); });
await t("public: other user write denied", async () => { await assertFails(setDoc(doc(user("someone"), "public/blog"), { value: [] })); });
await t("public: owner write allowed", async () => { await assertSucceeds(setDoc(doc(owner(), "public/blog"), { value: [] })); });
await t("private: anon read denied", async () => { await assertFails(getDoc(doc(anon(), "private/ownerUi"))); });
await t("private: other user read/write denied", async () => { await assertFails(getDoc(doc(user("someone"), "private/ownerUi"))); await assertFails(setDoc(doc(user("someone"), "private/x"), { a: 1 })); });
await t("private: owner read/write allowed", async () => { await assertSucceeds(setDoc(doc(owner(), "private/x"), { a: 1 })); await assertSucceeds(getDoc(doc(owner(), "private/x"))); });
await t("sanaPaivassa: user creates own valid doc", async () => { await assertSucceeds(setDoc(doc(user("u1"), "sanaPaivassa/u1"), { v: 1, progress: {}, missed: [] })); });
await t("sanaPaivassa: user reads own doc", async () => { await assertSucceeds(getDoc(doc(user("u1"), "sanaPaivassa/u1"))); });
await t("sanaPaivassa: other user / anon read denied", async () => { await assertFails(getDoc(doc(user("u2"), "sanaPaivassa/u1"))); await assertFails(getDoc(doc(anon(), "sanaPaivassa/u1"))); });
await t("sanaPaivassa: write to another uid denied", async () => { await assertFails(setDoc(doc(user("u2"), "sanaPaivassa/u1"), { v: 1 })); });
await t("sanaPaivassa: unknown key denied", async () => { await assertFails(setDoc(doc(user("u1"), "sanaPaivassa/u1"), { v: 1, hack: true })); });
await t("sanaPaivassa: v not int denied", async () => { await assertFails(setDoc(doc(user("u1"), "sanaPaivassa/u1"), { v: "1" })); });
await t("sanaPaivassa: missed > 300 denied", async () => { await assertFails(setDoc(doc(user("u1"), "sanaPaivassa/u1"), { v: 1, missed: Array(301).fill(1) })); });
await t("sanaPaivassa: user deletes own doc", async () => { await assertSucceeds(deleteDoc(doc(user("u1"), "sanaPaivassa/u1"))); });
await t("unmatched collection denied", async () => { await assertFails(getDoc(doc(anon(), "other/x"))); await assertFails(setDoc(doc(owner(), "other/x"), { a: 1 })); });

await env.cleanup();
for (const [s, n] of results) console.log(s + "  " + n);
const failed = results.filter(r => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
