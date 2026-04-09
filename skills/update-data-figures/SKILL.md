---
name: update-data-figures
description: Use this skill when the task is to regenerate data-backed figures or summaries, especially when Quarto should be used. Trigger for requests like "図を更新", "データを差し替えて", or "公的データから時系列図を再生成して". Do not use for purely conceptual widgets.
---

# Goal

データ処理と公開本文を分離したまま、図表や集計結果を更新する。

# Steps

1. `AGENTS.md` と `docs/quarto-workflow.md` を読む。
2. 生成ロジックはできるだけ Quarto（技術文書生成基盤）側に置く。
3. 出力は `public/generated/` に置く。
4. 公開本文は生成物への参照だけを持つようにする。
5. 生データの扱いを慎重に確認する。
6. 再現性に必要な手順を更新する。

# Output

- 更新された図表または集計成果物
- 必要なら lecture page 側の参照更新
