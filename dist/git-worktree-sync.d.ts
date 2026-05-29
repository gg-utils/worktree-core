/**
 * @fileoverview Product-neutral Git worktree registration, checkout attachment, gitmodules, and
 * cleanup helpers.
 *
 * Flow: Git worktree list + branch refs -> checkout registration/attachment decisions -> safe
 * cleanup or diagnostic output.
 *
 * @testing CLI: npm run worktree-core:test
 * @see packages/worktree-core/src/foundation.ts - Shared git subprocess runner, stderr logging, and fatal error helper backing every `git` invocation and failure surface in this module.
 * @see packages/worktree-core/src/worktree-discovery.ts - Parses `git worktree list` so registration checks and stale temp-merge cleanup here only target paths Git still considers registered.
 * @see packages/worktree-core/src/git-branches.ts - Ensures branch upstream configuration after successful checkouts when this module attaches an expected branch to a detached or divergent HEAD.
 * @see packages/worktree-kit/src/align-active.ts - Kit-layer align-active workflow that imports these helpers when reconciling prepared worktrees against expected branches and paths.
 * @see packages/worktree-core/src/git-worktree-sync.unit.test.ts - Package-local regression coverage for porcelain parsing, attach safety predicates, and cleanup helpers owned by this file.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Returns whether `worktreePath` appears in `git worktree list` for `rootDir`. */
export declare function worktreeStackGitWorktreeRegistered(rootDir: string, worktreePath: string): boolean;
/**
 * Detects whether git still considers `worktreePath` prunable (stale metadata) relative to
 * `rootDir`.
 */
export declare function worktreeStackGitWorktreePrunable(rootDir: string, worktreePath: string): boolean;
/**
 * Human-readable label for the current HEAD (branch name, detached sha, or `unknown`).
 */
export declare function worktreeStackCurrentCheckoutDescription(repoDir: string): string;
/**
 * Checks whether the current checkout already equals `branchName` on a branch or matching detached
 * HEAD.
 */
export declare function worktreeStackCheckoutMatchesExpectedBranch(repoDir: string, branchName: string, remoteName?: string): boolean;
/**
 * Predicate used before `worktreeStackAttachExpectedBranch` to ensure HEAD is an ancestor of the
 * target branch tip.
 */
export declare function worktreeStackCheckoutCanAttachExpectedBranch(repoDir: string, branchName: string, remoteName?: string): boolean;
/**
 * Forces `repoDir` onto `branchName` when detached-but-ancestor-safe, otherwise errors with
 * guidance.
 *
 * @remarks
 * I/O: May rewrite local branch refs and check out branches; never silently drops divergent work.
 */
export declare function worktreeStackAttachExpectedBranch(repoDir: string, branchName: string, remoteName?: string): void;
/**
 * Reads `submodule.<path>.branch` from `.gitmodules`, defaulting to `main` when unset.
 */
export declare function worktreeStackResolveGitmodulesSubmoduleBranch(gitmodulesPath: string, submodulePath: string): string;
/**
 * Prints the last `lineCount` lines of `filePath` to stderr when the file exists (debug aid for
 * merge logs).
 *
 * @remarks
 * I/O: Synchronous read of potentially large logs; safe no-op when missing.
 */
export declare function worktreeStackTailFileIfPresent(filePath: string, lineCount?: number): void;
/**
 * Removes leftover temporary merge worktrees under `parentDir` whose run id differs from
 * `currentRunId`.
 *
 * @remarks
 * I/O: Issues `git worktree remove --force` for stale siblings; best-effort with `allowFailure`.
 */
export declare function worktreeStackCleanupStaleTempMergeWorktrees(parentDir: string, currentRunId: string): void;
//# sourceMappingURL=git-worktree-sync.d.ts.map