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
import fs from "node:fs";
import path from "node:path";
import { worktreeStackRunGit } from "./foundation.js";
/** Returns true when a parsed JSON value can be traversed by object key. */
function worktreeStackIsJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Walks nested JSON to read a leaf string or number coerced to string.
 *
 * @remarks
 * Used by `worktreeStackReadJsonField` after parsing; returns null when the path is missing or
 * non-scalar.
 */
function worktreeStackReadJsonFieldInternal(data, fieldPath) {
    let current = data;
    for (const segment of fieldPath) {
        if (!worktreeStackIsJsonObject(current)) {
            return null;
        }
        current = current[segment];
    }
    if (typeof current === "string" || typeof current === "number") {
        return String(current);
    }
    return null;
}
/** Reads a top-level or nested string field from a JSON file, returning null if missing. */
export function worktreeStackReadJsonField(jsonFilePath, fieldPath) {
    if (!fs.existsSync(jsonFilePath)) {
        return null;
    }
    const payload = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
    return worktreeStackReadJsonFieldInternal(payload, fieldPath.split("."));
}
/** Returns the primary (first) worktree path for a git repository, falling back to rootDir. */
export function worktreeStackPrimaryWorktreePath(rootDir) {
    const result = worktreeStackRunGit(rootDir, ["worktree", "list", "--porcelain"], {
        allowFailure: true,
    });
    if (result.status !== 0) {
        return rootDir;
    }
    const match = /^worktree (.+)$/mu.exec(result.stdout);
    return match?.[1]?.trim() || rootDir;
}
/** Resolves the canonical root workspace path from metadata or primary worktree detection. */
export function worktreeStackResolveCanonicalRootWorkspacePath(projectRoot) {
    const metadataPath = path.join(projectRoot, ".tmp", "worktree-stack", "metadata.json");
    const fromMetadata = worktreeStackReadJsonField(metadataPath, "canonicalRootWorkspacePath");
    if (typeof fromMetadata === "string" &&
        fromMetadata.length > 0 &&
        fs.existsSync(fromMetadata)) {
        return fromMetadata;
    }
    const primaryPath = worktreeStackPrimaryWorktreePath(projectRoot);
    if (primaryPath !== projectRoot) {
        return primaryPath;
    }
    return projectRoot;
}
/**
 * Resolves the default base directory for prepared worktrees given a project root and configured
 * sibling directory name.
 */
export function worktreeStackResolveDefaultWorktreesBase(options) {
    const { defaultWorktreesDirectoryName, projectRoot } = options;
    const canonicalRootWorkspacePath = worktreeStackResolveCanonicalRootWorkspacePath(projectRoot);
    if (canonicalRootWorkspacePath !== projectRoot) {
        return path.join(path.dirname(canonicalRootWorkspacePath), defaultWorktreesDirectoryName);
    }
    const parentDir = path.dirname(projectRoot);
    if (path.basename(parentDir) === defaultWorktreesDirectoryName) {
        return parentDir;
    }
    return path.join(parentDir, defaultWorktreesDirectoryName);
}
/** Returns a YYMMDD-formatted date token for worktree folder naming. */
export function worktreeStackFormatFolderDateToken() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}
/**
 * Builds a short realm segment for prepared-worktree folder names.
 *
 * @remarks
 * Normalizes slugs, maps pooled `worktree-N` realms to `WTnn`, otherwise builds initials plus
 * digits capped at six characters.
 */
function worktreeStackBuildRealmFolderToken(realmSlug) {
    const normalizedRealmSlug = realmSlug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/gu, "-")
        .replace(/^-+/u, "")
        .replace(/-+$/u, "")
        .replace(/-+/gu, "-");
    const pooledRealmMatch = /^worktree-(\d+)$/u.exec(normalizedRealmSlug);
    if (pooledRealmMatch?.[1]) {
        return `WT${String(Number.parseInt(pooledRealmMatch[1], 10)).padStart(2, "0")}`;
    }
    const segments = normalizedRealmSlug.split(/[^A-Za-z0-9]+/u).filter(Boolean);
    let token = "R";
    for (const segment of segments) {
        if (/^\d+$/u.test(segment)) {
            token += segment;
            continue;
        }
        token += segment.slice(0, 1).toUpperCase();
    }
    if (token === "R") {
        token = "R0";
    }
    return token.slice(0, 6);
}
/**
 * Builds a filesystem-safe uppercase stack label segment for folder names.
 *
 * @remarks
 * Sanitizes to alphanumerics and hyphens; falls back to `STACK` when the normalized value is empty.
 */
