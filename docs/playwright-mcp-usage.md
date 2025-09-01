# Playwright MCP 使用ガイド

## 概要

Playwright MCPは、自然言語でブラウザ操作を指示できるツールです。CursorのAI Chatを通じて、E2Eテストの作成やブラウザ操作の自動化が可能になります。

## 設定

### MCP設定 (`.vscode/mcp.json`)
```json
{
  "servers": {
    "Playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## 使用例

### 1. 基本的なページ操作

**AI Chatでの指示例:**
```
「http://localhost:5173にアクセスして、ページタイトルが"研修スケジュール"を含んでいるかチェックして」
```

**生成されるPlaywrightコード:**
```javascript
await page.goto('http://localhost:5173');
await expect(page).toHaveTitle(/研修スケジュール/);
```

### 2. フォーム入力の自動化

**AI Chatでの指示例:**
```
「会社名フィールドに'テスト会社'、お名前フィールドに'テスト太郎'を入力して、申し込みボタンをクリックして」
```

**生成されるPlaywrightコード:**
```javascript
await page.fill('input[name="companyName"]', 'テスト会社');
await page.fill('input[name="fullName"]', 'テスト太郎');
await page.click('button:has-text("申し込む")');
```

### 3. 検索とリスト操作

**AI Chatでの指示例:**
```
「マイページに移動して、会社名フィールドに'テスト'と入力して検索実行、結果のテーブルが表示されることを確認して」
```

**生成されるPlaywrightコード:**
```javascript
await page.goto('/my-bookings');
await page.fill('input[name="companyName"]', 'テスト');
await page.click('button:has-text("申し込み状況を確認")');
await expect(page.locator('table')).toBeVisible();
```

### 4. 管理者パネルのテスト

**AI Chatでの指示例:**
```
「管理者ページにアクセスして、ログインフォームが表示されているか確認、統計情報タブをクリックして申し込み数が表示されているかチェックして」
```

## テスト実行方法

### コマンドライン
```bash
# 全てのテストを実行
npm run test

# UIモードでテストを実行
npm run test:ui

# ヘッドレスモードで実行
npm run test:headed

# デバッグモードで実行
npm run test:debug

# レポートを表示
npm run test:report
```

### CI/CD
GitHub Actionsで自動実行される設定済み:
- PRやpushで自動実行
- テスト結果をアーティファクトとして保存
- 失敗時はスクリーンショット・動画を記録

## Playwright MCPの利点

### 1. 自然言語でのテスト作成
- 「ボタンをクリックして」→ `page.click()`
- 「フォームに入力して」→ `page.fill()`
- 「表示されているか確認して」→ `expect().toBeVisible()`

### 2. 複雑なシナリオの簡素化
```
「新規ユーザーとして講座申し込みの完全なフローをテストして:
1. トップページから講座選択
2. 申し込みフォーム入力
3. 送信完了確認
4. マイページで申し込み確認」
```

### 3. エラー処理とデバッグ
```
「申し込みフォームで必須項目を空のまま送信して、適切なエラーメッセージが表示されるかテストして」
```

## ベストプラクティス

### 1. 段階的なテスト構築
- 小さな操作から始める
- 複雑なフローは分割して指示

### 2. 要素の特定方法
- テキスト: `'button:has-text("申し込む")'`
- CSS: `'input[name="companyName"]'`
- データ属性: `'[data-testid="submit-button"]'`

### 3. 待機とタイミング
- ページ遷移: `await page.waitForURL()`
- 要素表示: `await page.waitForSelector()`
- API応答: `await page.waitForResponse()`

## トラブルシューティング

### よくある問題

1. **要素が見つからない**
   - セレクタの確認
   - 要素の読み込み待機

2. **タイミングの問題**
   - 適切な待機処理の追加
   - `await page.waitFor*()`の使用

3. **テスト環境の違い**
   - 開発サーバーの起動確認
   - ベースURLの設定確認

### デバッグ方法
```bash
# ヘッドレスモードで実行して動作確認
npm run test:headed

# デバッグモードで1ステップずつ実行
npm run test:debug
```

## まとめ

Playwright MCPにより、E2Eテストの作成が劇的に簡単になりました。自然言語での指示により、複雑なブラウザ操作も直感的に表現でき、テスト品質の向上と開発効率の改善が実現します。
