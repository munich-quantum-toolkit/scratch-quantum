import fs from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Run `fn` with the command-line arguments if the module at `metaUrl` was started with `node`,
 * and report errors as a message and exit code 1.
 */
export function main(metaUrl, fn) {
  const entry = process.argv[1];
  if (!entry || metaUrl !== pathToFileURL(fs.realpathSync(entry)).href) return;
  Promise.resolve()
    .then(() => fn(process.argv.slice(2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
