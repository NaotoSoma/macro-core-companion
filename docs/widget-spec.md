# Widget Specification

## Purpose

interactive widget（対話型部品）は、**本文だけでは掴みにくい比較静学や整合性**を可視化するために使う。

## Minimal requirements

各 widget は次を満たすこと。

- 教育目的が 1 つに絞られている
- 入力が少ない
- 出力が分かりやすい
- 依存ライブラリが軽い
- モバイルでも読める

## Naming

- `SomethingWidget.tsx`
- 目的が伝わる命名にする

## File header comment

各 widget 冒頭に以下を書く。

- 何を教える widget か
- どの講義ページで使うか

## Styling

- 既存 CSS 変数を使う
- ベタな色指定を最小限にする
- 余白を広めにとる

## Interaction patterns

推奨:

- toggle（切替）
- slider（連続パラメータ）
- radio group（離散選択）
- reveal / hide（表示切替）

非推奨:

- 複雑なドラッグ操作
- 高頻度アニメーション
- 重い外部チャートライブラリの早期導入
