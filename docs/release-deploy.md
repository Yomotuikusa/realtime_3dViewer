# リリース時のデプロイ手順メモ(さくらの VPS + HTTPS)

2026-09-30 作成。**まだ実施していない**。リリースの時期になったら、この手順で構築する。
アプリ側の準備(公開 origin・Secure Cookie・HSTS・Origin 検査・接続元 IP)はタスク 182 で行う。

## 構成

```
ブラウザ ──HTTPS(443)──▶ Caddy ──HTTP──▶ アプリ(127.0.0.1:3000、npm start)
          (wss も同じ)     └ Let's Encrypt の証明書を自動取得・自動更新
```

- TLS(暗号化)は Caddy が受け持つ。アプリは VPS の内側でだけ HTTP で待ち受け、外からは直接届かない
- WebSocket(`/ws`)も Caddy の `reverse_proxy` がそのまま中継する(設定の追加は不要)

## 事前に用意するもの

- **独自ドメイン**(例: `review.example.com`)。年に数百円から取得できる。
  DNS の A レコード(IPv6 を使うなら AAAA も)を VPS の IP に向ける
- さくらの VPS(Ubuntu 想定)。コントロールパネルのパケットフィルタで、22 / 80 / 443 を開ける
  - 80 は Let's Encrypt の認証と HTTP→HTTPS のリダイレクトに使う
  - 3000 は開けない

## アプリの環境変数(本番)

| 変数 | 値 | 意味 |
| --- | --- | --- |
| `NODE_ENV` | `production`(`npm start` が設定する) | 本番では `PUBLIC_ORIGIN` が必須になる |
| `PUBLIC_ORIGIN` | `https://review.example.com` | https なら Cookie に Secure が付き、HSTS を返す。API の Origin 検査にも使う |
| `TRUST_PROXY` | `1` | Caddy が付ける `X-Forwarded-For` の最後の値を接続元 IP とみなす(ログインの試行回数制限に使う) |
| `HOST` | `127.0.0.1` | 外部から 3000 番に直接つながらないようにする |
| `DATA_DIR` | `/var/lib/3dreviewer` など | SQLite とアップロードの置き場。バックアップ対象 |

## Caddyfile(例)

```
review.example.com {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

- `request_body` の上限は、アプリの `MAX_UPLOAD_BYTES`(既定 100MB)以上にしておく(Caddy の既定は無制限)
- Caddy は、信頼していないクライアントから届いた `X-Forwarded-For` をそのまま信じず、実際の接続元を付ける。
  アプリはその最後の値を使う

## 構築手順の骨子(実施時に詳細化する)

1. Node.js 24 系を入れ、リポジトリを配置して、`npm ci` と `npm run build` を行う(VPS 上では通常の手順でよい)
2. `DATA_DIR` を作り、アプリ専用ユーザーに所有させる
3. systemd のユニットで、上の環境変数を付けて `npm start` を常駐させる(`Restart=always`)
4. Caddy を公式リポジトリから入れ、Caddyfile を置いて reload する
5. `https://review.example.com` で動作を確認する
   - アカウント登録 → ログアウト → ログイン
   - 別のブラウザでのリアルタイム同期
   - Cookie に `Secure` が付いていること
6. `DATA_DIR` の定期バックアップ(SQLite は `sqlite3 app.db ".backup ..."` で一貫したコピーを取る)

## 未決事項

- ドメイン名
- バックアップの保存先と頻度
- メールによるパスワード再設定(将来。現状はリカバリーコード方式。タスク 186 の申し送りを参照)
