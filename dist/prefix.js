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
export const WORKTREE_STACK_DEFAULT_BRANCH_PREFIX = "codex";
/** Ordered list of well-known editor/tool prefixes for display and validation. */
export const WORKTREE_STACK_KNOWN_PREFIXES = [
    "codex",
    "antigravity",
    "claude",
    "cursor",
    "windsurf",
    "augment",
    "pi",
    "zed",
    "opencode",
    "kimi",
    "dev",
];
/** Editor launch command templates keyed by known branch prefix. */
export const WORKTREE_STACK_EDITOR_LAUNCH_MAP = {
    codex: null,
    antigravity: null,
    claude: "claude --cwd <PATH>",
    cursor: "cursor <PATH>",
    windsurf: null,
    augment: "code <PATH>",
    pi: "pi open <PATH>",
    zed: "zed <PATH>",
    opencode: "opencode --cwd <PATH>",
    kimi: "kimi <PATH>",
    dev: "${EDITOR:-code} <PATH>",
};
/** Slug validation: lowercase alphanumeric plus hyphens, 1-40 chars. */
const WORKTREE_STACK_BRANCH_PREFIX_PATTERN = /^[a-z][a-z0-9-]{0,39}$/u;
/** Normalizes a branch-prefix input, returning the default prefix for blanks. */
export function worktreeStackNormalizeBranchPrefix(input) {
    const normalised = input.trim().toLowerCase();
    if (normalised.length === 0) {
        return WORKTREE_STACK_DEFAULT_BRANCH_PREFIX;
    }
    if (!WORKTREE_STACK_BRANCH_PREFIX_PATTERN.test(normalised)) {
        throw new Error(`[worktree-stack:prefix] Invalid branch prefix "${normalised}". ` +
            "Must be 1-40 lowercase alphanumeric chars or hyphens, starting with a letter.");
    }
    return normalised;
}
/** Extracts the prefix and stack-name portions from a full branch name token. */
export function worktreeStackExtractBranchPrefix(branchName) {
    const trimmed = branchName.trim();
    const slashIndex = trimmed.indexOf("/");
    if (slashIndex === -1 ||
        slashIndex === 0 ||
        slashIndex === trimmed.length - 1) {
        return {
            prefix: WORKTREE_STACK_DEFAULT_BRANCH_PREFIX,
            stackName: trimmed,
        };
    }
    return {
        prefix: trimmed.slice(0, slashIndex),
        stackName: trimmed.slice(slashIndex + 1),
    };
}
/** Builds a full branch name from a prefix and stack name. */
export function worktreeStackBuildBranchName(prefix, stackName) {
    return `${prefix}/${stackName}`;
}
/** Returns true when a prefix is in the known-prefixes list. */
export function worktreeStackIsKnownPrefix(prefix) {
    return WORKTREE_STACK_KNOWN_PREFIXES.some((knownPrefix) => knownPrefix === prefix);
}
//# sourceMappingURL=prefix.js.map