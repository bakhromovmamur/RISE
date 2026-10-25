import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { pwaBuild } from "./scripts/pwa-build.ts";
import { backendBoundary, validatePublicEnvironment } from "./scripts/build-boundary.ts";
export default defineConfig(({ mode }) => {
  validatePublicEnvironment(loadEnv(mode, process.cwd(), "VITE_"), mode);
  return {
  plugins: [backendBoundary(), react(), pwaBuild(mode !== "review", process.env.RISE_BUILD_ID), {
    name: "rise-build-isolation",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "rise-build", content: mode === "review" ? "review" : "production" }, injectTo: "head" }];
    },
    generateBundle(_options, bundle) {
      if (mode === "review") return;
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        const unsafe = Object.keys(output.modules).find(id => /\/src\/(review\/|demo\.ts|DesignSystem\.tsx)/.test(id));
        if (unsafe) this.error(`Review code entered the production bundle: ${unsafe}`);
      }
    },
  }],
  base: "./",
  build: { outDir: mode === "review" ? "dist-review" : "dist" },
}; });
