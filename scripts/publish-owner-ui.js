#!/usr/bin/env node
/* Copy scripts/owner-ui.js into Firestore private/ownerUi.

   Hosting does not upload that file. The live page reads the document
   after sign-in; firestore.rules allow the read only for the owner.

   Uses the Firebase CLI login (firebase login) when it is present.
   Also accepts GOOGLE_APPLICATION_CREDENTIALS (service account or
   authorized_user) and FIREBASE_TOKEN.

     node scripts/publish-owner-ui.js --dry-run
     node scripts/publish-owner-ui.js --self-test
     node scripts/publish-owner-ui.js

   No npm dependencies. Hosting predeploy runs this without flags. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const root = path.resolve(__dirname, "..");
const DOC_ID = "ownerUi";

/* Public OAuth client shipped by firebase-tools. The CLI itself says this
   client secret is not treated as a secret:
   https://github.com/firebase/firebase-tools/blob/master/src/api.ts */
const CLI_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const CHROME = [
  "isn't the owner",
  "isn\u2019t the owner",
  "Today's Tasks",
  "Today\u2019s Tasks",
  "Signed in, but",
  "Lm1lDi6wjRfPVbd6SfxfFZfa6RC3"
];

function projectId() {
  if (process.env.FIREBASE_PROJECT) return process.env.FIREBASE_PROJECT;
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
    if (rc.projects && rc.projects.default) return rc.projects.default;
  } catch (e) {}
  return "personal-hub-eokinyo";
}

function ownerSource() {
  return fs.readFileSync(path.join(root, "scripts", "owner-ui.js"), "utf8");
}

function assertSource(source) {
  const problems = [];
  if (typeof source !== "string" || !source.trim()) problems.push("owner tools file is empty");
  if (source.indexOf("window.OwnerUI") === -1) problems.push("owner tools file does not install window.OwnerUI");
  CHROME.forEach(function (needle) {
    if (source.indexOf(needle) !== -1) problems.push("owner tools file contains " + JSON.stringify(needle));
  });
  if (source.length > 900000) problems.push("owner tools file is too large for one Firestore document");
  return problems;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { return null; }
}

function configstoreCandidates() {
  const home = os.homedir();
  const paths = [
    path.join(home, ".config", "configstore", "firebase-tools.json")
  ];
  if (process.env.XDG_CONFIG_HOME) {
    paths.push(path.join(process.env.XDG_CONFIG_HOME, "configstore", "firebase-tools.json"));
  }
  if (process.env.APPDATA) {
    paths.push(path.join(process.env.APPDATA, "configstore", "firebase-tools.json"));
  }
  paths.push(path.join(home, "Library", "Preferences", "configstore", "firebase-tools.json"));
  return paths;
}

function tokensForProject(cfg, projectDir) {
  if (!cfg || typeof cfg !== "object") return null;
  const list = [];
  if (cfg.user && cfg.tokens) list.push({ user: cfg.user, tokens: cfg.tokens });
  if (Array.isArray(cfg.additionalAccounts)) {
    cfg.additionalAccounts.forEach(function (a) { if (a) list.push(a); });
  }
  const email = cfg.activeAccounts && projectDir && cfg.activeAccounts[projectDir];
  if (email) {
    const found = list.find(function (a) { return a.user && a.user.email === email; });
    if (found && found.tokens && found.tokens.refresh_token) return found.tokens;
  }
  if (cfg.tokens && cfg.tokens.refresh_token) return cfg.tokens;
  return null;
}

function freshAccess(tokens) {
  if (!tokens || !tokens.access_token) return "";
  if (!tokens.expires_at || tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  return "";
}

function request(url, options, body) {
  return new Promise(function (resolve, reject) {
    const req = https.request(url, options, function (res) {
      const chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.setTimeout(20000, function () { req.destroy(new Error("request timed out")); });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function form(fields) {
  return Object.keys(fields).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]);
  }).join("&");
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const body = form({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  const res = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body)
    }
  }, body);
  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch (e) {}
  if (!parsed || typeof parsed.access_token !== "string") {
    const err = parsed && (parsed.error_description || parsed.error);
    throw new Error("Could not refresh the Firebase login" + (err ? " (" + err + ")" : "") + ".");
  }
  return parsed.access_token;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function serviceAccountAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const data = header + "." + claim;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  const assertion = data + "." + sign.sign(sa.private_key).toString("base64url");
  const body = form({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: assertion
  });
  const res = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body)
    }
  }, body);
  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch (e) {}
  if (!parsed || typeof parsed.access_token !== "string") {
    throw new Error("Could not sign in with the service account.");
  }
  return parsed.access_token;
}

async function tokenFromCredential(cred) {
  if (!cred || typeof cred !== "object") return "";
  if (cred.type === "authorized_user" && cred.refresh_token) {
    return refreshAccessToken(cred.refresh_token, cred.client_id, cred.client_secret);
  }
  if (cred.type === "service_account" && cred.private_key && cred.client_email) {
    return serviceAccountAccessToken(cred);
  }
  return "";
}

