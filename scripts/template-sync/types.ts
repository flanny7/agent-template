/**
 * Merge strategy for handling conflicts
 */
export type MergeStrategy = "prompt" | "upstream" | "local" | "manual";

/**
 * Configuration for template-sync
 */
export interface TemplateSyncConfig {
  $schema?: string;
  upstream: string;
  upstreamBranch?: string;
  include: string[];
  exclude?: string[];
  mergeStrategy?: {
    default?: MergeStrategy;
    patterns?: Record<string, MergeStrategy>;
  };
  postSync?: string[];
  lastSyncedCommit?: string | null;
}

/**
 * File change status
 */
export type FileStatus = "added" | "modified" | "deleted";

/**
 * Information about a changed file
 */
export interface ChangedFile {
  path: string;
  status: FileStatus;
}

/**
 * Result of conflict resolution
 */
export interface ConflictResolution {
  action: "upstream" | "local" | "manual" | "skip";
  manualContent?: string;
}

/**
 * CLI options
 */
export interface CliOptions {
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  configPath?: string;
}

/**
 * Sync result for a single file
 */
export interface FileSyncResult {
  path: string;
  status: "synced" | "skipped" | "conflict" | "error";
  message?: string;
}

/**
 * Overall sync result
 */
export interface SyncResult {
  success: boolean;
  syncedFiles: FileSyncResult[];
  skippedFiles: string[];
  errors: string[];
  newCommit?: string;
}
