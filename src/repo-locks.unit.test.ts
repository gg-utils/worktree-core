/**
 * @fileoverview Verifies product-neutral worktree-stack repo lock directory paths, slugging, and acquire/release behavior without touching a live git repository.
 *
 * This file owns Node `node:test` coverage for writer lock paths, hashed named locks, mutual exclusion via lock directories, and fail-fast rejection when foreign ownership metadata blocks acquisition.
 * Flow: assert computed paths -> acquire temp lock dir -> assert owner metadata -> release -> assert fail-fast errors when blocked.
 *
 * @testing Node.js built-in test runner: cd packages/worktree-core && node ../../node_modules/tsx/dist/cli.mjs --test src/repo-locks.unit.test.ts
 *
 * @see packages/worktree-core/src/repo-locks.ts - Filesystem lock helper implementation whose path rules, acquisition semantics, and release behavior are asserted here.
 * @see packages/worktree-kit/src/align-active.ts - Align-active orchestration that wraps repo mutations with the repo-lock helpers whose directory contract is verified here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  worktreeStackAcquireLockDir,
  worktreeStackNamedLockDir,
  worktreeStackReleaseLockDir,
  worktreeStackWriterLockDir,
} from "./repo-locks.js";

test("worktreeStackWriterLockDir resolves the historical repo writer lock path", () => {
  assert.equal(
    worktreeStackWriterLockDir("/repo"),
    path.join("/repo", ".tmp", "worktree-stack", "locks", "repo-writer.lock"),
  );
});

test("worktreeStackNamedLockDir slugifies and hashes resource keys", () => {
  const lockDir = worktreeStackNamedLockDir(
    "/repo",
    "scope",
    "feature branch/main",
  );
  assert.equal(
    path.dirname(lockDir),
    path.join("/repo", ".tmp", "worktree-stack", "locks", "scope"),
  );
  assert.match(
    path.basename(lockDir),
    /^feature-branch-main-[a-f0-9]{64}\.lock$/u,
  );
});

test("worktreeStackAcquireLockDir and release manage a filesystem lock", async () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-lock-"));
  const lockDir = worktreeStackNamedLockDir(sandbox, "scope", "resource");

  await worktreeStackAcquireLockDir(
    lockDir,
    "scope",
    "resource",
    "test",
    "fail-fast",
  );
  assert.equal(fs.statSync(lockDir).isDirectory(), true);
  assert.equal(
    fs.readFileSync(path.join(lockDir, "owner"), "utf8").trim(),
    "test",
  );

  await worktreeStackAcquireLockDir(
    lockDir,
    "scope",
    "resource",
    "test",
    "fail-fast",
  );
  worktreeStackReleaseLockDir(lockDir);
  assert.equal(fs.existsSync(lockDir), false);

  fs.rmSync(sandbox, { force: true, recursive: true });
});

test("worktreeStackAcquireLockDir fails fast when another process owns a lock", async () => {
  const sandbox = fs.mkdtempSync(
    path.join(os.tmpdir(), "worktree-lock-blocked-"),
  );
  const lockDir = worktreeStackNamedLockDir(sandbox, "scope", "resource");
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(path.join(lockDir, "pid"), "999999\n", "utf8");
  fs.writeFileSync(path.join(lockDir, "owner"), "other\n", "utf8");

  await assert.rejects(
    () =>
      worktreeStackAcquireLockDir(
        lockDir,
        "scope",
        "resource",
        "test",
        "fail-fast",
      ),
    /Another worktree-stack writer is already running/u,
  );

  fs.rmSync(sandbox, { force: true, recursive: true });
});
