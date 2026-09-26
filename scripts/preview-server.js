#!/usr/bin/env node
/* Local preview only. Serves the repo and falls back to index.html for
   extension-less paths, the way Firebase Hosting rewrites do.
   Open http://127.0.0.1:4173/?mock=1
   Not deployed (scripts/ is in hosting.ignore). */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp"
};

function send(res, code, type, body) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes("\0") || rel.split("/").includes("..")) {
    send(res, 400, "text/plain; charset=utf-8", "Bad path");
    return;
  }
  const filePath = path.join(root, rel);
  fs.stat(filePath, function (err, st) {
    let file = filePath;
    if (!err && st.isDirectory()) file = path.join(filePath, "index.html");
    fs.readFile(file, function (err2, data) {
      if (!err2) {
        const ext = path.extname(file).toLowerCase();
        send(res, 200, types[ext] || "application/octet-stream", data);
        return;
      }
      if (path.extname(rel)) {
        send(res, 404, "text/plain; charset=utf-8", "Not found");
        return;
      }
      fs.readFile(path.join(root, "index.html"), function (err3, html) {
        if (err3) send(res, 500, "text/plain; charset=utf-8", "Missing index.html");
        else send(res, 200, "text/html; charset=utf-8", html);
      });
    });
  });
});

server.listen(port, "127.0.0.1", function () {
  console.log("Preview: http://127.0.0.1:" + port + "/?mock=1");
});
