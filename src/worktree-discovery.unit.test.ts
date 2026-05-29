/**
 * @fileoverview Verifies product-neutral prepared-worktree discovery helpers for JSON metadata
 * reads, default worktrees-base resolution, folder naming, path helpers, and slot accounting.
 *
 * This file owns regression coverage for `worktree-discovery` helpers using ephemeral git
 * worktrees and temp directories. Flow: scaffold sandbox -> invoke helpers -> assert paths and
 * slot bookkeeping.
 *
 * @testing Node.js test runner (tsx): npm run worktree-core:test
 *
 * @see packages/worktree-core/src/worktree-discovery.ts - Discovery helpers under test for metadata paths, slot collection, canonical root resolution, and related stack primitives.
 * @see packages/worktree-core/package.json - Declares the tsx-driven `npm test` entry that runs this file and sibling `*.unit.test.ts` specs.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  worktreeStackBuildFolderName,
  worktreeStackCollectUsedSlots,
  worktreeStackHandbookJsonPathForWorktree,
  worktreeStackMetadataPathForWorktree,
  worktreeStackPickNextSlot,
  worktreeStackReadJsonField,
  worktreeStackResolveDefaultWorktreesBase,
  worktreeStackResolvePreparedCanonicalRootWorkspacePath,
} from "./worktree-discovery.js";

function runGit(cwd: string, args: readonly string[]): void {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git failed: ${args.join(" ")}`,
    );
  }
}

function writeSlotMetadata(worktreePath: string, slot: number): void {
  const metadataDirectory = path.join(worktreePath, ".tmp", "worktree-stack");
  fs.mkdirSync(metadataDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(metadataDirectory, "metadata.json"),
    JSON.stringify({ slot }),
    "utf8",
  );
}

test("worktreeStackReadJsonField reads nested scalar fields", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-json-"));
  try {
    const metadataPath = path.join(sandbox, "metadata.json");
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({ nested: { count: 12, name: "stack" }, skip: true }),
      "utf8",
    );

    assert.equal(worktreeStackReadJsonField(metadataPath, "nested.name"), "stack");
    assert.equal(worktreeStackReadJsonField(metadataPath, "nested.count"), "12");
    assert.equal(worktreeStackReadJsonField(metadataPath, "skip"), null);
    assert.equal(worktreeStackReadJsonField(metadataPath, "missing"), null);
  } finally {
    fs.rmSync(sandbox, { force: true, recursive: true });
  }
});

test("worktreeStackResolveDefaultWorktreesBase uses a configured directory name", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-base-"));
  try {
    const repoRoot = path.join(sandbox, "repo");
    const nestedRepoRoot = path.join(sandbox, "prepared-worktrees", "repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.mkdirSync(nestedRepoRoot, { recursive: true });

    assert.equal(
      worktreeStackResolveDefaultWorktreesBase({
        defaultWorktreesDirectoryName: "prepared-worktrees",
        projectRoot: repoRoot,
      }),
      path.join(sandbox, "prepared-worktrees"),
    );
    assert.equal(
      worktreeStackResolveDefaultWorktreesBase({
        defaultWorktreesDirectoryName: "prepared-worktrees",
        projectRoot: nestedRepoRoot,
      }),
      path.join(sandbox, "prepared-worktrees"),
    );
  } finally {
    fs.rmSync(sandbox, { force: true, recursive: true });
  }
});

test("worktreeStackBuildFolderName derives stable compact folder tokens", () => {
  assert.equal(
    worktreeStackBuildFolderName("260520", "worktree-7", "feature/demo"),
    "260520WT07-FEATURE-DEMO",
  );
  assert.equal(
    worktreeStackBuildFolderName("260520", "alpha-beta-123", "***"),
    "260520RAB123-STACK",
  );
});

test("worktree metadata path helpers and canonical fallback stay stable", () => {
  const worktreePath = path.join("/repo", "prepared");
  assert.equal(
    worktreeStackMetadataPathForWorktree(worktreePath),
    path.join(worktreePath, ".tmp", "worktree-stack", "metadata.json"),
  );
  assert.equal(
    worktreeStackHandbookJsonPathForWorktree(worktreePath),
    path.join(worktreePath, ".tmp", "worktree-stack", "worktree-info.json"),
  );
  assert.equal(
    worktreeStackResolvePreparedCanonicalRootWorkspacePath(
      worktreePath,
      "/fallback",
    ),
    "/fallback",
  );
});

test("worktreeStackPickNextSlot finds the first unused registered prepared-worktree slot", () => {
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-slot-"));
  try {
    const repoRoot = path.join(sandboxRoot, "repo");
    const worktreeOne = path.join(sandboxRoot, "wt-1");
    const worktreeTwo = path.join(sandboxRoot, "wt-2");

    fs.mkdirSync(repoRoot, { recursive: true });
    runGit(repoRoot, ["init", "-b", "main"]);
    runGit(repoRoot, ["config", "user.email", "worktree-core@example.test"]);
    runGit(repoRoot, ["config", "user.name", "Worktree Core Tests"]);
    fs.writeFileSync(path.join(repoRoot, "README.md"), "root\n", "utf8");
    runGit(repoRoot, ["add", "README.md"]);
    runGit(repoRoot, ["commit", "-m", "initial"]);

    runGit(repoRoot, ["worktree", "add", "-b", "test/wt-1", worktreeOne]);
    runGit(repoRoot, ["worktree", "add", "-b", "test/wt-2", worktreeTwo]);

    writeSlotMetadata(worktreeOne, 1);
    writeSlotMetadata(worktreeTwo, 3);

    assert.deepEqual(worktreeStackCollectUsedSlots(repoRoot), [1, 3]);
    assert.equal(worktreeStackPickNextSlot(repoRoot), 2);
  } finally {
    fs.rmSync(sandboxRoot, { force: true, recursive: true });
  }
});
