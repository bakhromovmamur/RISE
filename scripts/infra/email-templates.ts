import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Docker mounts this public template as a file. Replacing its inode breaks the live mount. */
export async function copyEmailTemplate(source: string, target: string) {
  const content = await readFile(source);
  await mkdir(dirname(target), { recursive: true });
  try { if (content.equals(await readFile(target))) return; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeFile(target, content);
}
