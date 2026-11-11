/**
 * @fileoverview Product-neutral Git branch and remote helpers for worktree-stack repositories.
 *
 * Flow: remote/branch probes -> checkout or tracking branch creation -> upstream verification.
 *
 * @testing Package: `npm run worktree-core:test`.
 * @see packages/worktree-core/src/foundation.ts - Shared worktreeStackRunGit and logging primitives this module delegates to for every git subprocess invocation and controlled failure handling.
 * @see packages/worktree-core/src/git-worktree-sync.ts - Worktree sync orchestration that imports worktreeStackEnsureBranchUpstream when reconciling local branches against remotes during stack updates.
 * @see packages/worktree-core/src/git-branches.unit.test.ts - Jest unit coverage for remote-branch probes, checkout with tracking-branch creation, and upstream verification owned by this module.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/**
 * Returns true if the given remote/branch combination exists on the remote after a silent fetch.
 */
export declare function worktreeStackRemoteBranchExists(repoDir: string, remoteName: string, branchName: string): boolean;
/**
 * Ensures the local branch tracks the expected remote branch, pushing if necessary and returning
 * true on success.
 */
export declare function worktreeStackEnsureBranchUpstream(repoDir: string, branchName: string, remoteName?: string): boolean;
/**
 * Returns whether the named git remote is configured in `repoDir`.
 *
 * @remarks
 * I/O: Runs `git remote get-url` with `allowFailure`; stdio ignored.
 */
export declare function worktreeStackRemoteExists(repoDir: string, remoteName: string): boolean;
/**
 * Checks out `branchName` in `repoDir`, creating a tracking branch when only the remote ref exists.
 *
 * @remarks
 * I/O: Runs git checkout/fetch paths and may terminate the process via `worktreeStackError` on
 * failure. POST-CONDITION: Ensures upstream configuration via `worktreeStackEnsureBranchUpstream`
 * when checkout succeeds.
 */
export declare function worktreeStackCheckoutBranch(repoDir: string, branchName: string, remoteName?: string): void;
