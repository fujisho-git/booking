// @ts-check
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // 実際のページタイトルをチェック
  await expect(page).toHaveTitle(/IT研修申込み/);
});

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');

  // 実際の講座タイトルが表示されているかチェック
  await page.waitForSelector('h2', { timeout: 15000 });
  await expect(page.locator('h2')).toContainText(['ツール研修', '生成AI研修', 'Excel研修']);
});

test('navigation to my bookings page', async ({ page }) => {
  await page.goto('/');

  // マイページリンクをクリック
  await page.click('text=マイページ');
  
  // URLが変更されたかチェック
  await expect(page).toHaveURL(/.*my-bookings/);
  
  // マイページのタイトルが表示されているかチェック
  await expect(page.locator('h1')).toContainText('マイページ');
});

test('navigation to course list', async ({ page }) => {
  await page.goto('/my-bookings');

  // 講座一覧リンクをクリック
  await page.click('text=講座一覧');
  
  // トップページに戻ったかチェック
  await expect(page).toHaveURL('/');
  
  // 講座一覧が表示されているかチェック
  await expect(page.locator('h2')).toBeVisible();
});
