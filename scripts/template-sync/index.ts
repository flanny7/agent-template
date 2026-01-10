#!/usr/bin/env bun
import { loadConfig, updateLastSyncedCommit, getConfigPath } from "./config";
import {
  ensureUpstreamRemote,
  fetchUpstream,
  getUpstreamCommit,
  getChangedFiles,
  hasUncommittedChanges,
  createBackup,
  restoreBackup,
} from "./git-operations";
import { filterFiles, syncFile } from "./merge-resolver";
import {
  displayBox,
  displaySyncSummary,
  confirmSyncStart,
  displaySyncResults,
  displayError,
  displayWarning,
  displayInfo,
  displaySuccess,
  confirmPrompt,
} from "./interactive-ui";
import type { CliOptions, FileSyncResult } from "./types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    force: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--dry-run":
      case "-n":
        options.dryRun = true;
        break;
      case "--force":
      case "-f":
        options.force = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--config":
      case "-c":
        options.configPath = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
template-sync - テンプレートリポジトリからアップデートを同期

使用方法:
  bun run sync [options]

オプション:
  -n, --dry-run    実際の変更を行わず、差分のみ表示
  -f, --force      確認なしで全てupstreamを採用
  -v, --verbose    詳細なログを表示
  -c, --config     設定ファイルのパスを指定
  -h, --help       このヘルプを表示

設定:
  template-sync.jsonc に同期設定を記述してください。
  template-sync.example.jsonc を参考にしてください。

例:
  bun run sync              # 通常の同期
  bun run sync --dry-run    # 差分確認のみ
  bun run sync --force      # 強制同期（確認なし）
`);
}

/**
 * Run post-sync commands
 */
async function runPostSyncCommands(
  commands: string[],
  options: { dryRun: boolean; verbose: boolean }
): Promise<void> {
  if (commands.length === 0) {
    return;
  }

  if (options.dryRun) {
    displayInfo("postSyncコマンド（dry-run時はスキップ）:");
    commands.forEach((cmd) => console.log(`  ${cmd}`));
    return;
  }

  displayInfo("postSyncコマンドを実行しています...");

  for (const command of commands) {
    if (options.verbose) {
      console.log(`  実行: ${command}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      if (options.verbose && stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
    } catch (error) {
      displayWarning(`コマンド失敗: ${command}`);
      if (options.verbose) {
        console.error(error);
      }
    }
  }
}

/**
 * Main sync function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    // Load configuration
    const config = await loadConfig(options);

    if (options.dryRun) {
      displayBox("テンプレート同期 (dry-run)");
    }

    // Check for uncommitted changes
    const hasChanges = await hasUncommittedChanges();
    if (hasChanges && !options.dryRun) {
      displayWarning("コミットされていない変更があります");
      const shouldContinue = await confirmPrompt(
        "変更をバックアップして続行しますか？"
      );
      if (!shouldContinue) {
        displayInfo("同期を中止しました");
        process.exit(0);
      }
    }

    // Create backup if needed
    let backupId: string | null = null;
    if (hasChanges && !options.dryRun) {
      backupId = await createBackup();
      if (backupId) {
        displayInfo(`バックアップを作成しました: ${backupId}`);
      }
    }

    try {
      // Ensure upstream remote is configured
      await ensureUpstreamRemote(config);

      // Fetch from upstream
      displayInfo("upstreamからフェッチしています...");
      await fetchUpstream(options.verbose);

      // Get upstream commit
      const upstreamCommit = await getUpstreamCommit(
        config.upstreamBranch || "master"
      );

      if (options.verbose) {
        displayInfo(`upstreamコミット: ${upstreamCommit}`);
        displayInfo(`前回同期コミット: ${config.lastSyncedCommit || "(なし)"}`);
      }

      // Get changed files
      const allChangedFiles = await getChangedFiles(
        config.lastSyncedCommit || null,
        upstreamCommit
      );

      if (allChangedFiles.length === 0) {
        displaySuccess("同期するファイルはありません（既に最新です）");
        return;
      }

      // Filter files based on include/exclude patterns
      const filesToSync = filterFiles(
        allChangedFiles,
        config.include,
        config.exclude || []
      );

      if (filesToSync.length === 0) {
        displaySuccess(
          "同期対象のファイルはありません（includeパターンに一致するファイルなし）"
        );
        return;
      }

      // Display summary
      displaySyncSummary(filesToSync, config);

      // Confirm before starting (unless force or dry-run)
      if (!options.force && !options.dryRun) {
        const shouldStart = await confirmSyncStart();
        if (!shouldStart) {
          displayInfo("同期を中止しました");

          // Restore backup if created
          if (backupId) {
            await restoreBackup(backupId);
            displayInfo("バックアップを復元しました");
          }
          return;
        }
      }

      // Sync each file
      const results: FileSyncResult[] = [];

      for (const file of filesToSync) {
        const result = await syncFile(file, upstreamCommit, config, options);
        results.push(result);
      }

      // Count results
      const synced = results.filter((r) => r.status === "synced").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errors = results.filter(
        (r) => r.status === "error" || r.status === "conflict"
      ).length;

      // Display results
      displaySyncResults(synced, skipped, errors);

      // Update lastSyncedCommit
      if (!options.dryRun && synced > 0) {
        await updateLastSyncedCommit(getConfigPath(options), upstreamCommit);
        displayInfo(`lastSyncedCommitを更新しました: ${upstreamCommit.slice(0, 8)}`);
      }

      // Run post-sync commands
      if (synced > 0) {
        await runPostSyncCommands(config.postSync || [], options);
      }

      // Show next steps
      if (!options.dryRun && synced > 0) {
        console.log("");
        displayInfo("次のステップ:");
        console.log("  1. git status で変更を確認");
        console.log("  2. git diff で差分を確認");
        console.log('  3. git commit -m "chore: sync with template updates"');
      }
    } catch (error) {
      // Restore backup on error
      if (backupId) {
        displayWarning("エラーが発生したため、バックアップを復元します...");
        await restoreBackup(backupId);
        displayInfo("バックアップを復元しました");
      }
      throw error;
    }
  } catch (error) {
    displayError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run main function
main();
