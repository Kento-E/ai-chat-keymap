# Copilot 出力ルール

このリポジトリでは、Copilot（AIエージェント）のすべての出力を**日本語**で行うこと。

対象範囲：
- PRタイトル
- PR概要文
- コミットメッセージ
- コード内コメント（インラインコメント・JSDoc含む）
- レビューコメント・返信

---

# コードレビュー指摘の再発防止チェックリスト

`manifest.json` や `content.js` を変更・レビューする際は以下の項目を必ず確認すること。

## manifest.json

- [ ] `run_at` は `"document_start"` になっているか
  - `"document_idle"` だとサイト側がキャプチャフェーズで先にリスナーを登録してしまい、キーイベントを横取りできない場合がある
- [ ] GitHub Copilot の `matches` は `"https://github.com/copilot"` と `"https://github.com/copilot/*"` の2行になっているか
  - `"https://github.com/copilot*"` のようにワイルドカードをパスに直接付けると `/copilot-foo` などの意図しないパスにもマッチする

## content.js

- [ ] GitHub Copilot のパス判定に正規表現 `/^\/copilot(?:\/|$)/` を使っているか
  - `startsWith('/copilot')` では `/copilot-foo` も `true` になり意図しないページに介入する
- [ ] `event.stopImmediatePropagation()` のみ呼び、`event.stopPropagation()` を重複して呼んでいないか
  - `stopImmediatePropagation()` は後続リスナーの停止に加えて伝播自体も止めるため、直後の `stopPropagation()` は冗長

## .github/copilot/skills/

- [ ] スキルファイルは `.github/copilot/skills/<スキル名>/SKILL.md` という構造になっているか
  - ファイル名は必ず `SKILL.md`（任意のファイル名は不可）
  - スキルごとにサブディレクトリを作成する
