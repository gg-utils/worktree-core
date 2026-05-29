/**
 * @fileoverview Owns regression tests for product-neutral worktree foundation helpers covering shell quoting,
 * JSON string escaping, synchronous command capture with allowFailure, filesystem path guards, duration
 * measurement, and prefixed error throws.
 *
 * Flow: invoke `worktreeStack*` helpers from `foundation.ts` -> assert stdout/stderr/status, guard failures, and
 * `worktreeStackError` message shapes.
 *
 * @testing Node.js test runner: npm run worktree-core:test
 *
 * @see packages/worktree-core/src/foundation.ts - Foundation module under test that implements quoted shell arguments, synchronous subprocess capture, filesystem guards, JSON escape, duration helpers, and `[worktree]` error prefixes asserted here.
 * @see packages/worktree-kit/src/start-command.ts - Worktree-kit start command that imports the same foundation helpers for subprocess orchestration covered by this suite.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  worktreeStackError,
  worktreeStackJsonEscape,
  worktreeStackMeasureDurationMs,
  worktreeStackRequireDirectory,
  worktreeStackRequireFile,
  worktreeStackRunCommand,
  worktreeStackShellQuote,
} from "./foundation.js";

test("worktreeStackShellQuote quotes empty strings and single quotes", () => {
  assert.equal(worktreeStackShellQuote(""), "''");
  assert.equal(worktreeStackShellQuote("plain"), "'plain'");
  assert.equal(worktreeStackShellQuote("has ' quote"), "'has '\\'' quote'");
});

test("worktreeStackMeasureDurationMs subtracts timestamps", () => {
  assert.equal(worktreeStackMeasureDurationMs(10, 42), 32);
});

test("worktreeStackJsonEscape strips JSON string delimiters", () => {
  assert.equal(
    worktreeStackJsonEscape('quote " and slash \\'),
    'quote \\" and slash \\\\',
  );
});

test("worktreeStackRunCommand returns captured output and supports allowed failures", () => {
  const ok = worktreeStackRunCommand(process.execPath, [
    "-e",
    "process.stdout.write('ok'); process.stderr.write('warn')",
  ]);
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, "ok");
  assert.equal(ok.stderr, "warn");

  const allowed = worktreeStackRunCommand(
    process.execPath,
    ["-e", "process.stderr.write('bad'); process.exit(7)"],
    { allowFailure: true },
  );
  assert.equal(allowed.status, 7);
  assert.equal(allowed.stderr, "bad");

  assert.throws(
    () => worktreeStackRunCommand(process.execPath, ["-e", "process.exit(7)"]),
    /Command failed \(7\)/u,
  );
});

test("worktreeStackRequireFile and worktreeStackRequireDirectory guard paths", () => {
  const sandbox = fs.mkdtempSync(
    path.join(os.tmpdir(), "worktree-foundation-"),
  );
  const filePath = path.join(sandbox, "file.txt");
  fs.writeFileSync(filePath, "ok", "utf8");

  worktreeStackRequireDirectory(sandbox, "sandbox");
  worktreeStackRequireFile(filePath, "file");

  assert.throws(
    () => worktreeStackRequireDirectory(filePath, "not-directory"),
    /Missing directory/u,
  );
  assert.throws(
    () => worktreeStackRequireFile(path.join(sandbox, "missing"), "missing"),
    /Missing file/u,
  );

  fs.rmSync(sandbox, { force: true, recursive: true });
});

test("worktreeStackError adds the historical error prefix", () => {
  assert.throws(() => worktreeStackError("nope"), /\[worktree\] ERROR: nope/u);
});
