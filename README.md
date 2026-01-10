# AgentTemplate

AIエージェントを使った開発をする際のテンプレートプロジェクト。

## 主な機能

- bun を使った高速なNode.js環境
- rulesync を使った各種AIエージェントの設定ファイルを共通で管理
- commitlint を使った ConfigConventional のlint
- husky を使った linterなどの CI環境
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

詳細は `./agent-docs/agent-docs_guideline.md` にまとめています。

## skills

テンプレートに入れているスキルをいくつか紹介します。

### agent-memory

会話の要約を一時保存 & 再展開するスキルです。
「会話を覚えて」「この会話を思い出して」というと使ってくれます。
ContextWindowの消費を最小限にするためにセッションを切り替えたいときに役立ちます。

`.rulesync/skills/agent-memory/LICENSE.txt` に記載している通り、rulesyncとの親和性を高めるために、保存場所を `./agent-docs/tmp` にしています。
また、`./agent-docs/tmp`は gitignore対象にしています。

また、明示的に使えるように commands も用意しています。

```txt
/save-agent-memory
/recall-agent-memory
```
