import * as readline from "readline";
import type { ChangedFile, ConflictResolution, MergeStrategy } from "./types";

/**
 * Create a readline interface for user input
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no question
 */
export async function confirmPrompt(message: string): Promise<boolean> {
  const rl = createReadline();

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Display a box with title
 */
export function displayBox(title: string, content?: string): void {
  const width = 60;
  const line = "=".repeat(width);

  console.log("");
  console.log(line);
  console.log(` ${title}`);
  console.log(line);
  if (content) {
    console.log(content);
    console.log(line);
  }
  console.log("");
}

/**
 * Display sync summary before starting
 */
export function displaySyncSummary(
  files: ChangedFile[],
  config: { upstreamBranch?: string; lastSyncedCommit?: string | null }
): void {
  displayBox("テンプレート同期");

  console.log(`同期元ブランチ: upstream/${config.upstreamBranch || "master"}`);
  console.log(`前回同期: ${config.lastSyncedCommit || "(初回同期)"}`);
  console.log("");

  const added = files.filter((f) => f.status === "added");
  const modified = files.filter((f) => f.status === "modified");
  const deleted = files.filter((f) => f.status === "deleted");

  console.log(`変更ファイル: ${files.length}件`);
  if (added.length > 0) {
    console.log(`  追加: ${added.length}件`);
    added.slice(0, 5).forEach((f) => console.log(`    + ${f.path}`));
    if (added.length > 5) console.log(`    ... 他${added.length - 5}件`);
  }
  if (modified.length > 0) {
    console.log(`  変更: ${modified.length}件`);
    modified.slice(0, 5).forEach((f) => console.log(`    M ${f.path}`));
    if (modified.length > 5)
      console.log(`    ... 他${modified.length - 5}件`);
  }
  if (deleted.length > 0) {
    console.log(`  削除: ${deleted.length}件`);
    deleted.slice(0, 5).forEach((f) => console.log(`    - ${f.path}`));
    if (deleted.length > 5)
      console.log(`    ... 他${deleted.length - 5}件`);
  }
  console.log("");
}

/**
 * Ask user to confirm sync start
 */
export async function confirmSyncStart(): Promise<boolean> {
  return confirmPrompt("同期を開始しますか？");
}

/**
 * Display diff preview
 */
export function displayDiff(
  filePath: string,
  diff: string,
  maxLines: number = 20
): void {
  console.log("");
  console.log(`ファイル: ${filePath}`);
  console.log("-".repeat(50));

  const lines = diff.split("\n");
  const displayLines = lines.slice(0, maxLines);

  displayLines.forEach((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      console.log(`\x1b[32m${line}\x1b[0m`); // Green for additions
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      console.log(`\x1b[31m${line}\x1b[0m`); // Red for deletions
    } else if (line.startsWith("@@")) {
      console.log(`\x1b[36m${line}\x1b[0m`); // Cyan for line info
    } else {
      console.log(line);
    }
  });

  if (lines.length > maxLines) {
    console.log(`... 省略 (全${lines.length}行)`);
  }
  console.log("-".repeat(50));
}

/**
 * Show conflict resolution menu
 */
export async function resolveConflict(
  filePath: string,
  diff: string,
  defaultStrategy: MergeStrategy
): Promise<ConflictResolution> {
  displayBox(`競合: ${filePath}`);
  displayDiff(filePath, diff, 15);

  console.log("");
  console.log("解決方法を選択してください:");
  console.log("  [u] テンプレート(upstream)を採用");
  console.log("  [l] ローカルを維持");
  console.log("  [d] 詳細な差分を表示");
  console.log("  [s] このファイルをスキップ");
  console.log("");

  const defaultLabel =
    defaultStrategy === "upstream"
      ? "u"
      : defaultStrategy === "local"
        ? "l"
        : "u";

  const rl = createReadline();

  return new Promise((resolve) => {
    const askChoice = () => {
      rl.question(`選択 [${defaultLabel}]: `, (answer) => {
        const choice = answer.toLowerCase() || defaultLabel;

        switch (choice) {
          case "u":
          case "upstream":
            rl.close();
            resolve({ action: "upstream" });
            break;
          case "l":
          case "local":
            rl.close();
            resolve({ action: "local" });
            break;
          case "d":
          case "diff":
            displayDiff(filePath, diff, 1000);
            askChoice();
            break;
          case "s":
          case "skip":
            rl.close();
            resolve({ action: "skip" });
            break;
          default:
            console.log("無効な選択です。もう一度入力してください。");
            askChoice();
        }
      });
    };

    askChoice();
  });
}

/**
 * Display progress
 */
export function displayProgress(current: number, total: number, message: string): void {
  const percentage = Math.round((current / total) * 100);
  const bar = "=".repeat(Math.floor(percentage / 5)) + " ".repeat(20 - Math.floor(percentage / 5));
  process.stdout.write(`\r[${bar}] ${percentage}% ${message}`);
}

/**
 * Display success message
 */
export function displaySuccess(message: string): void {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.log(`\x1b[31m✗ ${message}\x1b[0m`);
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
  console.log(`\x1b[33m⚠ ${message}\x1b[0m`);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
  console.log(`\x1b[36mℹ ${message}\x1b[0m`);
}

/**
 * Display sync results
 */
export function displaySyncResults(
  synced: number,
  skipped: number,
  errors: number
): void {
  console.log("");
  displayBox("同期完了");

  if (synced > 0) {
    displaySuccess(`${synced}件のファイルを同期しました`);
  }
  if (skipped > 0) {
    displayWarning(`${skipped}件のファイルをスキップしました`);
  }
  if (errors > 0) {
    displayError(`${errors}件のエラーが発生しました`);
  }
}
