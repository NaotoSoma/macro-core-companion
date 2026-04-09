---
title: Codex（開発支援エージェント）運用メモ
description: この companion website を継続的に更新するときの最小ワークフロー。
sidebar:
  label: Codex運用
---

## 基本原則

- 公開本文は MDX（Markdown 拡張記法）
- 小さい interactive widget（対話型部品）だけ React（部品駆動の UI 基盤）
- 図表生成は必要なら Quarto（技術文書生成基盤）

## よく使う指示

- 「第2回の講義ページを追加して」
- 「第1回に図を1つ追加して」
- 「比較静学を示す小さい widget を作って」
- 「frontmatter を整えて sidebar を更新して」

## 実装前に見るファイル

- `AGENTS.md`
- `docs/content-template.md`
- `docs/widget-spec.md`
