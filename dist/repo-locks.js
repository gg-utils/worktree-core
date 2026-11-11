/**
 * @fileoverview Owns product-neutral filesystem mutex directories that serialize worktree-stack repo
 * writers and multi-repo synchronization gates across nested worktrees sharing one git common-dir.
 *
 * Flow: lock scope/resource key -> lock directory acquisition -> guarded repo mutation -> release.
 *
 * @testing Jest unit: npm run worktree-core:test
 * @see packages/worktree-core/src/foundation.ts - Git subprocess helpers, structured logging, timing, JSON escaping, and fatal error reporting this module uses while emitting lock diagnostics and resolving canonical git common-dir paths.
 * @see packages/worktree-kit/src/align-active.ts - Align-active core that wraps submodule and root git mutations in worktreeStackWithRepoMutationLock so nested worktrees contend using the resource keys derived in this module.
 * @see packages/worktree-core/src/repo-locks.unit.test.ts - Jest regression module covering writer and named lock directory layout, acquisition wait versus fail-fast paths, and per-process release semantics for exports defined here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { worktreeStackError, worktreeStackInfo, worktreeStackJsonEscape, worktreeStackMeasureDurationMs, worktreeStackNowMs, worktreeStackPrintKv, worktreeStackRunGit, } from "./foundation.js";
const worktreeStackActiveLockDirs = new Set();
/**
 * Computes a stable SHA-256 hex digest for lock namespacing and related keys.
 *
 * @remarks
 * PURITY: Deterministic for the same input; no I/O.
 */
function worktreeStackLockHash(rawValue) {
    return createHash("sha256").update(rawValue).digest("hex");
}
/** Returns the lock directory path for serialized writer access to a repo. */
export function worktreeStackWriterLockDir(rootDir) {
    return path.join(rootDir, ".tmp", "worktree-stack", "locks", "repo-writer.lock");
}
/** Returns a namespaced lock directory path derived from a scope and resource key. */
export function worktreeStackNamedLockDir(rootDir, scope, resourceKey) {
    const resourceHash = worktreeStackLockHash(resourceKey);
    const resourceSlug = resourceKey
        .replace(/[^A-Za-z0-9._-]+/gu, "-")
        .replace(/^-+/u, "")
        .replace(/-+$/u, "")
        .replace(/-+/gu, "-")
        .slice(0, 48) || "resource";
    return path.join(rootDir, ".tmp", "worktree-stack", "locks", scope, `${resourceSlug}-${resourceHash}.lock`);
}
/**
 * Reads and trims a lock metadata file when present, otherwise returns an empty string.
 *
 * @remarks
 * I/O: Synchronous read under `lockDir`.
 */
function worktreeStackReadLockFile(lockDir, fileName) {
    const filePath = path.join(lockDir, fileName);
    if (!fs.existsSync(filePath)) {
        return "";
    }
    return fs.readFileSync(filePath, "utf8").trim();
}
/**
 * Appends a JSON line describing a lock event when `WORKTREE_STACK_LOCK_EVENTS_FILE` is set.
 *
 * @remarks
 * I/O: Creates parent directories and appends; no-op when the environment variable is unset.
 */
function worktreeStackEmitLockEvent(outcome, scope, resourceKey, ownerLabel, waitMs, lockDir, pidValue) {
    const eventsFile = process.env.WORKTREE_STACK_LOCK_EVENTS_FILE;
    if (!eventsFile) {
        return;
    }
    fs.mkdirSync(path.dirname(eventsFile), { recursive: true });
    const payload = [
        "{",
        `"timestamp":"${worktreeStackJsonEscape(new Date().toISOString())}"`,
        `"outcome":"${worktreeStackJsonEscape(outcome)}"`,
        `"scope":"${worktreeStackJsonEscape(scope)}"`,
        `"resourceKey":"${worktreeStackJsonEscape(resourceKey)}"`,
        `"owner":"${worktreeStackJsonEscape(ownerLabel)}"`,
        `"waitMs":${String(waitMs)}`,
        `"lockDir":"${worktreeStackJsonEscape(lockDir)}"`,
        `"pid":"${worktreeStackJsonEscape(pidValue)}"`,
        "}",
    ];
    fs.appendFileSync(eventsFile, [
        payload[0],
        payload.slice(1, -1).join(","),
        payload[payload.length - 1],
        "\n",
    ].join(""), "utf8");
}
/**
 * Prints held-lock metadata when any diagnostic field is populated.
 *
 * @remarks
 * I/O: Stdout only via `worktreeStackPrintKv`.
 */
