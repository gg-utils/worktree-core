/**
 * @fileoverview Verifies product-neutral Git remote and branch helpers for worktree-stack repositories.
 *
 * This file owns Node `node:test` coverage for remote presence checks, upstream wiring, and checkout flows that mirror the git CLI contracts those helpers wrap.
 * Flow: scaffold temp repos with bare remotes -> call stack helpers -> assert refs and upstream names via follow-on `git` commands.
 *
 * @testing Node.js built-in test runner: cd packages/worktree-core && node ../../node_modules/tsx/dist/cli.mjs --test src/git-branches.unit.test.ts
 *
 * @see packages/worktree-core/src/git-branches.ts - Remote/branch helper implementation whose fetch, rev-parse, checkout, and upstream behavior is asserted here.
 * @see packages/worktree-core/src/git-worktree-sync.ts - Worktree sync layer that calls ensureBranchUpstream when reconciling local branches with configured remotes.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  worktreeStackCheckoutBranch,
  worktreeStackEnsureBranchUpstream,
  worktreeStackRemoteBranchExists,
  worktreeStackRemoteExists,
} from "./git-branches.js";

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

void test("worktreeStackRemoteExists reports configured remotes", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-remote-"));
  try {
    const repoDir = createCommittedRepository(sandboxRoot);
    const remoteDir = path.join(sandboxRoot, "remote.git");
    runGit(sandboxRoot, ["init", "--bare", remoteDir]);

    assert.equal(worktreeStackRemoteExists(repoDir, "origin"), false);
    runGit(repoDir, ["remote", "add", "origin", remoteDir]);
    assert.equal(worktreeStackRemoteExists(repoDir, "origin"), true);
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});

void test("worktreeStackEnsureBranchUpstream configures an existing remote branch", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-upstream-"));
  try {
    const repoDir = createCommittedRepository(sandboxRoot);
    const remoteDir = path.join(sandboxRoot, "remote.git");
    runGit(sandboxRoot, ["init", "--bare", remoteDir]);
    runGit(repoDir, ["remote", "add", "origin", remoteDir]);
    runGit(repoDir, ["push", "origin", "main"]);

    assert.equal(worktreeStackRemoteBranchExists(repoDir, "origin", "main"), true);
    assert.equal(worktreeStackEnsureBranchUpstream(repoDir, "main"), true);
    assert.equal(runGit(repoDir, ["rev-parse", "--abbrev-ref", "main@{upstream}"]), "origin/main");
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});

void test("worktreeStackCheckoutBranch creates a tracking branch from a remote branch", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-checkout-"));
  try {
    const sourceDir = createCommittedRepository(sandboxRoot);
    const remoteDir = path.join(sandboxRoot, "remote.git");
    const cloneDir = path.join(sandboxRoot, "clone");
    runGit(sandboxRoot, ["init", "--bare", remoteDir]);
    runGit(sourceDir, ["remote", "add", "origin", remoteDir]);
    runGit(sourceDir, ["checkout", "-b", "feature/demo"]);
    fs.writeFileSync(path.join(sourceDir, "feature.txt"), "feature\n", "utf8");
    runGit(sourceDir, ["add", "feature.txt"]);
    runGit(sourceDir, ["commit", "-m", "feature"]);
    runGit(sourceDir, ["push", "origin", "main", "feature/demo"]);
    runGit(sandboxRoot, ["clone", remoteDir, cloneDir]);
    runGit(cloneDir, ["checkout", "main"]);
    runGit(cloneDir, ["fetch", "origin", "feature/demo"]);

    worktreeStackCheckoutBranch(cloneDir, "feature/demo");

    assert.equal(runGit(cloneDir, ["branch", "--show-current"]), "feature/demo");
    assert.equal(
      runGit(cloneDir, ["rev-parse", "--abbrev-ref", "feature/demo@{upstream}"]),
      "origin/feature/demo",
    );
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});
