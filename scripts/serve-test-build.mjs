import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { preview } from "vite";

const port = Number(process.argv[2]);
if (![4180, 4181, 4182].includes(port)) throw new Error("Use an isolated RISE test port: 4180, 4181 or 4182.");
const directory = process.argv[3] ?? "dist";
if (!["dist", "dist-review"].includes(directory)) throw new Error("Choose the completed production or review build.");
const source = resolve(directory);
const indexBefore = await readFile(join(source, "index.html"));
const snapshot = await mkdtemp(join(tmpdir(), "rise-test-build-"));
let server;
async function cleanup() {
  if (server) await new Promise((done, reject) => server.httpServer.close(error => error ? reject(error) : done()));
  await rm(snapshot, { recursive: true, force: true });
}

try {
  await cp(source, snapshot, { recursive: true });
  const [indexAfter, indexCopied] = await Promise.all([
    readFile(join(source, "index.html")), readFile(join(snapshot, "index.html")),
  ]);
  if (!indexBefore.equals(indexAfter) || !indexBefore.equals(indexCopied)) {
    throw new Error("The build changed while taking the test snapshot. Finish the build, then rerun tests.");
  }
  server = await preview({
    configFile: false,
    base: "./",
    build: { outDir: snapshot },
    preview: { host: "127.0.0.1", port, strictPort: true },
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await cleanup();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.log(`RISE isolated build ready at http://127.0.0.1:${port}`);
} catch (error) {
  await cleanup();
  throw error;
}