function worktreeStackBuildStackFolderToken(stackName) {
    const normalized = stackName
        .replace(/[^A-Za-z0-9-]+/gu, "-")
        .replace(/^-+/u, "")
        .replace(/-+$/u, "")
        .replace(/-+/gu, "-")
        .toUpperCase();
    return normalized.length > 0 ? normalized : "STACK";
}
/** Builds a combined folder name from a date token, realm slug, and stack name. */
export function worktreeStackBuildFolderName(dateToken, realmSlug, stackName) {
    const realmToken = worktreeStackBuildRealmFolderToken(realmSlug);
    const stackToken = worktreeStackBuildStackFolderToken(stackName);
    return `${dateToken}${realmToken}-${stackToken}`;
}
/** Lists all registered git worktrees (including the primary) under rootDir. */
export function worktreeStackListRegisteredWorktrees(rootDir) {
    const result = worktreeStackRunGit(rootDir, ["worktree", "list", "--porcelain"], {
        allowFailure: true,
    });
    if (result.status !== 0) {
        return [];
    }
    return result.stdout
        .split(/\r?\n/gu)
        .map((line) => /^worktree (.+)$/u.exec(line)?.[1]?.trim() ?? "")
        .filter((line) => line.length > 0);
}
/**
 * Lists registered worktrees that contain prepared-worktree metadata under `.tmp/worktree-stack/`.
 *
 * @remarks
 * I/O: Reads the filesystem for `metadata.json` markers; excludes the primary checkout at
 * `rootDir`.
 */
export function worktreeStackListPreparedWorktrees(rootDir) {
    return worktreeStackListRegisteredWorktrees(rootDir).filter((candidatePath) => {
        if (candidatePath === rootDir) {
            return false;
        }
        return fs.existsSync(path.join(candidatePath, ".tmp", "worktree-stack", "metadata.json"));
    });
}
/** Collects all used slot numbers from prepared worktrees under rootDir. */
export function worktreeStackCollectUsedSlots(rootDir) {
    const slots = new Set();
    for (const candidatePath of worktreeStackListRegisteredWorktrees(rootDir)) {
        if (candidatePath === rootDir) {
            continue;
        }
        const metadataPath = path.join(candidatePath, ".tmp", "worktree-stack", "metadata.json");
        const slotValue = worktreeStackReadJsonField(metadataPath, "slot");
        const slot = Number.parseInt(slotValue ?? "", 10);
        if (!Number.isInteger(slot) || slot <= 0) {
            continue;
        }
        slots.add(slot);
    }
    return [...slots].sort((left, right) => left - right);
}
/** Picks the next available slot number (lowest positive integer not yet used). */
export function worktreeStackPickNextSlot(rootDir) {
    const usedSlots = new Set(worktreeStackCollectUsedSlots(rootDir));
    let candidateSlot = 1;
    while (usedSlots.has(candidateSlot)) {
        candidateSlot += 1;
    }
    return candidateSlot;
}
/** Returns the path to the worktree metadata JSON file for a given worktree. */
export function worktreeStackMetadataPathForWorktree(worktreePath) {
    return path.join(worktreePath, ".tmp", "worktree-stack", "metadata.json");
}
/** Returns the path to the worktree-info JSON file for a given worktree. */
export function worktreeStackHandbookJsonPathForWorktree(worktreePath) {
    return path.join(worktreePath, ".tmp", "worktree-stack", "worktree-info.json");
}
/** Returns the path to the canonical-root-workspace-path reference file for a given worktree. */
export function worktreeStackCanonicalRootReferencePathForWorktree(worktreePath) {
    return path.join(worktreePath, ".tmp", "worktree-stack", "canonical-root-workspace-path.txt");
}
/** Returns true if the path appears to be a transient helper worktree (contains "/.tmp/"). */
export function worktreeStackIsTransientHelperWorktreePath(candidatePath) {
    return candidatePath.includes("/.tmp/");
}
/** Lists prepared worktrees that can be repaired (excludes transient helper worktrees). */
export function worktreeStackListRepairablePreparedWorktrees(rootDir) {
    return worktreeStackListPreparedWorktrees(rootDir).filter((candidatePath) => !worktreeStackIsTransientHelperWorktreePath(candidatePath));
}
/** Reads a state field from the worktree metadata or handbook JSON, preferring metadata. */
export function worktreeStackReadPreparedStateField(worktreePath, fieldPath) {
    const metadataValue = worktreeStackReadJsonField(worktreeStackMetadataPathForWorktree(worktreePath), fieldPath);
    if (metadataValue !== null) {
        return metadataValue;
    }
    return worktreeStackReadJsonField(worktreeStackHandbookJsonPathForWorktree(worktreePath), fieldPath);
}
/**
 * Resolves the canonical root workspace path recorded for a prepared worktree, with safe fallbacks.
 *
 * @remarks
 * I/O: Reads small reference files under the worktree `.tmp` tree synchronously.
 */
export function worktreeStackResolvePreparedCanonicalRootWorkspacePath(worktreePath, fallbackPath) {
    const referencePath = worktreeStackCanonicalRootReferencePathForWorktree(worktreePath);
    if (fs.existsSync(referencePath)) {
        const value = fs.readFileSync(referencePath, "utf8").trim();
        if (value.length > 0) {
            return value;
        }
    }
    const metadataValue = worktreeStackReadPreparedStateField(worktreePath, "canonicalRootWorkspacePath");
    if (metadataValue !== null && metadataValue.length > 0) {
        return metadataValue;
    }
    return fallbackPath ?? "";
}
