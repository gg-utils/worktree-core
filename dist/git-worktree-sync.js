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
import fs from "node:fs";
import path from "node:path";
import { worktreeStackEnsureBranchUpstream } from "./git-branches.js";
import { worktreeStackError, worktreeStackInfo, worktreeStackRunCommand, worktreeStackRunGit, } from "./foundation.js";
import { worktreeStackListRegisteredWorktrees } from "./worktree-discovery.js";
/** Returns whether `worktreePath` appears in `git worktree list` for `rootDir`. */
export function worktreeStackGitWorktreeRegistered(rootDir, worktreePath) {
    return worktreeStackListRegisteredWorktrees(rootDir).includes(worktreePath);
}
/**
 * Detects whether git still considers `worktreePath` prunable (stale metadata) relative to
 * `rootDir`.
 */
export function worktreeStackGitWorktreePrunable(rootDir, worktreePath) {
    const result = worktreeStackRunGit(rootDir, ["worktree", "list", "--porcelain"], {
        allowFailure: true,
    });
    if (result.status !== 0) {
        return false;
    }
    const lines = result.stdout.split(/\r?\n/gu);
    let inTarget = false;
    for (const line of lines) {
        if (line.startsWith("worktree ")) {
            inTarget = line.slice("worktree ".length).trim() === worktreePath;
            continue;
        }
        if (!line.length) {
            inTarget = false;
            continue;
        }
        if (inTarget && /^prunable(?:\s|$)/u.test(line)) {
            return true;
        }
    }
    return false;
}
/**
 * Human-readable label for the current HEAD (branch name, detached sha, or `unknown`).
 */
export function worktreeStackCurrentCheckoutDescription(repoDir) {
    const branchResult = worktreeStackRunGit(repoDir, ["branch", "--show-current"], {
        allowFailure: true,
    });
    const currentBranch = branchResult.stdout.trim();
    if (currentBranch.length > 0) {
        return currentBranch;
    }
    const headResult = worktreeStackRunGit(repoDir, ["rev-parse", "--short", "HEAD"], {
        allowFailure: true,
    });
    const headSha = headResult.stdout.trim();
    if (headSha.length > 0) {
        return `detached@${headSha}`;
    }
    return "unknown";
}
/**
 * Checks whether the current checkout already equals `branchName` on a branch or matching detached
 * HEAD.
 */
export function worktreeStackCheckoutMatchesExpectedBranch(repoDir, branchName, remoteName = "origin") {
    const currentBranch = worktreeStackRunGit(repoDir, ["branch", "--show-current"], {
        allowFailure: true,
    }).stdout.trim();
    if (currentBranch.length > 0) {
        return currentBranch === branchName;
    }
    const headSha = worktreeStackRunGit(repoDir, ["rev-parse", "HEAD"], {
        allowFailure: true,
    }).stdout.trim();
    if (headSha.length === 0) {
        return false;
    }
    const localBranchSha = worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true }).stdout.trim();
    if (localBranchSha.length > 0 && headSha === localBranchSha) {
        return true;
    }
    const remoteBranchSha = worktreeStackRunGit(repoDir, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/${remoteName}/${branchName}`,
    ], { allowFailure: true }).stdout.trim();
    return remoteBranchSha.length > 0 && headSha === remoteBranchSha;
}
/**
 * Predicate used before `worktreeStackAttachExpectedBranch` to ensure HEAD is an ancestor of the
 * target branch tip.
 */
export function worktreeStackCheckoutCanAttachExpectedBranch(repoDir, branchName, remoteName = "origin") {
    const currentBranch = worktreeStackRunGit(repoDir, ["branch", "--show-current"], {
        allowFailure: true,
    }).stdout.trim();
    if (currentBranch.length > 0) {
        return currentBranch === branchName;
    }
    if (worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true, stdio: "ignore" }).status === 0 &&
        worktreeStackRunGit(repoDir, ["merge-base", "--is-ancestor", `refs/heads/${branchName}`, "HEAD"], { allowFailure: true, stdio: "ignore" }).status === 0) {
        return true;
    }
    return (worktreeStackRunGit(repoDir, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/${remoteName}/${branchName}`,
    ], { allowFailure: true, stdio: "ignore" }).status === 0 &&
        worktreeStackRunGit(repoDir, [
            "merge-base",
            "--is-ancestor",
            `refs/remotes/${remoteName}/${branchName}`,
            "HEAD",
        ], { allowFailure: true, stdio: "ignore" }).status === 0);
}
/**
 * Forces `repoDir` onto `branchName` when detached-but-ancestor-safe, otherwise errors with
 * guidance.
 *
 * @remarks
 * I/O: May rewrite local branch refs and check out branches; never silently drops divergent work.
 */