async function discoverAccessToken() {
  if (process.env.FIREBASE_TOKEN) {
    const raw = process.env.FIREBASE_TOKEN.trim();
    if (raw.indexOf("ya29.") === 0) return raw;
    try { return await refreshAccessToken(raw, CLI_CLIENT_ID, CLI_CLIENT_SECRET); }
    catch (e) { return raw; }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const token = await tokenFromCredential(readJson(process.env.GOOGLE_APPLICATION_CREDENTIALS));
    if (token) return token;
  }

  const stores = configstoreCandidates();
  for (let i = 0; i < stores.length; i++) {
    const cfg = readJson(stores[i]);
    if (!cfg) continue;
    const tokens = tokensForProject(cfg, root);
    if (!tokens) continue;
    const access = freshAccess(tokens);
    if (access) return access;
    if (tokens.refresh_token) return refreshAccessToken(tokens.refresh_token, CLI_CLIENT_ID, CLI_CLIENT_SECRET);
  }

  const adc = [];
  const home = os.homedir();
  adc.push(path.join(home, ".config", "gcloud", "application_default_credentials.json"));
  const fbDir = path.join(home, ".config", "firebase");
  if (fs.existsSync(fbDir)) {
    fs.readdirSync(fbDir).forEach(function (name) {
      if (name.endsWith("_application_default_credentials.json")) adc.push(path.join(fbDir, name));
    });
  }
  for (let i = 0; i < adc.length; i++) {
    const token = await tokenFromCredential(readJson(adc[i]));
    if (token) return token;
  }
  return "";
}

function documentUrl(project) {
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(project) +
    "/databases/%28default%29/documents/private/" + DOC_ID;
}

async function writeFirestore(project, accessToken, source) {
  const payload = JSON.stringify({
    fields: {
      source: { stringValue: source },
      updated: { stringValue: new Date().toISOString() }
    }
  });
  const url = documentUrl(project);
  let res = await request(url, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload)
    }
  }, payload);
  if (res.status === 404) {
    const createUrl = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(project) +
      "/databases/%28default%29/documents/private?documentId=" + DOC_ID;
    res = await request(createUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, payload);
  }
  if (res.status < 200 || res.status >= 300) {
    let detail = "";
    try {
      const parsed = JSON.parse(res.body);
      detail = parsed.error && (parsed.error.message || parsed.error.status) || "";
    } catch (e) {}
    throw new Error("Firestore write failed (" + res.status + ")" + (detail ? ": " + detail : "") + ".");
  }
}

function selfTest() {
  const problems = [];
  const cfg = {
    user: { email: "default@example.com" },
    tokens: { refresh_token: "default-refresh", access_token: "default-access", expires_at: Date.now() + 120000 },
    additionalAccounts: [
      { user: { email: "other@example.com" }, tokens: { refresh_token: "other-refresh", access_token: "other-access", expires_at: Date.now() + 120000 } }
    ],
    activeAccounts: {}
  };
  cfg.activeAccounts[root] = "other@example.com";
  const picked = tokensForProject(cfg, root);
  if (!picked || picked.refresh_token !== "other-refresh") problems.push("did not pick the project account");
  const fallback = tokensForProject({ tokens: { refresh_token: "only" } }, root);
  if (!fallback || fallback.refresh_token !== "only") problems.push("did not fall back to the default login");
  if (freshAccess({ access_token: "abc", expires_at: Date.now() + 120000 }) !== "abc") problems.push("fresh access token was rejected");
  if (freshAccess({ access_token: "abc", expires_at: Date.now() - 1000 }) !== "") problems.push("expired access token was accepted");
  const bad = assertSource("Signed in, but this account isn't the owner yet");
  if (!bad.length) problems.push("chrome text was accepted");
  const real = assertSource(ownerSource());
  real.forEach(function (p) { problems.push(p); });
  if (documentUrl("personal-hub-eokinyo").indexOf("/private/ownerUi") === -1) problems.push("document url is wrong");
  if (problems.length) {
    console.error("publish self-test failed.");
    problems.forEach(function (p) { console.error("  - " + p); });
    process.exit(1);
  }
  console.log("publish self-test passed.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--self-test") !== -1) {
    selfTest();
    return;
  }
  const source = ownerSource();
  const problems = assertSource(source);
  if (problems.length) {
    console.error("Refusing to publish owner tools.");
    problems.forEach(function (p) { console.error("  - " + p); });
    process.exit(1);
  }
  const project = projectId();
  if (args.indexOf("--dry-run") !== -1) {
    console.log("Dry run. Would write private/" + DOC_ID + " in " + project + " (" + Buffer.byteLength(source) + " bytes).");
    return;
  }
  const token = await discoverAccessToken();
  if (!token) {
    console.error("Owner tools were not published, so hosting was not deployed.");
    console.error("Sign in with `firebase login` as the account that owns " + project + ", then run the deploy again.");
    process.exit(1);
  }
  await writeFirestore(project, token, source);
  console.log("Published owner tools to private/" + DOC_ID + " in " + project + ".");
}

main().catch(function (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
