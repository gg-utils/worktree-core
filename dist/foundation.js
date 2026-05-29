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
import { spawnSync } from "node:child_process";
import fs from "node:fs";
/** Prints an info message to stdout with a [worktree] prefix. */
export function worktreeStackInfo(message) {
    console.log(`[worktree] ${message}`);
}
/** Prints a warning message to stderr with a [worktree] WARNING prefix. */
export function worktreeStackWarn(message) {
    console.warn(`[worktree] WARNING: ${message}`);
}
/** Throws an Error with a [worktree] ERROR prefix; never returns. */
export function worktreeStackError(message) {
    throw new Error(`[worktree] ERROR: ${message}`);
}
/** Prints a key-value pair with padded alignment for CLI output tables. */
export function worktreeStackPrintKv(key, value) {
    console.log(`[worktree]   ${(key + ":").padEnd(24, " ")} ${value}`);
}
/** Returns a shell-safe single-quoted string, or empty quotes for an empty string. */
export function worktreeStackShellQuote(value) {
    if (value.length === 0) {
        return "''";
    }
    return `'${value.replace(/'/gu, "'\\''")}'`;
}
/** Returns the current wall-clock time in milliseconds. */
export function worktreeStackNowMs() {
    return Date.now();
}
/** Computes the duration between two timestamps in milliseconds. */
export function worktreeStackMeasureDurationMs(startedAtMs, endedAtMs) {
    return endedAtMs - startedAtMs;
}
/** JSON-encodes a string value and strips the surrounding quotes, yielding a shell-safe escaped string. */
export function worktreeStackJsonEscape(value) {
    return JSON.stringify(value).slice(1, -1);
}
/** Runs a synchronous shell command and returns stdout, stderr, and exit status. */
export function worktreeStackRunCommand(command, args, options = {}) {
    const result = spawnSync(command, [...args], {
        cwd: options.cwd,
        encoding: "utf8",
        env: options.env,
        input: options.input,
        stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    });
    const status = result.status ?? 1;
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    if (!options.allowFailure && status !== 0) {
        throw new Error([
            `Command failed (${String(status)}): ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
        ]
            .filter((part) => part.length > 0)
            .join("\n"));
    }
    return {
        status,
        stderr,
        stdout,
    };
}
/** Runs a git command against a specific repo directory and returns the result. */
export function worktreeStackRunGit(repoDir, args, options = {}) {
    return worktreeStackRunCommand("git", ["-C", repoDir, ...args], {
        ...options,
        cwd: repoDir,
    });
}
/** Verifies that a shell command is available on PATH, throwing if not found. */
export function worktreeStackRequireCommand(commandName) {
    const result = spawnSync("which", [commandName], {
        encoding: "utf8",
        stdio: "ignore",
    });
    if (result.status === 0) {
        return;
    }
    worktreeStackError(`Required command is not available: ${commandName}`);
}
/** Asserts that a file exists at filePath, throwing with the given description if not. */
export function worktreeStackRequireFile(filePath, description) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return;
    }
    worktreeStackError(`Missing file (${description}): ${filePath}`);
}
/** Asserts that a directory exists at directoryPath, throwing with the given description if not. */
export function worktreeStackRequireDirectory(directoryPath, description) {
    if (fs.existsSync(directoryPath) &&
        fs.statSync(directoryPath).isDirectory()) {
        return;
    }
    worktreeStackError(`Missing directory (${description}): ${directoryPath}`);
}
//# sourceMappingURL=foundation.js.map