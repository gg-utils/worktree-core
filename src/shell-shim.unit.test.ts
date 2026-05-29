/**
 * @fileoverview Verifies argv parsing, usage rendering, and stdout/stderr behavior for the
 * worktree-discovery shell shim helpers.
 *
 * This file owns Node test runner regression coverage for `worktreeStackCoreShellShimParseArgv`,
 * `worktreeStackCoreShellShimRenderUsage`, and `worktreeStackCoreShellShimRun` with injectable
 * list hooks.
 * Flow: build argv/options -> invoke shim -> assert parsed shape, rendered usage, exit codes, and
 * sorted path output.
 *
 * @example
 * ```typescript
 * test("parses list-worktrees", () => {
 *   assert.deepEqual(
 *     worktreeStackCoreShellShimParseArgv([
 *       "list-worktrees",
 *       "--root",
 *       "/repo",
 *       "--mode",
 *       "prepared-only",
 *     ]),
 *     { command: "list-worktrees", mode: "prepared-only", root: "/repo" },
 *   );
 * });
 * ```
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 * @testing Node test runner (tsx): cd packages/worktree-core && npm test -- src/shell-shim.unit.test.ts
 *
 * @see packages/worktree-core/src/shell-shim.ts - Shell argv bridge and `run()` implementation whose parse, usage, and listing exit semantics are asserted here.
 * @see packages/worktree-core/src/worktree-discovery.ts - Prepared and registered worktree listing the production shim delegates to when callers omit injectable list functions, informing what sorted paths represent in integration.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  worktreeStackCoreShellShimParseArgv,
  worktreeStackCoreShellShimRenderUsage,
  worktreeStackCoreShellShimRun,
} from "./shell-shim.js";

test("worktreeStackCoreShellShimParseArgv parses list-worktrees mode", () => {
  assert.deepEqual(
    worktreeStackCoreShellShimParseArgv([
      "list-worktrees",
      "--root",
      "/repo",
      "--mode",
      "prepared-only",
    ]),
    {
      command: "list-worktrees",
      mode: "prepared-only",
      root: "/repo",
    },
  );
});

test("worktreeStackCoreShellShimRenderUsage includes the configured program name", () => {
  assert.match(
    worktreeStackCoreShellShimRenderUsage("shim-entry"),
    /Usage: shim-entry <command>/u,
  );
});

test("worktreeStackCoreShellShimRun lists sorted injected worktree paths", () => {
  let stdout = "";
  let stderr = "";
  const exitCode = worktreeStackCoreShellShimRun({
    argv: ["list-worktrees", "--root", "/repo", "--mode", "registered"],
    listRegisteredWorktrees: () => ["/repo/zeta", "/repo/alpha"],
    programName: "shim-entry",
    writeStderr: (text) => {
      stderr += text;
    },
    writeStdout: (text) => {
      stdout += text;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(stdout, "/repo/alpha\n/repo/zeta\n");
  assert.equal(stderr, "");
});

test("worktreeStackCoreShellShimRun returns usage errors without throwing", () => {
  let stderr = "";
  const exitCode = worktreeStackCoreShellShimRun({
    argv: ["list-worktrees", "--mode", "bad"],
    programName: "shim-entry",
    writeStderr: (text) => {
      stderr += text;
    },
    writeStdout: () => undefined,
  });

  assert.equal(exitCode, 2);
  assert.match(stderr, /--mode must be registered or prepared-only/u);
});
