# Quarto Workflow

## Role of Quarto

Quarto（技術文書生成基盤）は、このリポジトリでは**図表生成とデータ更新の補助**に限定して使う。

公開本文そのものは Starlight / MDX 側に置く。

## Principle

- データ処理と公開本文を分離する
- 再現可能な生成物だけを配信に載せる
- 生成済みの静的成果物は `public/generated/` に置く

## Suggested structure

```text
quarto/
  lectures/
  datasets/
  scripts/
public/generated/
```

## Recommended output types

- PNG / SVG 図
- JSON サマリー
- CSV 集計表

## When to use Quarto

使うべき場面:

- データ更新が反復的
- 図表生成を再現したい
- Python / R / Julia の処理を分離したい

使わなくてよい場面:

- 手書きで十分な概念図
- 単純な表現の切替だけで済む widget
