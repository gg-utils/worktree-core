/**
 * @fileoverview Product-neutral shell-facing argv bridge for worktree discovery helpers.
 *
 * Flow: shell argv -> validated list-worktrees command -> prepared or registered worktree paths
 * -> sorted newline output.
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 * @see packages/worktree-core/src/worktree-discovery.ts - Prepared and registered worktree listing used as the default list hooks when run() callers omit injectable list functions.
 * @see packages/worktree-core/src/shell-shim.unit.test.ts - Node test runner specs asserting argv parsing, usage rendering, sorted stdout lines, and stderr exit codes for this shim.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
export type WorktreeStackCoreShellShim_ListMode = "prepared-only" | "registered";
export type WorktreeStackCoreShellShim_ParseResult = {
    command: "help";
} | {
    command: "list-worktrees";
    mode: WorktreeStackCoreShellShim_ListMode;
    root: string;
};
export type WorktreeStackCoreShellShim_RunOptions = {
    argv: readonly string[];
    listPreparedWorktrees?: (root: string) => readonly string[];
    listRegisteredWorktrees?: (root: string) => readonly string[];
    programName: string;
    writeStderr?: (text: string) => void;
    writeStdout?: (text: string) => void;
};
/** Domain error for argv validation failures before any filesystem listing runs. */
export declare class WorktreeStackCoreShellShimError extends Error {
    constructor(message: string);
}
/** Renders the shell shim usage banner. */
export declare function worktreeStackCoreShellShimRenderUsage(programName: string): string;
/** Parses command argv into a help request or a validated list-worktrees invocation. */
export declare function worktreeStackCoreShellShimParseArgv(argv: readonly string[]): WorktreeStackCoreShellShim_ParseResult;
/** Runs the shell shim and returns the desired process exit code. */
export declare function worktreeStackCoreShellShimRun(options: WorktreeStackCoreShellShim_RunOptions): number;
//# sourceMappingURL=shell-shim.d.ts.map