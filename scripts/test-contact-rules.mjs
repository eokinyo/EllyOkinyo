/* Emulator tests for the contactMessages block of firestore.rules. Needs no credentials.

     npm install --no-save firebase-tools@15 @firebase/rules-unit-testing@4 firebase@11
     npx firebase emulators:exec --config scripts/rules-test.firebase.json --only firestore --project demo-hub "node scripts/test-contact-rules.mjs"

   Not deployed (scripts/ is in hosting.ignore). */
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":").map((v, i) => i ? Number(v) : v);

const OWNER = "Lm1lDi6wjRfPVbd6SfxfFZfa6RC3";
const env = await initializeTestEnvironment({
  projectId: "demo-hub",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: HOST, port: PORT }
});
const results = [];
async function t(name, fn) {
  try { await env.clearFirestore(); await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + (e && e.message || e)]); }
}
const anon = () => env.unauthenticatedContext().firestore();
const user = (u) => env.authenticatedContext(u).firestore();
const owner = () => env.authenticatedContext(OWNER).firestore();
const msgs = (db) => collection(db, "contactMessages");
const valid = () => ({ name: "Test Visitor", email: "visitor@example.com", message: "Hello Elly", createdAt: serverTimestamp() });
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "contactMessages/m1"), { name: "A", email: "a@example.com", message: "x", createdAt: Timestamp.now() }); });
}
async function count() {
  let n = 0; await env.withSecurityRulesDisabled(async (ctx) => { n = (await getDocs(collection(ctx.firestore(), "contactMessages"))).size; }); return n;
}

// ---- allowed
await t("valid submit by anonymous visitor is stored", async () => {
  await assertSucceeds(addDoc(msgs(anon()), valid()));
  if ((await count()) !== 1) throw new Error("expected 1 stored doc");
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDocs(collection(ctx.firestore(), "contactMessages")); const d = s.docs[0].data();
    if (Object.keys(d).sort().join() !== "createdAt,email,message,name") throw new Error("fields " + Object.keys(d));
    if (!(d.createdAt instanceof Timestamp)) throw new Error("createdAt is not a timestamp");
  });
});
await t("valid submit with empty honeypot field is stored", async () => { await assertSucceeds(addDoc(msgs(anon()), { ...valid(), website: "" })); });
await t("message of exactly 5000 characters is stored", async () => { await assertSucceeds(addDoc(msgs(anon()), { ...valid(), message: "a".repeat(5000) })); });
await t("multi-line message is stored", async () => { await assertSucceeds(addDoc(msgs(anon()), { ...valid(), message: "line one\n\nline two\n" })); });
await t("name of 100 and email of 254 characters are stored", async () => {
  const email = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(57) + ".com"; if (email.length !== 254) throw new Error("test email length " + email.length);
  await assertSucceeds(addDoc(msgs(anon()), { ...valid(), name: "n".repeat(100), email }));
});
await t("signed-in non-owner can also create (same rule)", async () => { await assertSucceeds(addDoc(msgs(user("someone")), valid())); });

// ---- rejected: empty / missing / wrong type
await t("empty submit (no fields) is rejected", async () => { await assertFails(addDoc(msgs(anon()), {})); });
await t("empty strings are rejected", async () => { await assertFails(addDoc(msgs(anon()), { name: "", email: "", message: "", createdAt: serverTimestamp() })); });
await t("whitespace-only name / message rejected", async () => {
  await assertFails(addDoc(msgs(anon()), { ...valid(), name: "   " }));
  await assertFails(addDoc(msgs(anon()), { ...valid(), message: " \n\t " }));
});
for (const k of ["name", "email", "message", "createdAt"]) {
  await t("missing required field " + k + " is rejected", async () => { const d = valid(); delete d[k]; await assertFails(addDoc(msgs(anon()), d)); });
}
await t("non-string values are rejected", async () => {
  await assertFails(addDoc(msgs(anon()), { ...valid(), name: 5 }));
  await assertFails(addDoc(msgs(anon()), { ...valid(), message: ["x"] }));
  await assertFails(addDoc(msgs(anon()), { ...valid(), email: { a: 1 } }));
});
await t("invalid reply-to email addresses are rejected", async () => {
  for (const e of ["nobody", "a@b", "a b@example.com", "@example.com", "a@@example.com", "a@example.com\nBcc: x@example.org"])
    await assertFails(addDoc(msgs(anon()), { ...valid(), email: e }));
});

// ---- rejected: size caps
await t("over-length message (5001) is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), message: "a".repeat(5001) })); });
await t("over-length name (101) is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), name: "n".repeat(101) })); });
await t("over-length email (255) is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), email: "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(58) + ".com" })); });

// ---- rejected: unknown fields, honeypot, timestamp
await t("extra unknown field is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), admin: true })); });
await t("extra unknown field next to the honeypot is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), website: "", extra: "x" })); });
await t("honeypot filled is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), website: "http://spam.example" })); });
await t("honeypot of a single space is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), website: " " })); });
await t("client-supplied createdAt (not server time) is rejected", async () => {
  await assertFails(addDoc(msgs(anon()), { ...valid(), createdAt: Timestamp.now() }));
  await assertFails(addDoc(msgs(anon()), { ...valid(), createdAt: Timestamp.fromMillis(0) }));
});
await t("createdAt as a string is rejected", async () => { await assertFails(addDoc(msgs(anon()), { ...valid(), createdAt: "now" })); });
await t("nothing was stored by the rejected writes in this test", async () => { await assertFails(addDoc(msgs(anon()), {})); if ((await count()) !== 0) throw new Error("doc stored"); });

// ---- public read / update / delete denied
await t("public get of a message is denied", async () => { await seed(); await assertFails(getDoc(doc(anon(), "contactMessages/m1"))); });
await t("public list of messages is denied", async () => { await seed(); await assertFails(getDocs(msgs(anon()))); });
await t("signed-in non-owner get/list denied", async () => { await seed(); await assertFails(getDoc(doc(user("someone"), "contactMessages/m1"))); await assertFails(getDocs(msgs(user("someone")))); });
await t("public update of a message is denied", async () => {
  await seed();
  await assertFails(updateDoc(doc(anon(), "contactMessages/m1"), { message: "changed" }));
  await assertFails(setDoc(doc(anon(), "contactMessages/m1"), valid()));
  await assertFails(setDoc(doc(anon(), "contactMessages/m1"), { message: "merged" }, { merge: true }));
});
await t("public delete of a message is denied", async () => { await seed(); await assertFails(deleteDoc(doc(anon(), "contactMessages/m1"))); if ((await count()) !== 1) throw new Error("doc gone"); });
await t("owner account cannot read, update or delete via client rules either (console only)", async () => {
  await seed();
  await assertFails(getDoc(doc(owner(), "contactMessages/m1")));
  await assertFails(updateDoc(doc(owner(), "contactMessages/m1"), { message: "x" }));
  await assertFails(deleteDoc(doc(owner(), "contactMessages/m1")));
});
await t("no other collection became writable (spot check)", async () => { await assertFails(addDoc(collection(anon(), "contactMessagesX"), valid())); await assertFails(addDoc(collection(anon(), "public"), valid())); });

await env.cleanup();
for (const [s, n] of results) console.log(s + "  " + n);
const failed = results.filter(r => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
