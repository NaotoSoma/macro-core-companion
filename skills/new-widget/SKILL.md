---
name: new-widget
description: Use this skill when creating a new interactive teaching widget in src/components/interactive/. Trigger for requests like "スライダー付きの部品を作って", "新しい widget を追加", or "この講義に小さなインタラクションを入れて". Do not use for page-only text edits.
---

# Goal

教育目的が明確な小さな interactive widget（対話型部品）を 1 つ追加する。

# Inputs you need

- widget の教育目的
- 入力の種類
- 出力の種類
- 使う講義ページ

# Steps

1. `AGENTS.md` と `docs/widget-spec.md` を読む。
2. 必要なら以下を実行する。

```bash
npm run scaffold:widget -- --name BudgetConstraintWidget
```

3. 雛形を最小限の状態管理で置き換える。
4. 依存ライブラリを増やす前に、React 標準機能だけで十分か確認する。
5. 教育目的が冒頭コメントで伝わるようにする。
6. 使用例を対応する MDX ページに追加する。
7. 可能なら `npm run check && npm run build` を通す。

# Output

- `src/components/interactive/` 以下の widget
- 必要なら対応する講義ページの組み込みコード
