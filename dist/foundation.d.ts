/**
 * @fileoverview Product-neutral logging, process execution, filesystem guard, quoting, and timing helpers for worktree-stack workflows.
 *
 * Flow: command/options -> synchronous subprocess result or guard failure.
 *
 * @testing Node test runner (tsx): npm run worktree-core:test
 *
 * @see packages/worktree-core/src/foundation.unit.test.ts - Node test coverage for quoting, synchronous command capture, JSON escape, and filesystem guards implemented in this module.
 * @see packages/worktree-core/src/git-worktree-sync.ts - Git worktree orchestration that imports `worktreeStackRunGit`, logging, and `worktreeStackError` from this foundation surface.
 * @see packages/worktree-core/src/index.ts - Package barrel that re-exports this foundation module as part of the public `@gg-utils/worktree-core` surface.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import { type SpawnOptions } from "node:child_process";
/** Result of a synchronous command execution via `worktreeStackRunCommand`. */
export type WorktreeStack_CommandResult = {
    status: number;
    stderr: string;
    stdout: string;
};
/** Options for synchronous child-process execution via `worktreeStackRunCommand`. */
export type WorktreeStack_RunCommandOptions = {
    allowFailure?: boolean;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
    stdio?: SpawnOptions["stdio"];
};
/** Prints an info message to stdout with a [worktree] prefix. */
export declare function worktreeStackInfo(message: string): void;
/** Prints a warning message to stderr with a [worktree] WARNING prefix. */
export declare function worktreeStackWarn(message: string): void;
/** Throws an Error with a [worktree] ERROR prefix; never returns. */
export declare function worktreeStackError(message: string): never;
/** Prints a key-value pair with padded alignment for CLI output tables. */
export declare function worktreeStackPrintKv(key: string, value: string): void;
/** Returns a shell-safe single-quoted string, or empty quotes for an empty string. */
export declare function worktreeStackShellQuote(value: string): string;
/** Returns the current wall-clock time in milliseconds. */
export declare function worktreeStackNowMs(): number;
/** Computes the duration between two timestamps in milliseconds. */
export declare function worktreeStackMeasureDurationMs(startedAtMs: number, endedAtMs: number): number;
/** JSON-encodes a string value and strips the surrounding quotes, yielding a shell-safe escaped string. */
export declare function worktreeStackJsonEscape(value: string): string;
/** Runs a synchronous shell command and returns stdout, stderr, and exit status. */
export declare function worktreeStackRunCommand(command: string, args: readonly string[], options?: WorktreeStack_RunCommandOptions): WorktreeStack_CommandResult;
/** Runs a git command against a specific repo directory and returns the result. */
export declare function worktreeStackRunGit(repoDir: string, args: readonly string[], options?: Omit<WorktreeStack_RunCommandOptions, "cwd">): WorktreeStack_CommandResult;
/** Verifies that a shell command is available on PATH, throwing if not found. */
export declare function worktreeStackRequireCommand(commandName: string): void;
/** Asserts that a file exists at filePath, throwing with the given description if not. */
export declare function worktreeStackRequireFile(filePath: string, description: string): void;
/** Asserts that a directory exists at directoryPath, throwing with the given description if not. */
export declare function worktreeStackRequireDirectory(directoryPath: string, description: string): void;
//# sourceMappingURL=foundation.d.ts.map