export function worktreeStackAttachExpectedBranch(repoDir, branchName, remoteName = "origin") {
    const currentBranch = worktreeStackRunGit(repoDir, ["branch", "--show-current"], {
        allowFailure: true,
    }).stdout.trim();
    if (currentBranch === branchName) {
        worktreeStackEnsureBranchUpstream(repoDir, branchName, remoteName);
        return;
    }
    if (currentBranch.length > 0) {
        worktreeStackError(`Cannot attach ${repoDir} to ${branchName}; current branch is ${currentBranch}`);
    }
    const headSha = worktreeStackRunGit(repoDir, ["rev-parse", "HEAD"], {
        allowFailure: true,
    }).stdout.trim();
    if (headSha.length === 0) {
        worktreeStackError(`Cannot resolve HEAD for ${repoDir}`);
    }
    const localBranchSha = worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true }).stdout.trim();
    if (localBranchSha.length > 0 &&
        worktreeStackRunGit(repoDir, ["merge-base", "--is-ancestor", `refs/heads/${branchName}`, headSha], { allowFailure: true, stdio: "ignore" }).status === 0) {
        if (headSha !== localBranchSha) {
            worktreeStackRunGit(repoDir, ["branch", "-f", branchName, headSha], {
                stdio: "ignore",
            });
        }
        worktreeStackRunGit(repoDir, ["checkout", branchName], { stdio: "ignore" });
        worktreeStackEnsureBranchUpstream(repoDir, branchName, remoteName);
        return;
    }
    const remoteBranchSha = worktreeStackRunGit(repoDir, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/${remoteName}/${branchName}`,
    ], { allowFailure: true }).stdout.trim();
    if (remoteBranchSha.length > 0 &&
        worktreeStackRunGit(repoDir, [
            "merge-base",
            "--is-ancestor",
            `refs/remotes/${remoteName}/${branchName}`,
            headSha,
        ], { allowFailure: true, stdio: "ignore" }).status === 0) {
        if (worktreeStackRunGit(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], { allowFailure: true, stdio: "ignore" }).status === 0) {
            worktreeStackRunGit(repoDir, ["branch", "-f", branchName, headSha], {
                stdio: "ignore",
            });
            worktreeStackRunGit(repoDir, ["checkout", branchName], {
                stdio: "ignore",
            });
        }
        else {
            worktreeStackRunGit(repoDir, ["checkout", "-b", branchName, headSha], {
                stdio: "ignore",
            });
        }
        worktreeStackEnsureBranchUpstream(repoDir, branchName, remoteName);
        return;
    }
    worktreeStackError(`Cannot attach ${repoDir} to ${branchName}; current checkout is ` +
        worktreeStackCurrentCheckoutDescription(repoDir));
}
/**
 * Reads `submodule.<path>.branch` from `.gitmodules`, defaulting to `main` when unset.
 */
export function worktreeStackResolveGitmodulesSubmoduleBranch(gitmodulesPath, submodulePath) {
    if (!fs.existsSync(gitmodulesPath)) {
        return "main";
    }
    const branchResult = worktreeStackRunCommand("git", [
        "config",
        "--file",
        gitmodulesPath,
        "--get",
        `submodule.${submodulePath}.branch`,
    ], { allowFailure: true });
    const branchName = branchResult.stdout.trim();
    return branchName.length > 0 ? branchName : "main";
}
/**
 * Prints the last `lineCount` lines of `filePath` to stderr when the file exists (debug aid for
 * merge logs).
 *
 * @remarks
 * I/O: Synchronous read of potentially large logs; safe no-op when missing.
 */
export function worktreeStackTailFileIfPresent(filePath, lineCount = 80) {
    if (!fs.existsSync(filePath)) {
        return;
    }
    console.error(`[worktree] --- tail ${filePath} ---`);
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/gu);
    for (const line of lines.slice(-lineCount)) {
        console.error(line);
    }
    console.error("[worktree] --- end tail ---");
}
/**
 * Removes leftover temporary merge worktrees under `parentDir` whose run id differs from
 * `currentRunId`.
 *
 * @remarks
 * I/O: Issues `git worktree remove --force` for stale siblings; best-effort with `allowFailure`.
 */
export function worktreeStackCleanupStaleTempMergeWorktrees(parentDir, currentRunId) {
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
        return;
    }
    const worktreePaths = worktreeStackListRegisteredWorktrees(parentDir).filter((worktreePath) => worktreePath.startsWith(`${parentDir}${path.sep}`));
    for (const worktreePath of worktreePaths) {
        const relativePath = path.relative(parentDir, worktreePath);
        const runId = relativePath.split(path.sep)[0] ?? "";
        if (!runId || runId === currentRunId) {
            continue;
        }
        worktreeStackInfo(`Cleaning up stale temp worktree: ${worktreePath}`);
        worktreeStackRunGit(parentDir, ["worktree", "remove", "--force", worktreePath], {
            allowFailure: true,
            stdio: "ignore",
        });
    }
}
