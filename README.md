# マクロ経済学研究

大学院マクロ経済学のための companion website です。  
小さいモデル、対話型 widget、データ確認を組み合わせながら、各回の講義内容を読みやすく整理しています。

公開サイト:

- https://naotosoma.github.io/macro-core-companion/

## このリポジトリの内容

- 第1回「一般均衡とは何か」を中心とした講義ノート
- Astro + Starlight + MDX による静的サイト構成
- React + SVG による軽量な interactive widget
- GitHub Pages への自動デプロイ設定

## 主な技術スタック

- Astro
- Starlight
- MDX
- React
- TypeScript

## ローカルで確認する方法

```bash
npm install
npm run check
npm run build
npm run dev
```

`npm run dev` のあと、表示されたローカル URL をブラウザで開いて確認できます。

## ディレクトリの目安

- `src/content/docs/` 講義ノート本文
- `src/components/interactive/` interactive widget
- `src/styles/` 共通スタイル
- `docs/` 内部向けメモと仕様書

## 公開

`main` ブランチへの push をきっかけに、GitHub Actions から GitHub Pages へ自動デプロイされます。
