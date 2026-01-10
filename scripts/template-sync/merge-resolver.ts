import micromatch from "micromatch";
import type {
  ChangedFile,
  ConflictResolution,
  FileSyncResult,
  MergeStrategy,
  TemplateSyncConfig,
} from "./types";
import {
  getFileContent,
  getLocalFileContent,
  getFileDiff,
  writeFile,
  deleteFile,
} from "./git-operations";
import {
  resolveConflict,
  displayInfo,
  displaySuccess,
  displayWarning,
} from "./interactive-ui";

/**
 * Filter files based on include/exclude patterns
 */
export function filterFiles(
  files: ChangedFile[],
  include: string[],
  exclude: string[]
): ChangedFile[] {
  return files.filter((file) => {
    // Check if file matches any include pattern
    const isIncluded = micromatch.isMatch(file.path, include);
    if (!isIncluded) {
      return false;
    }

    // Check if file matches any exclude pattern
    const isExcluded = exclude.length > 0 && micromatch.isMatch(file.path, exclude);
    return !isExcluded;
  });
}

/**
 * Get the merge strategy for a specific file
 */
export function getMergeStrategy(
  filePath: string,
  config: TemplateSyncConfig
): MergeStrategy {
  const patterns = config.mergeStrategy?.patterns || {};

  // Check if file matches any pattern-specific strategy
  for (const [pattern, strategy] of Object.entries(patterns)) {
    if (micromatch.isMatch(filePath, pattern)) {
      return strategy;
    }
  }

  // Return default strategy
  return config.mergeStrategy?.default || "prompt";
}

/**
 * Check if local file has been modified from the last sync
 */
export async function hasLocalModifications(
  filePath: string,
  lastSyncedCommit: string | null,
  upstreamCommit: string
): Promise<boolean> {
  if (!lastSyncedCommit) {
    // First sync - check if file exists locally
    const localContent = await getLocalFileContent(filePath);
    return localContent !== null;
  }

  // Compare local content with last synced content
  const lastSyncedContent = await getFileContent(lastSyncedCommit, filePath);
  const localContent = await getLocalFileContent(filePath);

  return localContent !== lastSyncedContent;
}

/**
 * Sync a single file
 */
export async function syncFile(
  file: ChangedFile,
  upstreamCommit: string,
  config: TemplateSyncConfig,
  options: { dryRun: boolean; force: boolean; verbose: boolean }
): Promise<FileSyncResult> {
  const { path, status } = file;
  const strategy = getMergeStrategy(path, config);

  if (options.verbose) {
    displayInfo(`処理中: ${path} (${status}, strategy: ${strategy})`);
  }

  // Handle deleted files
  if (status === "deleted") {
    if (options.dryRun) {
      return { path, status: "synced", message: "削除予定" };
    }

    const localContent = await getLocalFileContent(path);
    if (localContent === null) {
      // Already deleted locally
      return { path, status: "skipped", message: "既に削除済み" };
    }

    // Check if we should delete
    if (strategy === "local") {
      return { path, status: "skipped", message: "ローカル維持" };
    }

    if (strategy === "prompt" && !options.force) {
      const diff = await getFileDiff(config.lastSyncedCommit || null, upstreamCommit, path);
      const resolution = await resolveConflict(path, `(ファイル削除)\n${diff}`, strategy);

      if (resolution.action === "local" || resolution.action === "skip") {
        return { path, status: "skipped", message: "ユーザーがスキップ" };
      }
    }

    await deleteFile(path);
    displaySuccess(`削除: ${path}`);
    return { path, status: "synced", message: "削除" };
  }

  // Get upstream content
  const upstreamContent = await getFileContent(upstreamCommit, path);
  if (upstreamContent === null) {
    return { path, status: "error", message: "upstreamからコンテンツを取得できません" };
  }

  // Get local content
  const localContent = await getLocalFileContent(path);

  // Handle new files
  if (status === "added" || localContent === null) {
    if (options.dryRun) {
      return { path, status: "synced", message: "追加予定" };
    }

    await writeFile(path, upstreamContent);
    displaySuccess(`追加: ${path}`);
    return { path, status: "synced", message: "追加" };
  }

  // Handle modified files
  // Check if local has modifications
  const hasLocalMods = await hasLocalModifications(
    path,
    config.lastSyncedCommit || null,
    upstreamCommit
  );

  // If no local modifications, just apply upstream changes
  if (!hasLocalMods) {
    if (options.dryRun) {
      return { path, status: "synced", message: "更新予定" };
    }

    await writeFile(path, upstreamContent);
    displaySuccess(`更新: ${path}`);
    return { path, status: "synced", message: "更新" };
  }

  // Local has modifications - need to resolve conflict
  if (strategy === "upstream" || options.force) {
    if (options.dryRun) {
      return { path, status: "synced", message: "upstream適用予定（強制）" };
    }

    await writeFile(path, upstreamContent);
    displayWarning(`上書き: ${path} (upstreamを適用)`);
    return { path, status: "synced", message: "upstream適用" };
  }

  if (strategy === "local") {
    return { path, status: "skipped", message: "ローカル維持" };
  }

  if (strategy === "manual") {
    displayWarning(`手動対応が必要: ${path}`);
    return { path, status: "conflict", message: "手動対応が必要" };
  }

  // strategy === "prompt"
  if (options.dryRun) {
    return { path, status: "conflict", message: "競合（対話的解決が必要）" };
  }

  const diff = await getFileDiff(config.lastSyncedCommit || null, upstreamCommit, path);
  const resolution = await resolveConflict(path, diff, strategy);

  switch (resolution.action) {
    case "upstream":
      await writeFile(path, upstreamContent);
      displaySuccess(`適用: ${path} (upstreamを採用)`);
      return { path, status: "synced", message: "upstream適用" };

    case "local":
      displayInfo(`維持: ${path} (ローカルを維持)`);
      return { path, status: "skipped", message: "ローカル維持" };

    case "skip":
      displayWarning(`スキップ: ${path}`);
      return { path, status: "skipped", message: "スキップ" };

    case "manual":
      displayWarning(`手動対応が必要: ${path}`);
      return { path, status: "conflict", message: "手動対応が必要" };

    default:
      return { path, status: "skipped", message: "不明なアクション" };
  }
}
