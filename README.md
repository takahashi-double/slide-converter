# SlideAI — セットアップガイド

写真・PDFをAIが自動解析してPowerPointに変換するWebアプリです。

---

## 必要なアカウント

| サービス | 用途 | URL |
|---------|------|-----|
| Anthropic | AI画像解析 | https://console.anthropic.com |
| Stripe | 決済処理 | https://dashboard.stripe.com |
| Vercel | デプロイ | https://vercel.com |

---

## STEP 1 — Anthropic APIキーの取得

1. https://console.anthropic.com にログイン
2. 「API Keys」→「Create Key」
3. キーをコピーして保存（`sk-ant-...`）

---

## STEP 2 — Stripeのセットアップ

### 2-1. 商品・価格の作成

1. https://dashboard.stripe.com にログイン
2. 「商品カタログ」→「商品を追加」
3. 以下を設定：
   - 商品名：`SlideAI スタンダードプラン`
   - 価格：`¥980`
   - 請求期間：`月次`
4. 作成後、価格IDをコピー（`price_...`）

### 2-2. Webhookの設定（本番用）

1. 「開発者」→「Webhook」→「エンドポイントを追加」
2. エンドポイントURL：`https://your-app.vercel.app/api/stripe/webhook`
3. リッスンするイベントを選択：
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. 署名シークレットをコピー（`whsec_...`）

### 2-3. APIキーのコピー

「開発者」→「APIキー」から：
- 公開可能キー：`pk_live_...`
- シークレットキー：`sk_live_...`

---

## STEP 3 — Vercelへのデプロイ

### 3-1. GitHubにリポジトリ作成

```bash
git init
git add .
git commit -m "initial commit"
gh repo create slide-converter --public
git push origin main
```

### 3-2. Vercelにデプロイ

1. https://vercel.com → 「Add New Project」
2. GitHubのリポジトリを選択
3. Framework Preset：`Next.js`（自動検出）
4. 「Deploy」をクリック

### 3-3. 環境変数の設定

Vercelの「Settings」→「Environment Variables」に以下を追加：

| 変数名 | 値 |
|--------|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-xxxxxxx` |
| `STRIPE_SECRET_KEY` | `sk_live_xxxxxxx` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxxxxxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxxxxxx` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxxxx` |
| `STRIPE_PRICE_ID` | `price_xxxxxxx` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

追加後、「Redeploy」で再デプロイ。

---

## STEP 4 — ローカル開発（任意）

```bash
# 依存パッケージのインストール
npm install

# .env.localを作成
cp .env.example .env.local
# .env.localに各キーを記入

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### Stripeローカルテスト（Stripe CLI）

```bash
# Stripe CLIインストール（Mac）
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# Webhookをローカルに転送
stripe listen --forward-to localhost:3000/api/stripe/webhook

# テスト決済カード番号：4242 4242 4242 4242（有効期限・CVVは任意）
```

---

## ファイル構成

```
slide-converter/
├── app/
│   ├── page.tsx              # メインUI（ランディング＋変換）
│   ├── layout.tsx            # ルートレイアウト
│   ├── globals.css           # グローバルスタイル
│   ├── result/page.tsx       # Stripe決済後のリダイレクト先
│   └── api/
│       ├── convert/route.ts  # Anthropic AI変換エンドポイント
│       └── stripe/
│           ├── checkout/route.ts  # Stripeセッション作成
│           └── webhook/route.ts   # Stripeイベント処理
├── .env.example              # 環境変数テンプレート
├── vercel.json               # Vercel設定（タイムアウト60秒）
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 収益モデル

| 項目 | 内容 |
|------|------|
| 無料枠 | 初回3回（ブラウザローカル保存） |
| 有料プラン | ¥980/月・変換無制限 |
| API原価目安 | 変換1回あたり約3〜8円 |
| 損益分岐 | 月125回以上の変換で黒字（1ユーザー換算） |

---

## カスタマイズ

### 無料回数の変更
`app/page.tsx` の `FREE_LIMIT` を変更：
```typescript
const FREE_LIMIT = 3; // ← ここを変更
```

### 月額料金の変更
Stripeダッシュボードで価格を変更 → `STRIPE_PRICE_ID` を更新

### スライドスタイルの追加
`app/page.tsx` の `themes` オブジェクトに追加

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| 変換が失敗する | Anthropic APIキーが未設定 | 環境変数を確認 |
| 決済ページが開かない | Stripe Price IDが未設定 | `STRIPE_PRICE_ID`を確認 |
| Webhookが届かない | Webhook URLが間違っている | Vercelの実際のURLを設定 |
| タイムアウトエラー | ファイルが大きすぎる | 20MB以下に圧縮 |
