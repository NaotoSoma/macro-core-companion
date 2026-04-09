# Site Architecture

## Decision summary

このサイトは、Astro Starlight（Astro 上のドキュメント基盤）を母体にし、MDX（Markdown 拡張記法）で講義ノートを書き、React（部品駆動の UI 基盤）は小さな interactive widget（対話型部品）に限定して使う。

## Why this architecture

### 1. 読む部分が主役だから

講義ノートは、本文を読む時間が大部分を占める。したがって、サイト全体を single-page app（単一ページアプリ）にするよりも、静的生成を基本にした方が速く、保守もしやすい。

### 2. それでも少しは触らせたいから

比較静学や均衡の整合性は、スライダーやトグルを使うと理解が深まりやすい。Astro の island（部分的ハイドレーション）方式なら、その部分だけを React で動かせる。

### 3. データ生成は本文から分離したいから

図表の生成ロジックと公開用ページ本文を分けたい。Quarto（技術文書生成基盤）を補助的に使うと、再現可能な図表生成を別レイヤーで管理しやすい。

## Core design rules

- lecture page（講義ページ）は MDX で書く。
- interactive widget は 1 概念 1 ファイルに分ける。
- frontmatter は講義運営に必要なメタデータまで拡張する。
- 公開用の本文は日本語を基本とする。
- データ更新と本文編集を分ける。

## Public vs internal docs

### Public

`src/content/docs/` 以下のファイル。受講生が読む。

### Internal

`docs/` 以下のファイル。Codex と教員側の運用メモ。

## Planned evolution

### Phase 1

- 第1回〜第3回を整備
- 共通テンプレートの固定
- 小さい widget を 2〜3 個作る

### Phase 2

- Quarto 連携を追加
- データ図表の自動生成
- 講義一覧・キーワード導線の整備

### Phase 3

- 英語版の追加
- 参考文献ページ
- 用語集
