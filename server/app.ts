import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, sep, extname } from "node:path";
import type { ServerConfig } from "./config.ts";
import type { Sessions } from "./auth/sessions.ts";
import { authRoutes } from "./auth/routes.ts";
import { personalRoutes } from "./personal/routes.ts";
import { syncRoutes } from "./personal/sync.ts";
import { lifecycleRoutes } from "./lifecycle/routes.ts";
import { pushRoutes } from "./push/routes.ts";
import { groupRoutes } from "./groups/routes.ts";
import { requestArea, RequestMetrics, type RequestDiagnostic } from "./operations/requests.ts";
import { browserSecurityHeaders } from "./browserPolicy.ts";

const contentTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
export async function createApp(config: ServerConfig, readiness: () => Promise<void>, log: (entry: object) => void = () => {}, sessions?: Sessions) {
  const directory = await realpath(resolve(config.staticDirectory));
  const previous = config.previousStaticDirectory ? await realpath(config.previousStaticDirectory) : null;
  const html = await readFile(resolve(directory, "index.html"), "utf8");
  if (!/<meta\s+name="rise-build"\s+content="production"/.test(html) || /name="rise-build"\s+content="review"/.test(html)) throw new Error("production_static_build_required");
  const webRelease=/<meta name="rise-release" content="([a-f0-9]{20})"/.exec(html)?.[1]??"unavailable";
  const metrics=new RequestMetrics(config.release,webRelease);
  // Diagnostic sink failures must never change a committed response.
  const safeLog=(entry:object)=>{try{log(entry);}catch{/* The private aggregate snapshot remains independent of this sink. */}};
  const app = Fastify({ logger: false, genReqId: () => randomUUID(), requestTimeout: 15000, connectionTimeout: 10000, bodyLimit: 65536, trustProxy: false, onProtoPoisoning: "error", onConstructorPoisoning: "error" });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id).header("X-Content-Type-Options", "nosniff").header("Referrer-Policy", "strict-origin-when-cross-origin").header("Cache-Control", "no-store");
    reply.headers(browserSecurityHeaders);
    if (request.headers.host !== new URL(config.origin).host || request.headers.origin && request.headers.origin !== config.origin) return reply.code(403).send({ error: "origin_not_allowed" });
    // Operational pause is server-owned and never changes authorization or drops queued intent.
    if (config.writesEnabled === false && !["GET", "HEAD", "OPTIONS"].includes(request.method)
      && request.url.split("?")[0].startsWith("/api/v1/") && request.url.split("?")[0] !== "/api/v1/logout") {
      return reply.code(503).header("Retry-After", "5").send({ error: { code: "unavailable", messageKey: "auth.unavailable", retryable: true, requestId: request.id } });
    }
  });
  app.decorate("operationsSnapshot",()=>metrics.snapshot());
  app.addHook("onResponse", async (request, reply) => {
    const entry:RequestDiagnostic={event:"request",requestId:request.id,area:requestArea(request.routeOptions.url),status:reply.statusCode,durationMs:Math.max(0,Math.min(60000,Math.round(reply.elapsedTime))),release:config.release,webRelease,at:new Date().toISOString()};
    metrics.record(entry);safeLog(entry);
  });
  app.setErrorHandler((error, request, reply) => {
    safeLog({ event: "request_failed", requestId: request.id, code:"request_failed", release:config.release, webRelease });
    const candidate = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
    const status = typeof candidate === "number" && candidate >= 400 && candidate < 500 ? candidate : 500;
    void reply.code(status).send({ error: status < 500 ? "invalid_request" : "request_failed" });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not_found" }));
  app.get("/api/v1/health/live", async () => ({ status: "ok" }));
  app.get("/api/v1/health/ready", async (_request, reply) => {
    try { await readiness(); return { status: "ready", release: config.release, webRelease }; }
    catch { return reply.code(503).send({ status: "unavailable" }); }
  });
  if (sessions) { authRoutes(app, config, sessions); personalRoutes(app, config, sessions); syncRoutes(app, config, sessions); lifecycleRoutes(app, config, sessions); pushRoutes(app,config,sessions); groupRoutes(app,config,sessions); }
  app.route({ method: ["GET", "HEAD"], url: "/*", handler: async (request, reply) => {
    let path: string;
    try { path = decodeURIComponent((request.raw.url ?? "/").split("?")[0]); } catch { return reply.code(400).send({ error: "invalid_path" }); }
    if (path === "/") path = "/index.html";
    const allowed = ["/index.html", "/manifest.webmanifest", "/notifications-sw.js", "/favicon.svg"].includes(path)
      || /^\/(assets|icons)\/[\w.-]+\.(js|css|png|svg|webp|woff2)$/.test(path);
    if (!allowed) return reply.code(404).send({ error: "not_found" });
    try {
      let base = directory;
      let file: string;
      try { file = await realpath(resolve(base, `.${path}`)); }
      catch {
        // Only immutable chunks may fall back. Never mix old HTML, worker, icons or API responses.
        if (!previous || !/^\/assets\/[\w.-]+-[\w-]{8}\.(js|css)$/.test(path)) throw new Error("not_found");
        base = previous; file = await realpath(resolve(base, `.${path}`));
      }
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) return reply.code(404).send({ error: "not_found" });
      reply.type(contentTypes[extname(file)]).header("Cache-Control", /-[\w-]{8}\.(js|css)$/.test(path) ? "public, max-age=31536000, immutable" : "no-cache");
      if (path === "/notifications-sw.js") reply.header("Service-Worker-Allowed", "/");
      return reply.send(createReadStream(file));
    } catch { return reply.code(404).send({ error: "not_found" }); }
  } });
  return app;
}
