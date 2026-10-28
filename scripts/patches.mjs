import { main } from "./lib/cli.mjs";
import { formatPatches, hasTrackedChanges, head } from "./lib/git.mjs";
import {
  layout,
  readUpstream,
  REPO_ROOT,
  REPOS,
  requireTrees,
} from "./lib/layout.mjs";
import { hashPatches, readState, writeState } from "./lib/state.mjs";

/** Write the commits in .upstream/<repo> on top of the pinned commit to patches/<repo>/. */
export function updatePatches({ root = REPO_ROOT, log = console.log } = {}) {
  const paths = layout(root);
  requireTrees(paths);
  for (const repo of REPOS) {
    if (hasTrackedChanges(paths.tree(repo))) {
      throw new Error(
        `.upstream/${repo} has uncommitted changes to upstream files. ` +
          `Commit them in .upstream/${repo} first, then run "npm run patches:update" again.`,
      );
    }
  }
  const upstream = readUpstream(root);
  const state = readState(paths.stateFile);
  for (const repo of REPOS) {
    const files = formatPatches(
      paths.tree(repo),
      upstream[repo].commit,
      paths.patches(repo),
    );
    // Record the result, so that the next setup keeps this tree instead of replacing it.
    state[repo] = {
      commit: upstream[repo].commit,
      patches: hashPatches(files),
      head: head(paths.tree(repo)),
    };
    log(`patches/${repo}: ${files.length} patch(es)`);
  }
  writeState(paths.stateFile, state);
}

main(import.meta.url, () => updatePatches());
