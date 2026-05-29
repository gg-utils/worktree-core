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
import { worktreeStackError, worktreeStackInfo, worktreeStackRunGit, worktreeStackWarn, } from "./foundation.js";
/**
 * Returns true if the given remote/branch combination exists on the remote after a silent fetch.
 */
export function worktreeStackRemoteBranchExists(repoDir, remoteName, branchName) {
    worktreeStackRunGit(repoDir, ["fetch", remoteName, branchName, "--prune"], {
        allowFailure: true,
        stdio: "ignore",
    });
    const result = worktreeStackRunGit(repoDir, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/${remoteName}/${branchName}`,
    ], { allowFailure: true, stdio: "ignore" });
    return result.status === 0;
}
/**
 * Returns whether the local branch has a configured upstream in `repoDir`.
 *
 * @remarks
 * I/O: Runs `git rev-parse` with `@{upstream}` and `allowFailure`; stdio ignored.
 */
function worktreeStackBranchHasUpstream(repoDir, branchName) {
    const result = worktreeStackRunGit(repoDir, ["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`], {
        allowFailure: true,
        stdio: "ignore",
    });
    return result.status === 0;
}
/**
 * Resolves the symbolic upstream ref name for a local branch when configured.
 *
 * @remarks
 * I/O: Runs `git rev-parse --abbrev-ref branch@{upstream}`; returns null when missing or on
 * non-zero status.
 */
function worktreeStackBranchUpstreamRef(repoDir, branchName) {
    const result = worktreeStackRunGit(repoDir, ["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`], { allowFailure: true });
    if (result.status !== 0) {
        return null;
    }
    const value = result.stdout.trim();
    return value.length > 0 ? value : null;
}
/**
 * Ensures the local branch tracks the expected remote branch, pushing if necessary and returning
 * true on success.
 */
export function worktreeStackEnsureBranchUpstream(repoDir, branchName, remoteName = "origin") {
    const localBranchExists = worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true, stdio: "ignore" }).status === 0;
    if (!localBranchExists) {
        worktreeStackWarn(`Cannot configure upstream for missing local branch '${branchName}' in ${repoDir}`);
        return false;
    }
    const expectedUpstream = `${remoteName}/${branchName}`;
    if (worktreeStackBranchHasUpstream(repoDir, branchName)) {
        const currentUpstream = worktreeStackBranchUpstreamRef(repoDir, branchName);
        if (currentUpstream === expectedUpstream) {
            worktreeStackInfo(`Branch already tracks the expected upstream: ` +
                `${repoDir} :: ${branchName} -> ${expectedUpstream}`);
            return true;
        }
        if (currentUpstream) {
            worktreeStackWarn(`Branch tracks an unexpected upstream and will be corrected: ` +
                `${repoDir} :: ${branchName} -> ${currentUpstream}`);
        }
    }
    const remoteExists = worktreeStackRunGit(repoDir, ["remote", "get-url", remoteName], {
        allowFailure: true,
        stdio: "ignore",
    }).status === 0;
    if (!remoteExists) {
        worktreeStackWarn(`Cannot configure upstream because remote '${remoteName}' is missing in ${repoDir}`);
        return false;
    }
    if (worktreeStackRemoteBranchExists(repoDir, remoteName, branchName)) {
        const setResult = worktreeStackRunGit(repoDir, ["branch", "--set-upstream-to", expectedUpstream, branchName], { allowFailure: true });
        if (setResult.status === 0) {
            worktreeStackInfo(`Configured upstream ${expectedUpstream} for ${repoDir} :: ${branchName}`);
            return true;
        }
        worktreeStackWarn(`Failed to set upstream ${expectedUpstream} for ${repoDir} :: ${branchName}`);
        return false;
    }
    const pushResult = worktreeStackRunGit(repoDir, ["push", "--set-upstream", remoteName, branchName], { allowFailure: true, stdio: "inherit" });
    if (pushResult.status === 0) {
        worktreeStackInfo(`Pushed branch and configured upstream ${expectedUpstream} for ${repoDir} :: ${branchName}`);
        return true;
    }
    worktreeStackWarn(`Failed to push and configure upstream ${expectedUpstream} for ${repoDir} :: ${branchName}`);
    return false;
}
/**
 * Returns whether a local branch ref exists under `repoDir`.
 *
 * @remarks
 * I/O: Runs `git rev-parse` on `refs/heads` with `allowFailure`; stdio ignored.
 */
function worktreeStackLocalBranchExists(repoDir, branchName) {
    return (worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true, stdio: "ignore" }).status === 0);
}
/**
 * Returns whether a remote-tracking branch ref exists for the given remote and branch.
 *
 * @remarks
 * I/O: Runs `git rev-parse` on `refs/remotes/${remoteName}/${branchName}` with `allowFailure`;
 * stdio ignored.
 */
function worktreeStackRemoteTrackingBranchExists(repoDir, remoteName, branchName) {
    return (worktreeStackRunGit(repoDir, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/${remoteName}/${branchName}`,
    ], { allowFailure: true, stdio: "ignore" }).status === 0);
}
/**
 * Returns whether the named git remote is configured in `repoDir`.
 *
 * @remarks
 * I/O: Runs `git remote get-url` with `allowFailure`; stdio ignored.
 */
export function worktreeStackRemoteExists(repoDir, remoteName) {
    return (worktreeStackRunGit(repoDir, ["remote", "get-url", remoteName], {
        allowFailure: true,
        stdio: "ignore",
    }).status === 0);
}
/**
 * Checks out `branchName` in `repoDir`, creating a tracking branch when only the remote ref exists.
 *
 * @remarks
 * I/O: Runs git checkout/fetch paths and may terminate the process via `worktreeStackError` on
 * failure. POST-CONDITION: Ensures upstream configuration via `worktreeStackEnsureBranchUpstream`
 * when checkout succeeds.
 */
export function worktreeStackCheckoutBranch(repoDir, branchName, remoteName = "origin") {
    if (worktreeStackLocalBranchExists(repoDir, branchName)) {
        worktreeStackRunGit(repoDir, ["checkout", branchName], {
            stdio: "ignore",
        });
    }
    else if (worktreeStackRemoteTrackingBranchExists(repoDir, remoteName, branchName)) {
        worktreeStackRunGit(repoDir, ["checkout", "-b", branchName, "--track", `${remoteName}/${branchName}`], {
            stdio: "ignore",
        });
    }
    else {
        worktreeStackError(`Configured branch was not found locally or on ${remoteName}: ${repoDir} :: ${branchName}`);
    }
    worktreeStackEnsureBranchUpstream(repoDir, branchName, remoteName);
}
//# sourceMappingURL=git-branches.js.map