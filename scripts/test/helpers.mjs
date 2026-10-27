import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scratch-quantum-test-"));
}

/** Write `files` ({ relativePath: content }) below `dir`. */
export function writeFiles(dir, files) {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

export function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

/** Wait until `condition()` is true, or throw after `timeout` milliseconds. */
export async function waitFor(condition, timeout = 5000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
