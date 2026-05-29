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

import {
  worktreeStackListPreparedWorktrees,
  worktreeStackListRegisteredWorktrees,
} from "./worktree-discovery.js";

export type WorktreeStackCoreShellShim_ListMode =
  | "prepared-only"
  | "registered";

export type WorktreeStackCoreShellShim_ParseResult =
  | {
      command: "help";
    }
  | {
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
export class WorktreeStackCoreShellShimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeStackCoreShellShimError";
  }
}

/** Renders the shell shim usage banner. */
export function worktreeStackCoreShellShimRenderUsage(
  programName: string,
): string {
  return `Usage: ${programName} <command> [options]

Commands:
  list-worktrees --root <path> --mode registered|prepared-only
      Prints one absolute worktree path per line (sorted).
`;
}

/** Parses command argv into a help request or a validated list-worktrees invocation. */
export function worktreeStackCoreShellShimParseArgv(
  argv: readonly string[],
): WorktreeStackCoreShellShim_ParseResult {
  const [commandRaw, ...rest] = argv;
  const command = commandRaw ?? "";

  if (command.length === 0 || command === "--help" || command === "-h") {
    return { command: "help" };
  }

  if (command !== "list-worktrees") {
    throw new WorktreeStackCoreShellShimError(`Unknown command: ${command}`);
  }

  let root = "";
  let mode: WorktreeStackCoreShellShim_ListMode = "registered";

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--root") {
      root = rest[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--mode") {
      const rawMode = rest[index + 1] ?? "";
      index += 1;
      if (rawMode === "registered" || rawMode === "prepared-only") {
        mode = rawMode;
        continue;
      }
      throw new WorktreeStackCoreShellShimError(
        `--mode must be registered or prepared-only. Received: ${rawMode}`,
      );
    }
    throw new WorktreeStackCoreShellShimError(`Unknown argument: ${token ?? ""}`);
  }

  if (root.length === 0) {
    throw new WorktreeStackCoreShellShimError("list-worktrees requires --root <path>.");
  }

  return { command: "list-worktrees", mode, root };
}

/** Runs the shell shim and returns the desired process exit code. */
export function worktreeStackCoreShellShimRun(
  options: WorktreeStackCoreShellShim_RunOptions,
): number {
  const {
    argv,
    listPreparedWorktrees = worktreeStackListPreparedWorktrees,
    listRegisteredWorktrees = worktreeStackListRegisteredWorktrees,
    programName,
    writeStderr = (text) => {
      process.stderr.write(text);
    },
    writeStdout = (text) => {
      process.stdout.write(text);
    },
  } = options;

  let parsed: WorktreeStackCoreShellShim_ParseResult;
  try {
    parsed = worktreeStackCoreShellShimParseArgv(argv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    writeStderr(`[worktree] ERROR: ${message}\n`);
    return 2;
  }

  if (parsed.command === "help") {
    writeStdout(worktreeStackCoreShellShimRenderUsage(programName));
    return 0;
  }

  const paths =
    parsed.mode === "prepared-only"
      ? listPreparedWorktrees(parsed.root)
      : listRegisteredWorktrees(parsed.root);
  const sorted = [...paths].sort((left, right) => left.localeCompare(right));
  for (const line of sorted) {
    writeStdout(`${line}\n`);
  }
  return 0;
}
