import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { PWA_CONTRACT } from "../src/pwa/protocol.ts";
import { browserSecurityHeaders } from "../server/browserPolicy.ts";

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
/** A fixed public-file allowlist, finalized after Vite copies public/ and emits worker chunks. */
export function pwaBuild(enabled: boolean, publication = ""): Plugin {
  if (publication && !/^[a-f0-9]{32}$/.test(publication)) throw new Error("invalid_publication_id");
  let output = "";
  return {
    name: "rise-pwa",
    apply: "build",
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    transformIndexHtml() {
      return enabled ? [
        { tag: "link", attrs: { rel: "manifest", href: "/manifest.webmanifest" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "apple-mobile-web-app-capable", content: "yes" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "apple-mobile-web-app-title", content: "RISE" }, injectTo: "head" },
      ] : [];
    },
    async closeBundle() {
      if (!enabled) return;
      async function files(directory: string, prefix = ""): Promise<string[]> {
        const entries = await readdir(directory, { withFileTypes: true });
        return (await Promise.all(entries.map(entry => entry.isDirectory()
          ? files(join(directory, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`]))).flat();
      }
      const paths = (await files(output)).filter(path => path === "index.html" || path === "manifest.webmanifest" || path === "favicon.svg"
        || /^(assets|icons)\/[^?#]+\.(js|css|png|svg|webp|woff2)$/.test(path)).sort();
      const template = await readFile(join(output, "notifications-sw.js"), "utf8");
      const contents = await Promise.all(paths.map(path => readFile(join(output, path))));
      const release = digest(publication + template + PWA_CONTRACT + JSON.stringify(browserSecurityHeaders) + paths.map((path, index) => `${path}:${digest(contents[index])}`).join("\n")).slice(0, 20);
      const index = paths.indexOf("index.html");
      if (index < 0) throw new Error("PWA shell was not emitted");
      contents[index] = Buffer.from(contents[index].toString().replace("</head>", `<meta name="rise-release" content="${release}"></head>`));
      await writeFile(join(output, "index.html"), contents[index]);
      const build = { release, contract: PWA_CONTRACT, assets: paths.map((path, i) => ({ url: `/${path}`, sha256: digest(contents[i]) })) };
      if (!template.includes("/* RISE_BUILD */ null")) throw new Error("PWA build marker missing");
      await writeFile(join(output, "notifications-sw.js"), template.replace("/* RISE_BUILD */ null", JSON.stringify(build)));
    },
  };
}
