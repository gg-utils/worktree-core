/**
 * @fileoverview Barrel entrypoint that re-exports the public `@gg-utils/worktree-core` surface for
 * product-neutral worktree stack primitives.
 *
 * This file owns the curated package root: branch-prefix helpers, foundation git and command
 * utilities, branch bookkeeping, worktree discovery, repo locks, and shell shim symbols are
 * forwarded from dedicated modules so callers can depend on one entry while still using package
 * subpaths when they want a narrower import graph.
 * Flow: implementation modules own behavior -> this barrel aggregates their public exports.
 *
 * @example
 * ```typescript
 * import { worktreeStackInfo, WORKTREE_STACK_DEFAULT_BRANCH_PREFIX } from "@gg-utils/worktree-core";
 *
 * worktreeStackInfo(`default prefix token is ${WORKTREE_STACK_DEFAULT_BRANCH_PREFIX}`);
 * ```
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 *
 * @see packages/worktree-core/src/foundation.ts - Foundation subprocess, logging, and filesystem helpers re-exported through this barrel for script-style worktree orchestration callers.
 * @see packages/worktree-kit/src/index.ts - Kit-layer barrel that composes Ink and CLI flows on top of the primitives exported from this package root.
 * @see packages/worktree-core/README.md - Human-oriented overview of package scope, scripts, and when to prefer subpath imports versus this root entry.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
export * from "./prefix.js";
export * from "./foundation.js";
export * from "./git-branches.js";
export * from "./git-worktree-sync.js";
export * from "./repo-locks.js";
export * from "./worktree-discovery.js";
export * from "./shell-shim.js";
