# Macro Core Companion — Project Instructions for Codex

## 1. Project goal

このリポジトリは、大学院コアコースのマクロ経済学向け companion website（講義補助サイト）です。

最優先の目的は次の3つです。

1. 15回の講義ノートを、**小さいモデル**と**明確な問い**で構成する。
2. 各回に 1〜2 個の interactive widget（対話型部品）を入れ、比較静学や均衡の整合性を可視化する。
3. 公開ページは読みやすさを優先し、JavaScript の負荷を最小限にする。

## 2. Stack

- Astro（静的サイト基盤）
- Starlight（Astro 上のドキュメント基盤）
- MDX（Markdown 拡張記法）
- React（部品駆動の UI 基盤） for small islands only
- Quarto（技術文書生成基盤） for optional figure/data generation only

## 3. High-level rules

- 本文ページは **MDX** で書く。
- 1ページを巨大なアプリにしない。**1概念 = 1小部品** で切る。
- React は、スライダー・トグル・比較静学・位相図など、**明確な教育目的**があるときだけ使う。
- レイアウトやスタイルは既存の共通部品を再利用し、ページごとに独自 UI を増やさない。
- 公開ページの本文は日本語を基本にする。
- 日本語本文の中で英語の専門用語を書くときは、最も近い日本語を括弧書きで添える。
  - 例: general equilibrium（一般均衡）
  - 例: representative agent（代表的主体）
  - 例: steady state（定常状態）
- コード中の識別子とコメントは英語でよい。

## 4. Build and validation

実装や編集のあと、可能なら必ず次を通す。

```bash
npm run check
npm run build
```

ローカル確認は次。

```bash
npm run dev
```

## 5. Where things live

### Public docs content

- `src/content/docs/index.md` — トップページ
- `src/content/docs/lectures/` — 各回の講義ページ
- `src/content/docs/workflow/` — 公開してよい運用ページ

### Internal project docs

- `docs/architecture.md` — サイト設計の原則
- `docs/content-template.md` — 講義ページのテンプレート規約
- `docs/widget-spec.md` — interactive widget の仕様
- `docs/quarto-workflow.md` — Quarto を使うときの規約

### Interactive components

- `src/components/interactive/` — React または Astro の小部品

### Generated assets

- `public/generated/` — Quarto などで生成された静的成果物

## 6. Lecture page conventions

各講義ページは、原則として次の順序を守る。

1. 今日の問い
2. 直感
3. 最小モデル
4. interactive widget
5. データで確かめる
6. 演習または確認質問
7. 無限期間版・一般化への橋渡し

1ページで扱う主張は多くしすぎない。1回のページは **1つの中核メッセージ** を中心にまとめる。

## 7. Widget conventions

- widget は概念名ベースで命名する。
  - 良い例: `GECoordinationWidget.tsx`
  - 良い例: `SolowPhaseDiagramWidget.tsx`
- 各 widget は、入力・出力・教育目的が 1 つのファイルを見れば分かるようにする。
- 依存はできるだけ増やさない。軽量実装を優先する。
- グラフライブラリは、必要になるまでは入れない。
- まずは HTML + CSS + React state で十分か考える。

## 8. Content frontmatter

Starlight の標準 frontmatter に加え、以下の拡張メタデータを使う。

- `week`
- `section`
- `estimatedTime`
- `prerequisites`
- `learningGoals`
- `keywords`
- `datasets`
- `widgets`
- `status`

frontmatter を追加するときは、`src/content.config.ts` の schema も更新する。

## 9. Safe defaults for Codex tasks

### When asked to add a lecture page

1. 既存の命名規則を確認する。
2. `scripts/scaffold-lecture.mjs` を使えるなら使う。
3. frontmatter を埋める。
4. セクション見出しをテンプレートどおりに入れる。
5. まだ内容が未確定なら、空欄ではなく TODO を明示する。

### When asked to add a widget

1. `scripts/scaffold-widget.mjs` を使えるなら使う。
2. props を最小限にする。
3. 教育目的をファイル冒頭コメントに 1〜2 行で書く。
4. MDX ページへの組み込み例も同時に追加する。

### When asked to update data or figures

1. `docs/quarto-workflow.md` を読む。
2. 再現可能な処理は Quarto 側に寄せる。
3. 生成物だけを `public/generated/` に置く。
4. 生データを勝手にコミットしない。

## 10. Things to avoid

- いきなり複雑な client-side app（クライアント側アプリ）にしない。
- ページごとに独自の CSS ルールを大量に増やさない。
- 数式を画像にしない。本文で書けるものは本文で書く。
- 1つのページで複数の新しい概念を一気に導入しない。
- 公開ページ本文を英語中心にしない。

## 11. First priorities if the user asks “continue building”

優先順位は次。

1. 第1回ページを整える
2. 共通の lecture block（講義用共通部品）を整備する
3. 第2回・第3回のページを追加する
4. Quarto 連携の最小例を作る
5. 検索・タグ・一覧ページを整備する
