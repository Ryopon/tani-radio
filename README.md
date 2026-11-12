# 谷ラジオ

毎朝配信する、約10分のインタラクティブなラジオ番組です。人間のryoponと、しゃべらないうさぎのmuiがお届けします。

- 番組サイト: https://tani-radio.gohanokawari.com （準備中）
- コンセプト: [CONCEPT.md](CONCEPT.md)
- 残タスク: [tasks/](tasks/README.md)

番組の内容はAIが自動生成します。

## 開発

Node.js が必要です。

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` は、仮の素材と音声でサンプル回を `public/_sample/` に生成してから開発サーバーを起動します。設計は [docs/engine-design.md](docs/engine-design.md) にあります。

## ライセンス

| 対象 | ライセンス |
|---|---|
| ソースコードとドキュメント | [MIT](LICENSE) |
| ryoponとmuiのキャラクター素材・名前、番組名とロゴ | [権利を留保](assets/characters/LICENSE.md)。再利用はできません |

BGM、効果音、生成済みの各回はこのリポジトリに含まれません。
