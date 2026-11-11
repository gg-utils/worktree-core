/**
 * @fileoverview Product-neutral branch-prefix helpers for prepared worktree branch names.
 *
 * This file owns the default prefix constant, known-prefix taxonomy, editor launch templates, slug
 * normalization, and branch-name parse/build helpers shared across worktree-stack CLIs.
 * Flow: prefix token -> slug/default normalization -> branch-name construction and parsing.
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 *
 * @see packages/worktree-core/src/prefix.unit.test.ts - Node test coverage for normalization, invalid slug errors, branch parsing, known-prefix membership, and editor launch map entries owned by this module.
 * @see packages/worktree-kit/src/switch-command.ts - Worktree switch CLI that lists known prefixes and applies `worktreeStackNormalizeBranchPrefix` when users set branch-prefix options.
 * @see packages/worktree-kit/src/create-cli-context.ts - CLI context bootstrap that normalizes branch-prefix inputs using the same slug contract before running worktree commands.
 * @see worktrees.config.ts - Root workspace config that imports the default branch prefix constant for orchestrated worktree metadata.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Default branch prefix applied when no explicit prefix is provided. */
export declare const WORKTREE_STACK_DEFAULT_BRANCH_PREFIX = "codex";
/** Ordered list of well-known editor/tool prefixes for display and validation. */
export declare const WORKTREE_STACK_KNOWN_PREFIXES: readonly ["codex", "antigravity", "claude", "cursor", "windsurf", "augment", "pi", "zed", "opencode", "kimi", "dev"];
/** Closed-string union of supported editor/tool branch prefixes. */
export type WorktreeStackKnownPrefix = (typeof WORKTREE_STACK_KNOWN_PREFIXES)[number];
/** Editor launch command templates keyed by known branch prefix. */
export declare const WORKTREE_STACK_EDITOR_LAUNCH_MAP: Readonly<Record<WorktreeStackKnownPrefix, string | null>>;
/** Parsed `{prefix, stackName}` pair extracted from one branch name token. */
export type WorktreeStackParsedBranch = {
    prefix: string;
    stackName: string;
};
/** Normalizes a branch-prefix input, returning the default prefix for blanks. */
export declare function worktreeStackNormalizeBranchPrefix(input: string): string;
/** Extracts the prefix and stack-name portions from a full branch name token. */
export declare function worktreeStackExtractBranchPrefix(branchName: string): WorktreeStackParsedBranch;
/** Builds a full branch name from a prefix and stack name. */
export declare function worktreeStackBuildBranchName(prefix: string, stackName: string): string;
/** Returns true when a prefix is in the known-prefixes list. */
export declare function worktreeStackIsKnownPrefix(prefix: string): prefix is WorktreeStackKnownPrefix;
