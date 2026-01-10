import { exec } from "child_process";
import { promisify } from "util";
import type { ChangedFile, FileStatus, TemplateSyncConfig } from "./types";

const execAsync = promisify(exec);

/**
 * Execute a git command and return the output
 */
async function git(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git ${command}`);
    return stdout.trim();
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(
      `gitコマンドエラー: git ${command}\n${err.stderr || err.message}`
    );
  }
}

/**
 * Check if upstream remote exists
 */
export async function hasUpstreamRemote(): Promise<boolean> {
  try {
    await git("remote get-url upstream");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the upstream remote URL
 */
export async function getUpstreamUrl(): Promise<string | null> {
  try {
    return await git("remote get-url upstream");
  } catch {
    return null;
  }
}

/**
 * Add upstream remote
 */
export async function addUpstreamRemote(url: string): Promise<void> {
  await git(`remote add upstream "${url}"`);
}

/**
 * Ensure upstream remote is configured
 */
export async function ensureUpstreamRemote(
  config: TemplateSyncConfig
): Promise<void> {
  const hasRemote = await hasUpstreamRemote();

  if (!hasRemote) {
    console.log(`upstream remoteを設定しています: ${config.upstream}`);
    await addUpstreamRemote(config.upstream);
  } else {
    const currentUrl = await getUpstreamUrl();
    if (currentUrl !== config.upstream) {
      console.log(
        `注意: upstream URLが設定と異なります\n` +
          `  設定: ${config.upstream}\n` +
          `  現在: ${currentUrl}`
      );
    }
  }
}

/**
 * Fetch from upstream
 */
export async function fetchUpstream(verbose: boolean = false): Promise<void> {
  if (verbose) {
    console.log("upstreamからフェッチしています...");
  }
  await git("fetch upstream");
}

/**
 * Get the latest commit hash from upstream branch
 */
export async function getUpstreamCommit(branch: string): Promise<string> {
  return await git(`rev-parse upstream/${branch}`);
}

/**
 * Get the current HEAD commit hash
 */
export async function getCurrentCommit(): Promise<string> {
  return await git("rev-parse HEAD");
}

/**
 * Get list of changed files between two commits
 */
export async function getChangedFiles(
  baseCommit: string | null,
  targetCommit: string
): Promise<ChangedFile[]> {
  // If no base commit, compare with empty tree (all files are "added")
  const base = baseCommit || "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // empty tree hash

  const output = await git(
    `diff --name-status ${base}..${targetCommit}`
  );

  if (!output) {
    return [];
  }

  return output.split("\n").map((line) => {
    const [statusCode, path] = line.split("\t");
    let status: FileStatus;

    switch (statusCode[0]) {
      case "A":
        status = "added";
        break;
      case "D":
        status = "deleted";
        break;
      default:
        status = "modified";
    }

    return { path, status };
  });
}

/**
 * Get file content from a specific commit
 */
export async function getFileContent(
  commit: string,
  filePath: string
): Promise<string | null> {
  try {
    return await git(`show ${commit}:${filePath}`);
  } catch {
    return null;
  }
}

/**
 * Get local file content (working tree)
 */
export async function getLocalFileContent(
  filePath: string
): Promise<string | null> {
  try {
    const { readFileSync, existsSync } = await import("fs");
    if (!existsSync(filePath)) {
      return null;
    }
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get diff between two versions of a file
 */
export async function getFileDiff(
  baseCommit: string | null,
  targetCommit: string,
  filePath: string
): Promise<string> {
  const base = baseCommit || "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

  try {
    return await git(`diff ${base}..${targetCommit} -- "${filePath}"`);
  } catch {
    return "";
  }
}

/**
 * Write content to a file
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  const { writeFileSync, mkdirSync } = await import("fs");
  const { dirname } = await import("path");

  // Ensure directory exists
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  const { unlinkSync, existsSync } = await import("fs");

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await git("status --porcelain");
  return status.length > 0;
}

/**
 * Create a stash backup
 */
export async function createBackup(): Promise<string | null> {
  const hasChanges = await hasUncommittedChanges();

  if (!hasChanges) {
    return null;
  }

  const timestamp = Date.now();
  await git(`stash push -m "template-sync-backup-${timestamp}"`);
  return `template-sync-backup-${timestamp}`;
}

/**
 * Restore from stash backup
 */
export async function restoreBackup(stashName: string): Promise<void> {
  const stashList = await git("stash list");
  const match = stashList.match(new RegExp(`(stash@\\{\\d+\\}):.*${stashName}`));

  if (match) {
    await git(`stash pop ${match[1]}`);
  }
}
