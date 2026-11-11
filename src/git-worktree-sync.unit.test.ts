/**
 * @fileoverview Verifies product-neutral Git worktree sync helpers for worktree registration,
 * detached checkout attachment, and `.gitmodules` submodule branch resolution.
 *
 * This file owns Node.js test-runner regression coverage that shells out to real `git` commands
 * against repositories created under `os.tmpdir()`.
 * Flow: temp sandbox repo -> run git porcelain and ref operations -> assert helper outputs.
 *
 * @example
 * ```typescript
 * import assert from "node:assert/strict";
 * import { worktreeStackGitWorktreeRegistered } from "./git-worktree-sync.js";
 *
 * assert.equal(worktreeStackGitWorktreeRegistered(repoRoot, resolvedWorktreePath), true);
 * ```
 *
 * @testing Node.js test runner unit: cd packages/worktree-core && node ../../node_modules/tsx/dist/cli.mjs --test src/git-worktree-sync.unit.test.ts
 * @testing Node.js test runner unit: npm run worktree-core:test
 *
 * @see packages/worktree-core/src/git-worktree-sync.ts - Worktree sync helpers under test for porcelain-backed registration, checkout attach semantics, and gitmodules branch reads.
 * @see packages/worktree-core/src/worktree-discovery.ts - Registered worktree listing used indirectly by the registration helpers asserted in this suite.
 * @see docs/TYPESCRIPT_STANDARDS_DOCUMENTATION_FILE_OVERVIEWS.md - File-overview contract this header follows for verification and cross-agent orientation.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  worktreeStackAttachExpectedBranch,
  worktreeStackCheckoutCanAttachExpectedBranch,
  worktreeStackCheckoutMatchesExpectedBranch,
  worktreeStackCurrentCheckoutDescription,
  worktreeStackGitWorktreeRegistered,
  worktreeStackResolveGitmodulesSubmoduleBranch,
} from "./git-worktree-sync.js";

function runGit(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git failed: ${args.join(" ")}`,
    );
  }
  return result.stdout.trim();
}

function createCommittedRepository(sandboxRoot: string): string {
  const repoDir = path.join(sandboxRoot, "repo");
  fs.mkdirSync(repoDir, { recursive: true });
  runGit(repoDir, ["init", "-b", "main"]);
  runGit(repoDir, ["config", "user.email", "worktree-core@example.test"]);
  runGit(repoDir, ["config", "user.name", "Worktree Core Tests"]);
  fs.writeFileSync(path.join(repoDir, "README.md"), "root\n", "utf8");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "initial"]);
  return repoDir;
}

void test("worktree registration checks read git worktree porcelain output", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-registered-"));
  try {
    const repoDir = createCommittedRepository(sandboxRoot);
    const worktreeDir = path.join(sandboxRoot, "wt-feature");
    runGit(repoDir, ["worktree", "add", "-b", "feature/demo", worktreeDir]);

    assert.equal(
      worktreeStackGitWorktreeRegistered(repoDir, fs.realpathSync(worktreeDir)),
      true,
    );
    assert.equal(
      worktreeStackGitWorktreeRegistered(repoDir, path.join(sandboxRoot, "missing")),
      false,
    );
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});

void test("checkout helpers recognize and attach safe detached branch tips", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-attach-"));
  try {
    const repoDir = createCommittedRepository(sandboxRoot);
    runGit(repoDir, ["checkout", "-b", "feature/demo"]);
    fs.writeFileSync(path.join(repoDir, "feature.txt"), "feature\n", "utf8");
    runGit(repoDir, ["add", "feature.txt"]);
    runGit(repoDir, ["commit", "-m", "feature"]);
    const featureSha = runGit(repoDir, ["rev-parse", "HEAD"]);
    runGit(repoDir, ["checkout", "--detach", featureSha]);

    assert.match(worktreeStackCurrentCheckoutDescription(repoDir), /^detached@/u);
    assert.equal(
      worktreeStackCheckoutMatchesExpectedBranch(repoDir, "feature/demo"),
      true,
    );
    assert.equal(
      worktreeStackCheckoutCanAttachExpectedBranch(repoDir, "feature/demo"),
      true,
    );

    worktreeStackAttachExpectedBranch(repoDir, "feature/demo");
    assert.equal(runGit(repoDir, ["branch", "--show-current"]), "feature/demo");
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});

void test("worktreeStackResolveGitmodulesSubmoduleBranch reads configured branches", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-gitmodules-"));
  try {
    const gitmodulesPath = path.join(sandboxRoot, ".gitmodules");
    fs.writeFileSync(
      gitmodulesPath,
      [
        '[submodule "packages/core"]',
        "\tpath = packages/core",
        "\turl = git@example.test:core.git",
        "\tbranch = development",
        "",
      ].join("\n"),
      "utf8",
    );

    assert.equal(
      worktreeStackResolveGitmodulesSubmoduleBranch(
        gitmodulesPath,
        "packages/core",
      ),
      "development",
    );
    assert.equal(
      worktreeStackResolveGitmodulesSubmoduleBranch(
        path.join(sandboxRoot, "missing.gitmodules"),
        "packages/core",
      ),
      "main",
    );
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});
