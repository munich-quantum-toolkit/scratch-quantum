import assert from "node:assert/strict";
import { test } from "node:test";
import { testFiles } from "../test.mjs";
import { tempDir, writeFiles } from "./helpers.mjs";

test("by default, npm test runs the unit and integration tests of the extension", () => {
  const root = tempDir();
  writeFiles(root, {
    "vm/test/unit/extension_quantum_b.js": "",
    "vm/test/unit/extension_quantum_a.js": "",
    "vm/test/unit/helper.js": "",
    "vm/test/integration/quantum_c.js": "",
    "vm/test/fixtures/quantum/extension_quantum_x.js": "",
  });
  assert.deepEqual(testFiles(root, []), [
    "test/unit/extension_quantum_a.js",
    "test/unit/extension_quantum_b.js",
    "test/integration/quantum_c.js",
  ]);
});

test("given files are passed on relative to vm/", () => {
  assert.deepEqual(
    testFiles(tempDir(), ["vm/test/unit/x.js", "test/unit/y.js"]),
    ["test/unit/x.js", "test/unit/y.js"],
  );
});
