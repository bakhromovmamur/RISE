// Isolated real-worker lifecycle tests. Never part of a deployable build.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";

const root = await mkdtemp(join(tmpdir(), "rise-pwa-test-"));
await cp(resolve("dist"), root, { recursive: true });
const template = await readFile(join(root, "notifications-sw.js"), "utf8");
const match = template.match(/const BUILD = (.*);/);
if (!match) throw new Error("Build the production PWA first");
const original = JSON.parse(match[1]);
const originalIndex = await readFile(join(root, "index.html"), "utf8");
let version = "A", broken = false, disconnected = false, lateActivation = false, contract = original.contract;
const activation = "await self.skipWaiting();";
if (template.split(activation).length !== 2) throw new Error("Expected one worker activation boundary");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:4181");
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/__pwa_test__/version" && request.method === "POST") {
      let raw = "";
      for await (const chunk of request) { raw += chunk; if (raw.length > 1000) throw new Error("Body too large"); }
      const data = JSON.parse(raw);
      if (!/^[A-D]$/.test(data.version)) throw new Error("Unknown test release");
      disconnected = false;
      version = data.version; broken = data.broken === true; contract = data.incompatible === true ? "future-schema" : original.contract;
      lateActivation = data.lateActivation === true;
      response.end("ok"); return;
    }
    if (url.pathname === "/__pwa_test__/network" && request.method === "POST") {
      disconnected = url.searchParams.get("offline") === "true";
      response.end("ok"); return;
    }
    if (disconnected) { request.socket.destroy(); return; }
    if (/^\/(api|auth|logout)(\/|$)/.test(url.pathname)) {
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ private: "synthetic-private-response", method: request.method })); return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
    const build = structuredClone(original); build.release = `${original.release}-${version}`; build.contract = contract;
    const index = originalIndex.replace(original.release, build.release);
    build.assets.find(asset => asset.url === "/index.html").sha256 = createHash("sha256").update(index).digest("hex");
    let path = decodeURIComponent(url.pathname);
    if (path === "/" || path === "/other-tab") path = "/index.html";
    if (path.includes("..") || path.includes("\\")) { response.writeHead(400).end(); return; }
    if (broken && path === original.assets.find(asset => /migration.worker/.test(asset.url)).url) { response.writeHead(503).end("Synthetic missing asset"); return; }
    let body;
    if (path === "/index.html") body = index;
    else if (path === "/notifications-sw.js") {
      body = template.replace(match[0], `const BUILD = ${JSON.stringify(build)};`);
      // A real waiting worker activates after the page's ten-second RPC deadline.
      // This fixed fault exists only in this isolated test server, never in a build.
      if (lateActivation) body = body.replace(activation, `await new Promise(resolve => setTimeout(resolve, 12000)); ${activation}`);
    }
    else body = await readFile(join(root, path));
    response.setHeader("Content-Type", mime[extname(path)] ?? "application/octet-stream");
    response.end(request.method === "HEAD" ? undefined : body);
  } catch { response.writeHead(404).end("Not found"); }
});
server.listen(4181, "127.0.0.1", () => process.stdout.write("RISE isolated PWA test build ready on 4181\n"));
async function stop() { server.closeAllConnections(); server.close(); await rm(root, { recursive: true, force: true }); process.exit(0); }
process.on("SIGTERM", () => void stop()); process.on("SIGINT", () => void stop());