function worktreeStackPrintHeldLockDirDiagnostics(options) {
    const { lockDir, lockOwner, lockPid, lockStartedAt, lockCwd } = options;
    // Empty metadata usually means a missing/stale lock file; avoid printing a noisy lock section.
    if (!lockOwner && !lockPid && !lockStartedAt && !lockCwd) {
        return;
    }
    worktreeStackPrintKv("lock-dir", lockDir);
    if (lockOwner) {
        worktreeStackPrintKv("lock-owner", lockOwner);
    }
    if (lockPid) {
        worktreeStackPrintKv("lock-pid", lockPid);
    }
    if (lockStartedAt) {
        worktreeStackPrintKv("lock-started-at", lockStartedAt);
    }
    if (lockCwd) {
        worktreeStackPrintKv("lock-cwd", lockCwd);
    }
}
/**
 * Acquires a filesystem mutex directory used to serialize destructive repo mutations.
 *
 * @remarks
 * I/O: Creates lock metadata files under `lockDir`, appends JSONL events, and may busy-wait when `waitMode` is `"wait"`.
 * @throws Never returns when another writer holds the lock in `fail-fast` mode; calls `worktreeStackError` instead.
 */
export async function worktreeStackAcquireLockDir(lockDir, scope, resourceKey, ownerLabel, waitMode = "fail-fast") {
    fs.mkdirSync(path.dirname(lockDir), { recursive: true });
    const waitStartedAtMs = worktreeStackNowMs();
    let firstWaitNotice = true;
    while (true) {
        if (worktreeStackActiveLockDirs.has(lockDir) && fs.existsSync(lockDir)) {
            worktreeStackInfo(`Reusing inherited ${scope} lock: ${lockDir}`);
            worktreeStackEmitLockEvent("reused", scope, resourceKey, ownerLabel, 0, lockDir, String(process.pid));
            return;
        }
        try {
            fs.mkdirSync(lockDir);
            const waitFinishedAtMs = worktreeStackNowMs();
            const waitMs = worktreeStackMeasureDurationMs(waitStartedAtMs, waitFinishedAtMs);
            fs.writeFileSync(path.join(lockDir, "pid"), `${process.pid}\n`, "utf8");
            fs.writeFileSync(path.join(lockDir, "owner"), `${ownerLabel}\n`, "utf8");
            fs.writeFileSync(path.join(lockDir, "scope"), `${scope}\n`, "utf8");
            fs.writeFileSync(path.join(lockDir, "resource-key"), `${resourceKey}\n`, "utf8");
            fs.writeFileSync(path.join(lockDir, "started-at"), `${new Date().toISOString()}\n`, "utf8");
            fs.writeFileSync(path.join(lockDir, "cwd"), `${process.cwd()}\n`, "utf8");
            worktreeStackActiveLockDirs.add(lockDir);
            worktreeStackInfo(`Acquired ${scope} lock: ${lockDir}`);
            worktreeStackEmitLockEvent("acquired", scope, resourceKey, ownerLabel, waitMs, lockDir, String(process.pid));
            return;
        }
        catch (error) {
            if (!(error instanceof Error) ||
                !("code" in error) ||
                error.code !== "EEXIST") {
                throw error;
            }
            const lockPid = worktreeStackReadLockFile(lockDir, "pid");
            const lockOwner = worktreeStackReadLockFile(lockDir, "owner");
            const lockStartedAt = worktreeStackReadLockFile(lockDir, "started-at");
            const lockCwd = worktreeStackReadLockFile(lockDir, "cwd");
            if (waitMode !== "wait") {
                worktreeStackEmitLockEvent("blocked", scope, resourceKey, ownerLabel, 0, lockDir, lockPid);
                worktreeStackError("Another worktree-stack writer is already running. Only one align-active/merge/update-from-main push flow may mutate this repo at a time.");
            }
            if (firstWaitNotice) {
                worktreeStackInfo(`Waiting for ${scope} lock: ${resourceKey}`);
                firstWaitNotice = false;
            }
            worktreeStackPrintHeldLockDirDiagnostics({
                lockDir,
                lockOwner,
                lockPid,
                lockStartedAt,
                lockCwd,
            });
            await delay(200);
        }
    }
}
/**
 * Removes a lock directory when it belongs to the current process, otherwise no-ops safely.
 *
 * @remarks
 * I/O: Deletes lock marker files on disk; updates the in-process active lock registry.
 */
export function worktreeStackReleaseLockDir(lockDir) {
    if (!lockDir) {
        return;
    }
    if (!fs.existsSync(lockDir) || !fs.statSync(lockDir).isDirectory()) {
        worktreeStackActiveLockDirs.delete(lockDir);
        return;
    }
    const lockPid = worktreeStackReadLockFile(lockDir, "pid");
    if (lockPid && lockPid !== String(process.pid)) {
        worktreeStackActiveLockDirs.delete(lockDir);
        return;
    }
    const lockScope = worktreeStackReadLockFile(lockDir, "scope");
    fs.rmSync(lockDir, { force: true, recursive: true });
    worktreeStackActiveLockDirs.delete(lockDir);
    if (lockScope) {
        worktreeStackInfo(`Released ${lockScope} lock: ${lockDir}`);
    }
    else {
        worktreeStackInfo(`Released lock: ${lockDir}`);
    }
}
/** Releases every lock directory tracked for this process in LIFO order. */
export function worktreeStackReleaseAllNamedLocks() {
    for (const lockDir of [...worktreeStackActiveLockDirs].reverse()) {
        worktreeStackReleaseLockDir(lockDir);
    }
}
/**
 * Acquires the repo-wide batch writer lock that blocks concurrent align/merge/update pushes.
 *
 * @remarks
 * PRE-CONDITION: Callers should already be in a single-writer orchestration path; lock is fail-fast.
 */
