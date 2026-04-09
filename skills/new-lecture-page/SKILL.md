---
name: new-lecture-page
description: Use this skill when adding or revising a lecture page under src/content/docs/lectures/. Trigger for requests like "第2回を追加", "講義ノートを新規作成", or "lecture page の雛形を作って". Do not use for widget-only changes or data-only updates.
---

# Goal

講義ページを、既存のテンプレートと frontmatter 規約に沿って追加する。

# Inputs you need

- 回番号
- slug
- ページタイトル
- section
- その回の中核メッセージ

# Steps

1. `AGENTS.md` と `docs/content-template.md` を読む。
2. 必要なら以下を実行する。

```bash
npm run scaffold:lecture -- --week 2 --slug two-period-household --title "第2回 2期間家計モデル" --section core
```

3. 生成された `index.mdx` の frontmatter を埋める。
4. 本文を「今日の問い → 直感 → 最小モデル → interactive widget → データで確かめる → 演習 → 一般化」の順で埋める。
5. 英語の専門用語には日本語を括弧書きで添える。
6. 必要なら widget 名を frontmatter の `widgets` に追加する。
7. 可能なら `npm run check && npm run build` を通す。

# Output

- 新しい講義ページファイル
- 必要なら関連する sidebar または landing page の更新
