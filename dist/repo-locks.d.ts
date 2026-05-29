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
/** Lock wait mode: "fail-fast" throws immediately, "wait" waits for the lock. */
export type WorktreeStack_LockWaitMode = "fail-fast" | "wait";
/** Returns the lock directory path for serialized writer access to a repo. */
export declare function worktreeStackWriterLockDir(rootDir: string): string;
/** Returns a namespaced lock directory path derived from a scope and resource key. */
export declare function worktreeStackNamedLockDir(rootDir: string, scope: string, resourceKey: string): string;
/**
 * Acquires a filesystem mutex directory used to serialize destructive repo mutations.
 *
 * @remarks
 * I/O: Creates lock metadata files under `lockDir`, appends JSONL events, and may busy-wait when `waitMode` is `"wait"`.
 * @throws Never returns when another writer holds the lock in `fail-fast` mode; calls `worktreeStackError` instead.
 */
export declare function worktreeStackAcquireLockDir(lockDir: string, scope: string, resourceKey: string, ownerLabel: string, waitMode?: WorktreeStack_LockWaitMode): Promise<void>;
/**
 * Removes a lock directory when it belongs to the current process, otherwise no-ops safely.
 *
 * @remarks
 * I/O: Deletes lock marker files on disk; updates the in-process active lock registry.
 */
export declare function worktreeStackReleaseLockDir(lockDir: string): void;
/** Releases every lock directory tracked for this process in LIFO order. */
export declare function worktreeStackReleaseAllNamedLocks(): void;
/**
 * Acquires the repo-wide batch writer lock that blocks concurrent align/merge/update pushes.
 *
 * @remarks
 * PRE-CONDITION: Callers should already be in a single-writer orchestration path; lock is fail-fast.
 */
export declare function worktreeStackAcquireRepoWriterLock(rootDir: string, ownerLabel: string): Promise<void>;
/** Releases the batch writer lock directory for `rootDir` when owned by this process. */
export declare function worktreeStackReleaseRepoWriterLock(rootDir: string): void;
/**
 * Resolves the shared git common directory for `repoDir`, tolerating absolute or relative `rev-parse` output.
 *
 * @remarks
 * I/O: Invokes `git rev-parse` twice as a compatibility shim across worktree layouts.
 */
export declare function worktreeStackCanonicalGitCommonDir(repoDir: string): string;
/**
 * Serializes git mutations for a single repository directory (root or submodule) inside a stack run.
 *
 * @remarks
 * Resource key derives from `worktreeStackCanonicalGitCommonDir` so nested worktrees share one mutex.
 */
export declare function worktreeStackAcquireRepoMutationLock(rootDir: string, repoDir: string, ownerLabel: string, waitMode?: WorktreeStack_LockWaitMode): Promise<void>;
/** Releases the per-repo mutation lock acquired for `repoDir` under the orchestrating `rootDir`. */
export declare function worktreeStackReleaseRepoMutationLock(rootDir: string, repoDir: string): void;
/**
 * Runs `action` while holding the repo mutation lock, guaranteeing release in a `finally` block.
 */
export declare function worktreeStackWithRepoMutationLock<T>(rootDir: string, repoDir: string, ownerLabel: string, waitMode: WorktreeStack_LockWaitMode, action: () => Promise<T> | T): Promise<T>;
/**
 * Acquires the cross-repo mutex guarding repo-root `main` synchronization with submodule fetches.
 */
export declare function worktreeStackAcquireRootMainSyncLock(rootDir: string, targetBranch: string, ownerLabel: string, waitMode?: WorktreeStack_LockWaitMode): Promise<void>;
/** Releases the root-main sync lock acquired for `targetBranch` under `rootDir`. */
export declare function worktreeStackReleaseRootMainSyncLock(rootDir: string, targetBranch: string): void;
//# sourceMappingURL=repo-locks.d.ts.map