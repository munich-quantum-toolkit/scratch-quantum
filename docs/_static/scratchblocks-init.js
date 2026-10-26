// Render every <pre class="blocks"> element (see docs/_ext/scratchblocks.py) as Scratch 3.0 blocks.
document.addEventListener("DOMContentLoaded", () => {
  scratchblocks.renderMatching("pre.blocks", {
    style: "scratch3",
    languages: ["en"],
    scale: 0.675,
  });
});
