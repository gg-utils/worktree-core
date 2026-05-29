/**
 * @fileoverview Product-neutral prepared-worktree discovery, metadata paths, slot accounting, and
 * canonical path resolution helpers.
 *
 * Flow: Git worktree list + `.tmp/worktree-stack` metadata markers -> prepared-worktree paths,
 * used slot numbers, and canonical workspace references.
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 * @see packages/worktree-core/src/foundation.ts - Git subprocess runner supplying worktreeStackRunGit so porcelain worktree lists are parsed with shared allow-failure behavior.
 * @see packages/worktree-core/src/git-worktree-sync.ts - Worktree registration helpers that import worktreeStackListRegisteredWorktrees to keep temp-merge cleanup scoped to Git-registered paths.
 * @see packages/worktree-kit/src/align-active.ts - Align-active planning imports prepared-worktree listing and JSON metadata readers from this module while reconciling parallel prepared stacks.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
export type WorktreeStack_ResolveDefaultWorktreesBase_Options = {
    defaultWorktreesDirectoryName: string;
    projectRoot: string;
};
/** Reads a top-level or nested string field from a JSON file, returning null if missing. */
export declare function worktreeStackReadJsonField(jsonFilePath: string, fieldPath: string): string | null;
/** Returns the primary (first) worktree path for a git repository, falling back to rootDir. */
export declare function worktreeStackPrimaryWorktreePath(rootDir: string): string;
/** Resolves the canonical root workspace path from metadata or primary worktree detection. */
export declare function worktreeStackResolveCanonicalRootWorkspacePath(projectRoot: string): string;
/**
 * Resolves the default base directory for prepared worktrees given a project root and configured
 * sibling directory name.
 */
export declare function worktreeStackResolveDefaultWorktreesBase(options: WorktreeStack_ResolveDefaultWorktreesBase_Options): string;
/** Returns a YYMMDD-formatted date token for worktree folder naming. */
export declare function worktreeStackFormatFolderDateToken(): string;
/** Builds a combined folder name from a date token, realm slug, and stack name. */
export declare function worktreeStackBuildFolderName(dateToken: string, realmSlug: string, stackName: string): string;
/** Lists all registered git worktrees (including the primary) under rootDir. */
export declare function worktreeStackListRegisteredWorktrees(rootDir: string): string[];
/**
 * Lists registered worktrees that contain prepared-worktree metadata under `.tmp/worktree-stack/`.
 *
 * @remarks
 * I/O: Reads the filesystem for `metadata.json` markers; excludes the primary checkout at
 * `rootDir`.
 */
export declare function worktreeStackListPreparedWorktrees(rootDir: string): string[];
/** Collects all used slot numbers from prepared worktrees under rootDir. */
export declare function worktreeStackCollectUsedSlots(rootDir: string): number[];
/** Picks the next available slot number (lowest positive integer not yet used). */
export declare function worktreeStackPickNextSlot(rootDir: string): number;
/** Returns the path to the worktree metadata JSON file for a given worktree. */
export declare function worktreeStackMetadataPathForWorktree(worktreePath: string): string;
/** Returns the path to the worktree-info JSON file for a given worktree. */
export declare function worktreeStackHandbookJsonPathForWorktree(worktreePath: string): string;
/** Returns the path to the canonical-root-workspace-path reference file for a given worktree. */
export declare function worktreeStackCanonicalRootReferencePathForWorktree(worktreePath: string): string;
/** Returns true if the path appears to be a transient helper worktree (contains "/.tmp/"). */
export declare function worktreeStackIsTransientHelperWorktreePath(candidatePath: string): boolean;
/** Lists prepared worktrees that can be repaired (excludes transient helper worktrees). */
export declare function worktreeStackListRepairablePreparedWorktrees(rootDir: string): string[];
/** Reads a state field from the worktree metadata or handbook JSON, preferring metadata. */
export declare function worktreeStackReadPreparedStateField(worktreePath: string, fieldPath: string): string | null;
/**
 * Resolves the canonical root workspace path recorded for a prepared worktree, with safe fallbacks.
 *
 * @remarks
 * I/O: Reads small reference files under the worktree `.tmp` tree synchronously.
 */
export declare function worktreeStackResolvePreparedCanonicalRootWorkspacePath(worktreePath: string, fallbackPath?: string): string;
//# sourceMappingURL=worktree-discovery.d.ts.map