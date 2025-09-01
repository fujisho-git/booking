// @ts-check
import { test, expect } from '@playwright/test';

test.describe('管理者パネル', () => {
  test('ログインページの表示', async ({ page }) => {
    await page.goto('/admin');
    
    // ログインフォームが表示されるかチェック
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("ログイン")')).toBeVisible();
  });

  test('無効な認証情報でのログイン試行', async ({ page }) => {
    await page.goto('/admin');
    
    // 無効な認証情報を入力
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("ログイン")');
    
    // エラーメッセージが表示されるかチェック（実際のエラーメッセージに合わせて調整）
    await expect(page.locator('text=ログインに失敗しました')).toBeVisible();
  });

  // Note: 実際の認証情報を使ったテストは環境変数から取得するか、
  // テスト用のモックを使用することを推奨
  test('ダッシュボードのナビゲーション', async ({ page }) => {
    // テスト用の認証情報でログイン（実装時に調整）
    await page.goto('/admin');
    
    // 管理者認証が成功した場合のテスト
    // await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL);
    // await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD);
    // await page.click('button:has-text("ログイン")');
    
    // ダッシュボードタブの存在確認
    // await expect(page.locator('text=統計情報')).toBeVisible();
    // await expect(page.locator('text=申込者一覧')).toBeVisible();
    // await expect(page.locator('text=研修日時別詳細')).toBeVisible();
  });

  test('申込者一覧の表示とフィルター機能', async ({ page }) => {
    // 管理者としてログイン済みの前提
    await page.goto('/admin');
    
    // 申込者一覧タブをクリック
    await page.click('text=申込者一覧');
    
    // フィルター機能をテスト
    await page.selectOption('select[label="講座"]', { index: 1 });
    
    // フィルター適用後のテーブル表示確認
    await expect(page.locator('table')).toBeVisible();
  });

  test('CSV出力機能', async ({ page }) => {
    // 管理者としてログイン済みの前提
    await page.goto('/admin');
    
    // CSV出力ボタンをクリック
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("CSV出力")');
    const download = await downloadPromise;
    
    // ダウンロードファイル名の確認
    expect(download.suggestedFilename()).toMatch(/申し込み一覧_\d{8}_\d{4}\.csv/);
  });

  test('講座管理機能', async ({ page }) => {
    await page.goto('/admin');
    
    // 講座管理タブをクリック
    await page.click('text=講座管理');
    
    // 新規講座追加ボタンが表示されるかチェック
    await expect(page.locator('button:has-text("新規講座追加")')).toBeVisible();
  });

  test('キャンセルログの表示', async ({ page }) => {
    await page.goto('/admin');
    
    // キャンセルログタブをクリック
    await page.click('text=キャンセルログ');
    
    // キャンセルログテーブルが表示されるかチェック
    await expect(page.locator('table')).toBeVisible();
  });
});
