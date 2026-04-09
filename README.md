# Macro Core Companion Starter

大学院コアコースのマクロ経済学向け companion website（講義補助サイト）を、Astro Starlight（Astro上のドキュメント基盤）+ MDX（Markdown拡張記法）+ React（部品駆動のUI基盤）で構築するためのスターターです。

このバンドルは、**Codex が最初の数ターンで迷わないこと**を最優先にしています。すでに Astro Starlight の新規プロジェクトを持っている場合は、このファイル群を上書き・追加してください。まだ何もない場合は、まず公式の Starlight テンプレートで初期化し、その後このバンドルを重ねるのが最も安全です。

## 推奨の始め方

### 方式A: 公式テンプレートの上に重ねる

```bash
npm create astro@latest -- --template starlight macro-core-companion
cd macro-core-companion
# このスターター一式をリポジトリ直下にコピー
npm install @astrojs/react react react-dom
npm run dev
```

### 方式B: このバンドルだけで始める

このディレクトリをそのまま Git 管理下に置き、以下を実行します。

```bash
git init
npm install
npm run dev
```

`package.json` では `latest` タグを使っているため、最新互換版が入ります。厳密な再現性が欲しい場合は、初回セットアップ後にバージョンを固定してください。

## 主要コマンド

```bash
npm run dev
npm run build
npm run preview
npm run check
npm run scaffold:lecture -- --week 2 --slug two-period-household --title "第2回 2期間家計モデル"
npm run scaffold:widget -- --name BudgetConstraintWidget
```

## ディレクトリ構成

```text
.
├── AGENTS.md
├── .codex/config.toml
├── docs/
├── quarto/
├── public/generated/
├── scripts/
├── skills/
└── src/
    ├── components/
    │   └── interactive/
    ├── content/
    │   └── docs/
    │       ├── lectures/
    │       └── workflow/
    ├── content.config.ts
    └── styles/
```

## いま入っているもの

- `AGENTS.md` — Codex 向けのプロジェクト規約
- `.codex/config.toml` — 推奨の Codex 設定
- `docs/` — 実装方針、ページ仕様、ウィジェット仕様、Quarto（技術文書生成基盤）運用メモ
- `skills/` — 繰り返し作業を短くする Codex 用 skill
- `scripts/` — 講義ページやウィジェットの雛形を自動生成する補助スクリプト
- `src/content/docs/lectures/01-general-equilibrium/index.mdx` — 第1回「一般均衡とは何か」の講義ページ雛形
- `src/components/interactive/GECoordinationWidget.tsx` — 第1回ページから読み込む最小のインタラクティブ部品

## 推奨ワークフロー

1. `AGENTS.md` を確認する。
2. Codex に「第2回の講義ページを追加して」など具体的に依頼する。
3. 必要なら skill を明示的に呼ぶ。
4. `npm run check && npm run build` を通す。
5. 公開用の文面とインタラクティブ部品を分けてレビューする。

## 注意

- 公開ページの本文は日本語を基本にし、英語の専門用語を出す場合は日本語を括弧書きで添えてください。
- React は必要最小限の island（部分的ハイドレーション部品）に限定してください。
- 図表の自動生成は Quarto を補助的に使い、生成物は `public/generated/` に置いてください。
