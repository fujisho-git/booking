// @ts-check
import { test, expect } from '@playwright/test';

test.describe('基本的な動作確認', () => {
  test('アプリが起動する', async ({ page }) => {
    await page.goto('/');
    
    // ページが読み込まれる
    await expect(page.locator('body')).toBeVisible();
    
    // ヘッダーが表示される（AppBarを確認）
    await expect(page.locator('header')).toBeVisible();
  });

  test('ナビゲーションが機能する', async ({ page }) => {
    await page.goto('/');
    
    // 講座一覧ボタンが表示される
    await expect(page.locator('text=講座一覧')).toBeVisible();
    
    // マイページボタンが表示される
    await expect(page.locator('text=マイページ')).toBeVisible();
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await page.goto('/');
    
    // ページタイトルをチェック
    const title = await page.title();
    console.log('実際のページタイトル:', title);
    
    // 実際のタイトルをチェック
    await expect(page).toHaveTitle(/IT研修申込み/);
  });

  test('講座一覧が表示される', async ({ page }) => {
    await page.goto('/');
    
    // 講座カードが表示されるまで待機
    await page.waitForSelector('h2', { timeout: 15000 });
    
    // 講座タイトルを取得
    const courseTitles = await page.locator('h2').allTextContents();
    console.log('実際の講座タイトル:', courseTitles);
    
    // 講座が表示されていることを確認
    expect(courseTitles.length).toBeGreaterThan(0);
    
    // 実際の講座タイトルが含まれているかチェック
    expect(courseTitles).toContain('ツール研修');
    expect(courseTitles).toContain('生成AI研修');
    expect(courseTitles).toContain('Excel研修');
  });

  test('申し込みボタンが表示される', async ({ page }) => {
    await page.goto('/');
    
    // 申し込みボタンが表示されるまで待機
    await page.waitForSelector('button:has-text("申し込む")', { timeout: 15000 });
    
    // 最初の申し込みボタンが表示されるかチェック
    await expect(page.locator('button:has-text("申し込む")').first()).toBeVisible();
    
    // 申し込みボタンの数を確認
    const buttons = await page.locator('button:has-text("申し込む")').count();
    console.log('申し込みボタンの数:', buttons);
    expect(buttons).toBeGreaterThan(0);
  });
});
