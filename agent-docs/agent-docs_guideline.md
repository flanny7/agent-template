# agent-docsガイドライン

## agent-docsとは

ベストプラクティスに基づいて rulesファイル に「段階的開示」を提供します。
※ rulesファイル = AGENTS.md, CLAUDE.md, GEMINI.md, copilot-instructions.md など
SKILLS.mdが「目的に対する手段の提示」するのに対し、`agent-doc`は「目的に対する解決のヒントを提示」します。

手順:
- `./agent-docs` にナレッジを保存する
  - markdownファイルで保存する
  - どんなときに参照すべきかを英語で説明したファイル名にする
- `./agent-docs` のパスだけを `.rulesync/rules/overview.md` に記載する
- `rulesync generate` で `.rulesync/rules/overview.md` から rulesファイル を生成する
