# 16 Cloudflareアカウントとドメインの設定

状態: 未着手

## 決まっていること

- Cloudflareアカウントを新規に作る。
- ドメインは、お名前.comで取得済みのものを使う。

## 前提

Workerに独自ドメインを割り当てるには、そのドメインのDNSをCloudflareで管理する必要がある。ドメインの登録はお名前.comのままで、ネームサーバーだけをCloudflareに向ける。

そのドメインをメールや別のサイトで使っている場合は、既存のDNSレコードをCloudflareへ移す必要がある。Cloudflareが自動で読み込むが、漏れがないか確認する。

## 決定事項（2026-11-12）

- 番組のURLは `tani-radio.gohanokawari.com`。
- `gohanokawari.com` は他の用途で使っていない。既存DNSレコードの移行は不要。
- Cloudflareに追加するのは親ドメインの `gohanokawari.com`。ネームサーバーをCloudflareに向けるので、今後このドメインのDNSはCloudflareで管理することになる。

## やること（本人の作業）

アカウント作成とネームサーバー変更は本人が行う。

- [ ] Cloudflareアカウントを作る
- [ ] Cloudflareにドメインを追加し、読み込まれたDNSレコードを確認する
- [ ] お名前.comでネームサーバーをCloudflare指定のものに変更する
- [ ] R2を有効にする（支払い方法の登録を求められるか確認する）
- [ ] wrangler 用のAPIトークンを発行し、ローカルに設定する

## やること（Claude Code側）

- [ ] Worker、R2バケット、D1データベースを作る
- [ ] Workerにサブドメインを割り当てる
- [ ] Turnstileのサイトキーを発行して組み込む

## 完了条件

番組用のURLでテストページが表示され、ローカルから wrangler でデプロイできる。
