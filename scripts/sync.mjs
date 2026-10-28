import { main } from "./lib/cli.mjs";
import { layout, REPO_ROOT, REPOS, requireTrees } from "./lib/layout.mjs";
import { syncOverlay, watchOverlay } from "./lib/overlay.mjs";

function report(log, repo, { copied, removed }) {
  if (copied.length || removed.length)
    log(`${repo}: copied ${copied.length}, removed ${removed.length}`);
}

/** Copy vm/ and gui/ into the upstream trees in .upstream/. */
export function syncAll(root = REPO_ROOT, log = console.log) {
  const paths = layout(root);
  requireTrees(paths);
  for (const repo of REPOS)
    report(log, repo, syncOverlay(paths.overlayOptions(repo)));
}

/** Keep syncing vm/ and gui/ until the returned function is called. */
export function watchAll(root = REPO_ROOT, log = console.log) {
  const paths = layout(root);
  const stops = REPOS.map((repo) =>
    watchOverlay(paths.overlayOptions(repo), (result) =>
      report(log, repo, result),
    ),
  );
  return () => stops.forEach((stop) => stop());
}

main(import.meta.url, (args) => {
  syncAll();
  if (args.includes("--watch")) {
    watchAll();
    console.log("Watching vm/ and gui/. Press Ctrl+C to stop.");
  }
});