export async function worktreeStackAcquireRepoWriterLock(rootDir, ownerLabel) {
    await worktreeStackAcquireLockDir(worktreeStackWriterLockDir(rootDir), "batch-writer", rootDir, ownerLabel, "fail-fast");
}
/** Releases the batch writer lock directory for `rootDir` when owned by this process. */
export function worktreeStackReleaseRepoWriterLock(rootDir) {
    worktreeStackReleaseLockDir(worktreeStackWriterLockDir(rootDir));
}
/**
 * Resolves the shared git common directory for `repoDir`, tolerating absolute or relative `rev-parse` output.
 *
 * @remarks
 * I/O: Invokes `git rev-parse` twice as a compatibility shim across worktree layouts.
 */
export function worktreeStackCanonicalGitCommonDir(repoDir) {
    const absoluteResult = worktreeStackRunGit(repoDir, ["rev-parse", "--path-format=absolute", "--git-common-dir"], { allowFailure: true });
    const absoluteValue = absoluteResult.stdout.trim();
    if (absoluteResult.status === 0 && absoluteValue.length > 0) {
        return absoluteValue;
    }
    const relativeResult = worktreeStackRunGit(repoDir, ["rev-parse", "--git-common-dir"], {
        allowFailure: true,
    });
    const relativeValue = relativeResult.stdout.trim();
    if (relativeResult.status !== 0 || relativeValue.length === 0) {
        worktreeStackError(`Could not resolve git common-dir for repository: ${repoDir}`);
    }
    if (path.isAbsolute(relativeValue)) {
        return relativeValue;
    }
    return path.resolve(repoDir, relativeValue);
}
/**
 * Derives the mutex resource key for a repository from its canonical git common directory path.
 *
 * @remarks
 * Ensures nested worktrees sharing one `.git` directory contend for a single repo-mutation lock.
 */
function worktreeStackRepoMutationResourceKey(repoDir) {
    return worktreeStackCanonicalGitCommonDir(repoDir);
}
/**
 * Builds the resource key for root-level main-branch synchronization locks.
 *
 * @remarks
 * Combines `rootDir` and `targetBranch` so concurrent stack operations do not share one mutex incorrectly.
 */
function worktreeStackRootMainSyncResourceKey(rootDir, targetBranch) {
    return `${rootDir}:${targetBranch}`;
}
/**
 * Serializes git mutations for a single repository directory (root or submodule) inside a stack run.
 *
 * @remarks
 * Resource key derives from `worktreeStackCanonicalGitCommonDir` so nested worktrees share one mutex.
 */
export async function worktreeStackAcquireRepoMutationLock(rootDir, repoDir, ownerLabel, waitMode = "wait") {
    const resourceKey = worktreeStackRepoMutationResourceKey(repoDir);
    await worktreeStackAcquireLockDir(worktreeStackNamedLockDir(rootDir, "repo-mutate", resourceKey), "repo-mutate", resourceKey, ownerLabel, waitMode);
}
/** Releases the per-repo mutation lock acquired for `repoDir` under the orchestrating `rootDir`. */
export function worktreeStackReleaseRepoMutationLock(rootDir, repoDir) {
    const resourceKey = worktreeStackRepoMutationResourceKey(repoDir);
    worktreeStackReleaseLockDir(worktreeStackNamedLockDir(rootDir, "repo-mutate", resourceKey));
}
/**
 * Runs `action` while holding the repo mutation lock, guaranteeing release in a `finally` block.
 */
export async function worktreeStackWithRepoMutationLock(rootDir, repoDir, ownerLabel, waitMode, action) {
    await worktreeStackAcquireRepoMutationLock(rootDir, repoDir, ownerLabel, waitMode);
    try {
        return await action();
    }
    finally {
        worktreeStackReleaseRepoMutationLock(rootDir, repoDir);
    }
}
/**
 * Acquires the cross-repo mutex guarding repo-root `main` synchronization with submodule fetches.
 */
export async function worktreeStackAcquireRootMainSyncLock(rootDir, targetBranch, ownerLabel, waitMode = "wait") {
    const resourceKey = worktreeStackRootMainSyncResourceKey(rootDir, targetBranch);
    await worktreeStackAcquireLockDir(worktreeStackNamedLockDir(rootDir, "root-main-sync", resourceKey), "root-main-sync", resourceKey, ownerLabel, waitMode);
}
/** Releases the root-main sync lock acquired for `targetBranch` under `rootDir`. */
export function worktreeStackReleaseRootMainSyncLock(rootDir, targetBranch) {
    const resourceKey = worktreeStackRootMainSyncResourceKey(rootDir, targetBranch);
    worktreeStackReleaseLockDir(worktreeStackNamedLockDir(rootDir, "root-main-sync", resourceKey));
}
