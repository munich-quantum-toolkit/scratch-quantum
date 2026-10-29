import fs from "node:fs";
import path from "node:path";
import { main } from "./lib/cli.mjs";
import {
  applyPatches,
  cloneAt,
  hasTrackedChanges,
  head,
  patchFiles,
  untrackedFiles,
} from "./lib/git.mjs";
import { layout, readUpstream, REPO_ROOT, REPOS } from "./lib/layout.mjs";
import { syncOverlay } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import {
  decideSetupAction,
  hashPatches,
  readState,
  writeState,
} from "./lib/state.mjs";

/** Whether the tree holds work that is not in the patches: changes to tracked files, or new files that are not overlay copies. */
function hasLocalWork(paths, repo) {
  const tree = paths.tree(repo);
  if (hasTrackedChanges(tree)) return true;
  const { manifest } = paths.overlayOptions(repo);
  const overlay = new Set(
    fs.existsSync(manifest)
      ? JSON.parse(fs.readFileSync(manifest, "utf8"))
      : [],
  );
  return untrackedFiles(tree).some((file) => !overlay.has(file));
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

function createTree(paths, repo, pin, patches) {
  const tree = paths.tree(repo);
  fs.rmSync(paths.overlayOptions(repo).manifest, { force: true });
  try {
    cloneAt(tree, pin.repository, pin.commit);
    applyPatches(tree, patches);
  } catch (error) {
    // A half-made tree holds no work of yours; remove it so that the next run starts clean.
    fs.rmSync(tree, { recursive: true, force: true });
    throw error;
  }
}

// Does what `npm link` did in the old workflow, without a global install.
function linkVmIntoGui(paths) {
  const link = path.join(paths.tree("gui"), "node_modules", "scratch-vm");
  fs.rmSync(link, { recursive: true, force: true });
  if (process.platform === "win32")
    fs.symlinkSync(paths.tree("vm"), link, "junction");
  else
    fs.symlinkSync(path.relative(path.dirname(link), paths.tree("vm")), link);
}

/** Clone the pinned upstream repositories, apply the patches, sync the overlays and install dependencies. */
export function setup({
  root = REPO_ROOT,
  force = false,
  install = true,
  log = console.log,
} = {}) {
  const paths = layout(root);
  const upstream = readUpstream(root);
  const state = readState(paths.stateFile);
  // Decide for every repo before changing any of them, so that a stop for one repo leaves all trees as they were.
  const plans = REPOS.map((repo) => {
    const tree = paths.tree(repo);
    const patches = patchFiles(paths.patches(repo));
    const wanted = {
      commit: upstream[repo].commit,
      patches: hashPatches(patches),
    };
    const exists = fs.existsSync(tree);
    const action = decideSetupAction({
      exists,
      recorded: state[repo],
      wanted,
      head: exists ? head(tree) : undefined,
      dirty: exists && hasLocalWork(paths, repo),
      force,
    });
    if (action === "stop") {
      throw new Error(
        `.upstream/${repo} has changes that are not in patches/${repo}/ yet, and setup would replace it.\n` +
          `To keep them, commit them in .upstream/${repo} and run "npm run patches:update". ` +
          `To move .upstream/${repo} aside instead, run "npm run setup -- --force".`,
      );
    }
    return { repo, tree, patches, wanted, action };
  });
  for (const { repo, tree, patches, wanted, action } of plans) {
    if (action === "backup") {
      const backup = `${tree}.bak-${timestamp()}`;
      fs.renameSync(tree, backup);
      log(`Moved .upstream/${repo} to ${path.relative(root, backup)}`);
    }
    if (action === "recreate")
      fs.rmSync(tree, { recursive: true, force: true });
    if (action !== "keep") {
      log(
        `Setting up .upstream/${repo}: ${upstream[repo].version} with ${patches.length} patch(es)`,
      );
      createTree(paths, repo, upstream[repo], patches);
      state[repo] = { ...wanted, head: head(tree) };
      writeState(paths.stateFile, state);
    }
    syncOverlay(paths.overlayOptions(repo));
    if (
      install &&
      (action !== "keep" || !fs.existsSync(path.join(tree, "node_modules")))
    ) {
      try {
        // HUSKY=0 keeps upstream's commit hooks out of .upstream, so that patch commits need no special format.
        run("npm", ["ci"], { cwd: tree, env: { HUSKY: "0" } });
      } catch (error) {
        // A failed install can leave a partial node_modules, which the next run would keep. Remove it so that the next run installs again.
        fs.rmSync(path.join(tree, "node_modules"), {
          recursive: true,
          force: true,
        });
        throw error;
      }
    }
  }
  if (install) linkVmIntoGui(paths);
}

main(import.meta.url, (args) =>
  setup({
    force: args.includes("--force"),
    install: !args.includes("--skip-install"),
  }),
);
