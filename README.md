# AgentTemplate

AIエージェントを使った開発をする際のテンプレートプロジェクト。

## 主な機能

- bun を使った高速なNode.js環境
- rulesync を使った各種AIエージェントの設定ファイルを共通で管理
- commitlint を使った ConfigConventional のlint
- husky を使った linterなどの CI環境
- template-sync を使ったテンプレートリポジトリからの更新同期
- その他、使えそうなprompt,subagent,skill,mcpのデフォルト設定

## 環境

- bun
- rulesync
- husky
- commitlint

## rules

### overview.md

核となるルールファイルです。
`bunx rulesync generate` で `CLAUDE.md`や`AGENTS.md`などになります。

#### agent-docs

ベストプラクティスに基づいて `overview.md` に「段階的開示」を提供します。
`overview.md` に `./agent-docs/**` のパスだけを記載し、ナレッジを別ファイルにまとめます。
ファイル名がそのナレッジを使うべきか判断する基準になるので、ファイル名の命名が大事です。

詳細は [./agent-docs/agent-docs_guideline.md](./agent-docs/agent-docs_guideline.md) にまとめています。

## skills

テンプレートに入れているスキルをいくつか紹介します。

### agent-memory

会話の要約を一時保存 & 再展開するスキルです。
「会話を覚えて」「この会話を思い出して」というと使ってくれます。
ContextWindowの消費を最小限にするためにセッションを切り替えたいときに役立ちます。

- <https://github.com/yamadashy/repomix/tree/main/.claude/skills/agent-memory>

[.rulesync/skills/agent-memory/LICENSE.txt](.rulesync/skills/agent-memory/LICENSE.txt) に記載している通り、rulesyncとの親和性を高めるために、保存場所を `./agent-docs/tmp` にしています。
また、`./agent-docs/tmp`は gitignore対象にしています。

また、明示的に使えるように commands も用意しています。

```txt
/save-agent-memory
/recall-agent-memory
```

## template-sync

テンプレートリポジトリの更新を派生プロジェクトに同期する機能です。

### 概要

このリポジトリをテンプレートとして新しいプロジェクトを作成した後、テンプレート側がアップデートされたときに、その差分を選択的に取り込むことができます。

- 同期対象のファイルを設定ファイルで指定可能（include/exclude パターン）
- 競合が発生した場合は対話的に解決
- 同期後に `bun install` や `rulesync generate` を自動実行

### 使い方

```bash
# 1. 設定ファイルを作成
cp template-sync.example.jsonc template-sync.jsonc
# upstream URL と include/exclude を編集

# 2. 差分を確認（dry-run）
bun run sync:check

# 3. 同期を実行
bun run sync

# 4. 変更をコミット
git add .
git commit -m "chore: sync with template updates"
```

### 設定ファイル

`template-sync.jsonc` で同期設定を管理します。サンプルは `template-sync.example.jsonc` を参照してください。

```jsonc
{
  // テンプレートリポジトリのURL
  "upstream": "https://github.com/your/template-repo.git",

  // 同期対象（glob パターン）
  "include": [
    ".rulesync/skills/**/*",
    ".rulesync/commands/**/*",
    ".husky/**/*"
  ],

  // 同期から除外
  "exclude": [
    ".rulesync/rules/**/*",
    "README.md"
  ],

  // 同期後に実行するコマンド
  "postSync": ["bun install", "bunx rulesync generate"]
}
```
