/**
 * @fileoverview Verifies product-neutral worktree branch-prefix helpers for slug normalization,
 * invalid slug rejection, branch token parse/build, and known-prefix classification.
 *
 * This file owns Node test runner regression coverage for the prefix contract consumed by
 * worktree-stack CLIs.
 * Flow: normalize input prefix -> extract prefix/stack from branch names -> join segments -> assert known-prefix membership.
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 *
 * @see packages/worktree-core/src/prefix.ts - Branch-prefix helpers and slug invariants whose behavior is asserted by the tests in this file.
 * @see packages/worktree-kit/src/switch-command.ts - Worktree switch CLI that lists known prefixes and applies worktreeStackNormalizeBranchPrefix using the same contract validated here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
  WORKTREE_STACK_KNOWN_PREFIXES,
  worktreeStackBuildBranchName,
  worktreeStackExtractBranchPrefix,
  worktreeStackIsKnownPrefix,
  worktreeStackNormalizeBranchPrefix,
} from "./prefix.js";

test("worktreeStackNormalizeBranchPrefix normalizes blanks and valid slugs", () => {
  assert.equal(
    worktreeStackNormalizeBranchPrefix(""),
    WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
  );
  assert.equal(
    worktreeStackNormalizeBranchPrefix("   "),
    WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
  );
  assert.equal(
    worktreeStackNormalizeBranchPrefix("Antigravity"),
    "antigravity",
  );
  assert.equal(worktreeStackNormalizeBranchPrefix("  claude  "), "claude");
  assert.equal(worktreeStackNormalizeBranchPrefix("my-editor"), "my-editor");
});

test("worktreeStackNormalizeBranchPrefix rejects invalid slug prefixes", () => {
  assert.throws(
    () => worktreeStackNormalizeBranchPrefix("1bad"),
    /Invalid branch prefix/u,
  );
  assert.throws(
    () => worktreeStackNormalizeBranchPrefix("bad!chars"),
    /Invalid branch prefix/u,
  );
  assert.throws(
    () => worktreeStackNormalizeBranchPrefix("A_B"),
    /Invalid branch prefix/u,
  );
  assert.throws(
    () => worktreeStackNormalizeBranchPrefix("-bad"),
    /Invalid branch prefix/u,
  );
});

test("worktreeStackExtractBranchPrefix splits branch tokens", () => {
  assert.deepEqual(worktreeStackExtractBranchPrefix("codex/fix-auth"), {
    prefix: "codex",
    stackName: "fix-auth",
  });
  assert.deepEqual(worktreeStackExtractBranchPrefix("antigravity/fix-auth"), {
    prefix: "antigravity",
    stackName: "fix-auth",
  });
  assert.deepEqual(worktreeStackExtractBranchPrefix("main"), {
    prefix: WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
    stackName: "main",
  });
  assert.deepEqual(worktreeStackExtractBranchPrefix("a/b/c"), {
    prefix: "a",
    stackName: "b/c",
  });
  assert.deepEqual(worktreeStackExtractBranchPrefix("/fix-auth"), {
    prefix: WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
    stackName: "/fix-auth",
  });
  assert.deepEqual(worktreeStackExtractBranchPrefix("codex/"), {
    prefix: WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
    stackName: "codex/",
  });
});

test("worktreeStackBuildBranchName joins prefix and stack name", () => {
  assert.equal(
    worktreeStackBuildBranchName("codex", "fix-auth"),
    "codex/fix-auth",
  );
  assert.equal(
    worktreeStackBuildBranchName("antigravity", "mgr-copy"),
    "antigravity/mgr-copy",
  );
});

test("worktreeStackIsKnownPrefix identifies known and unknown prefixes", () => {
  for (const prefix of WORKTREE_STACK_KNOWN_PREFIXES) {
    assert.equal(worktreeStackIsKnownPrefix(prefix), true);
  }
  assert.equal(worktreeStackIsKnownPrefix("unknown-editor"), false);
});
