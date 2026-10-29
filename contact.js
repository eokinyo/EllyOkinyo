/* Contact form for ellyokinyo.com (no email address on the page).

   What it does
   - Validates the form in the browser, then writes ONE new document to the
     Firestore collection `contactMessages` with the same plain REST call that
     counter.js uses (no SDK, no cookies, nothing stored on the device).
   - The document holds: name, email (the visitor's reply-to address), message
     and createdAt (server time). Nothing else.
   - Elly reads the messages in the Firebase console. There is no email
     notification and no third-party service.

   Firestore rules (firestore.rules, block "contactMessages") let the public
   create a document with exactly those fields and size limits, and never read,
   update or delete one. The limits below are mirrored there; the rules are the
   real enforcement, this file only gives the visitor early feedback.

   Honeypot: the hidden field `website` must stay empty. If a bot fills it, the
   page pretends to succeed and sends nothing (the rules also reject it).

   Markup: see the Contact section in index.html (form#contact-form). */
(function () {
  "use strict";
  var LIMITS = { name: 100, email: 254, message: 5000 };
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var TIMEOUT_MS = 15000;
  var cfgPromise = null;
  var sending = false;

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

  function docId() {
    var a = new Uint8Array(12), out = "", i;
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (i = 0; i < a.length; i++) out += (a[i] < 16 ? "0" : "") + a[i].toString(16);
    return out;
  }

  /* Resolves true when Firestore accepted the new document. */
  function store(fields) {
    return config().then(function (cfg) {
      if (!cfg || !cfg.projectId || !cfg.apiKey) return false;
      var base = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(cfg.projectId) + "/databases/(default)/documents";
      var name = "projects/" + cfg.projectId + "/databases/(default)/documents/contactMessages/" + docId();
      var body = {
        writes: [{
          update: {
            name: name,
            fields: {
              name: { stringValue: fields.name },
              email: { stringValue: fields.email },
              message: { stringValue: fields.message }
            }
          },
          updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
          currentDocument: { exists: false }
        }]
      };
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
      return fetch(base + ":commit?key=" + encodeURIComponent(cfg.apiKey), {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) { return r.ok; })
        .catch(function () { return false; })
        .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
    }).catch(function () { return false; });
  }

  function init() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    var status = document.getElementById("contact-status");
    var button = document.getElementById("contact-send");
    var fields = {
      name: document.getElementById("c-name"),
      email: document.getElementById("c-email"),
      message: document.getElementById("c-msg")
    };
    var hp = document.getElementById("c-website");

    function setError(key, text) {
      var input = fields[key];
      var err = document.getElementById("c-" + (key === "message" ? "msg" : key) + "-error");
      if (text) {
        input.setAttribute("aria-invalid", "true");
        err.textContent = text;
        err.hidden = false;
      } else {
        input.removeAttribute("aria-invalid");
        err.textContent = "";
        err.hidden = true;
      }
    }

    function say(text, kind) {
      status.className = "contact-status" + (kind ? " is-" + kind : "");
      status.textContent = "";
      if (!text) return;
      status.appendChild(document.createTextNode(text));
    }

    function validate(v) {
      var bad = [];
      setError("name", ""); setError("email", ""); setError("message", "");
      if (!v.name) { setError("name", "Please enter your name."); bad.push("name"); }
      else if (v.name.length > LIMITS.name) { setError("name", "Please use at most " + LIMITS.name + " characters for your name."); bad.push("name"); }
      if (!v.email) { setError("email", "Please enter your email address so I can reply."); bad.push("email"); }
      else if (v.email.length > LIMITS.email || !EMAIL.test(v.email)) { setError("email", "Please enter a valid email address, like name@example.com."); bad.push("email"); }
      if (!v.message) { setError("message", "Please write a message."); bad.push("message"); }
      else if (v.message.length > LIMITS.message) { setError("message", "Please keep the message under " + LIMITS.message + " characters (now " + v.message.length + ")."); bad.push("message"); }
      return bad;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (sending) return;
      var v = { name: fields.name.value.trim(), email: fields.email.value.trim(), message: fields.message.value.trim() };
      var bad = validate(v);
      if (bad.length) {
        say("Please fix the " + (bad.length === 1 ? "field" : bad.length + " fields") + " marked in red and send again.", "error");
        fields[bad[0]].focus();
        return;
      }
      if (hp && hp.value) { /* bot: pretend it worked, send nothing */
        form.reset();
        say("Thank you. Your message has been sent.", "ok");
        return;
      }
      sending = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      say("Sending\u2026", "");
      store(v).then(function (ok) {
        sending = false;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (ok) {
          form.reset();
          form.classList.add("is-sent");
          say("Thank you. Your message has been sent. I will reply to the email address you gave.", "ok");
        } else {
          say("Sorry, your message could not be sent. Your text is still in the form. Please try again in a moment, or message me on LinkedIn or X (links under the form).", "error");
        }
      });
    });

    ["name", "email", "message"].forEach(function (k) {
      fields[k].addEventListener("input", function () {
        if (fields[k].getAttribute("aria-invalid")) setError(k, "");
        if (form.classList.contains("is-sent")) form.classList.remove("is-sent");
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
