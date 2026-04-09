# Update Checklist

1. 編集する
   `src/content/docs/`、`src/components/interactive/`、`src/styles/` を必要に応じて更新する。

2. ローカル確認
   `npm run check`
   `npm run build`
   必要なら `npm run dev` または `npm run preview`

3. Git に載せる
   `git add .`
   `git commit -m "変更内容が分かるメッセージ"`
   `git push`

4. 公開確認
   GitHub の `Actions` で `Deploy to GitHub Pages` が成功したか確認する。
   公開サイト: `https://naotosoma.github.io/macro-core-companion/`

5. 反映されないとき
   `Actions` の失敗ログを見る。
   ブラウザをリロードし、必要ならキャッシュも更新する。
