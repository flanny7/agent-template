import { readFileSync, existsSync, writeFileSync } from "fs";
import { parse } from "jsonc-parser";
import type { TemplateSyncConfig, CliOptions } from "./types";

const DEFAULT_CONFIG_PATH = "template-sync.jsonc";

/**
 * Load and parse the template-sync configuration file
 */
export async function loadConfig(
  options: Pick<CliOptions, "configPath" | "verbose">
): Promise<TemplateSyncConfig> {
  const configPath = options.configPath || DEFAULT_CONFIG_PATH;

  if (!existsSync(configPath)) {
    throw new Error(
      `設定ファイルが見つかりません: ${configPath}\n` +
        `template-sync.example.jsonc をコピーして設定を作成してください:\n` +
        `  cp template-sync.example.jsonc template-sync.jsonc`
    );
  }

  const content = readFileSync(configPath, "utf-8");
  const config = parse(content) as TemplateSyncConfig;

  // Validate required fields
  if (!config.upstream) {
    throw new Error("設定エラー: upstream URLが指定されていません");
  }

  if (!config.include || config.include.length === 0) {
    throw new Error("設定エラー: includeパターンが指定されていません");
  }

  // Set defaults
  config.upstreamBranch = config.upstreamBranch || "master";
  config.exclude = config.exclude || [];
  config.mergeStrategy = config.mergeStrategy || { default: "prompt" };
  config.mergeStrategy.default = config.mergeStrategy.default || "prompt";
  config.postSync = config.postSync || [];

  if (options.verbose) {
    console.log("設定ファイルを読み込みました:", configPath);
    console.log("  upstream:", config.upstream);
    console.log("  upstreamBranch:", config.upstreamBranch);
    console.log("  include patterns:", config.include.length);
    console.log("  exclude patterns:", config.exclude.length);
  }

  return config;
}

/**
 * Update the lastSyncedCommit in the config file
 */
export async function updateLastSyncedCommit(
  configPath: string | undefined,
  commit: string
): Promise<void> {
  const path = configPath || DEFAULT_CONFIG_PATH;
  const content = readFileSync(path, "utf-8");
  const config = parse(content) as TemplateSyncConfig;

  config.lastSyncedCommit = commit;

  // Preserve comments by using a simple replacement approach
  // This is a simplified version - for full comment preservation,
  // we'd need more sophisticated JSONC manipulation
  const updatedContent = content.replace(
    /"lastSyncedCommit":\s*(null|"[^"]*")/,
    `"lastSyncedCommit": "${commit}"`
  );

  writeFileSync(path, updatedContent, "utf-8");
}

/**
 * Get the config file path
 */
export function getConfigPath(options: Pick<CliOptions, "configPath">): string {
  return options.configPath || DEFAULT_CONFIG_PATH;
}
