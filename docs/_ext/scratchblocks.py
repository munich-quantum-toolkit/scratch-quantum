"""Render Scratch blocks with scratchblocks (https://scratchblocks.github.io).

The ``scratchblocks`` directive emits the block text in a ``<pre class="blocks">`` element.
The scratchblocks script, loaded on every page, turns those elements into block images.
"""

from __future__ import annotations

import html
from typing import TYPE_CHECKING, ClassVar

from docutils import nodes
from sphinx.util.docutils import SphinxDirective

if TYPE_CHECKING:
    from sphinx.application import Sphinx

SCRATCHBLOCKS_JS = "https://cdn.jsdelivr.net/npm/scratchblocks@3.7.1/build/scratchblocks.min.js"


class ScratchblocksDirective(SphinxDirective):
    """Show a script written in scratchblocks syntax."""

    has_content = True
    option_spec: ClassVar[dict] = {}

    def run(self) -> list[nodes.Node]:
        """Return a raw HTML node holding the escaped block text.

        Returns:
            The raw node.
        """
        text = html.escape("\n".join(self.content))
        return [nodes.raw("", f'<pre class="blocks">{text}</pre>\n', format="html")]


def setup(app: Sphinx) -> dict[str, bool]:
    """Register the directive and the scripts.

    Returns:
        The extension metadata.
    """
    app.add_directive("scratchblocks", ScratchblocksDirective)
    app.add_js_file(SCRATCHBLOCKS_JS)
    app.add_js_file("scratchblocks-init.js")
    return {"parallel_read_safe": True, "parallel_write_safe": True}
