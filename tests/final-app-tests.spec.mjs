// @ts-check
import { test, expect } from '@playwright/test';

test.describe('最終版アプリテスト', () => {
  test('トップページの基本動作確認', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => {
        const courseCards = document.querySelectorAll('h2');
        return courseCards.length >= 3; // 3つの講座があることを確認
      },
      { timeout: 15000 }
    );
    
    // 講座タイトルが表示されることを確認
    await expect(page.locator('h2')).toContainText(['ツール研修', '生成AI研修', 'Excel研修']);
    
    // 申し込みボタンが表示されることを確認（複数あるので.first()を使用）
    await expect(page.locator('button:has-text("申し込む")').first()).toBeVisible();
    
    console.log('✅ トップページの基本動作が確認できました');
  });

  test('マイページの基本動作確認', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // マイページのタイトル確認
    await expect(page.locator('h1')).toContainText('マイページ');
    
    // 検索フィールドの確認
    await expect(page.locator('input[placeholder="会社名の一部でも検索可能"]')).toBeVisible();
    await expect(page.locator('input[placeholder="お名前の一部でも検索可能"]')).toBeVisible();
    
    // 検索ボタンの確認
    await expect(page.locator('button:has-text("申し込み状況を確認")')).toBeVisible();
    
    console.log('✅ マイページの基本動作が確認できました');
  });

  test('講座一覧から申し込みページへの遷移', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => {
        const buttons = document.querySelectorAll('button');
        for (let button of buttons) {
          if (button.textContent && button.textContent.includes('申し込む')) {
            return true;
          }
        }
        return false;
      },
      { timeout: 15000 }
    );
    
    // 最初の申し込みボタンをクリック
    await page.locator('button:has-text("申し込む")').first().click();
    
    // 申し込みページに遷移したかチェック
    await expect(page).toHaveURL(/.*booking\/.*/);
    
    // 講座タイトルが表示されるまで待機
    await page.waitForSelector('h2', { timeout: 10000 });
    
    console.log('✅ 申し込みページへの遷移が確認できました');
  });

  test('申し込みフォームの要素確認', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => {
        const buttons = document.querySelectorAll('button');
        for (let button of buttons) {
          if (button.textContent && button.textContent.includes('申し込む')) {
            return true;
          }
        }
        return false;
      },
      { timeout: 15000 }
    );
    
    // 最初の申し込みボタンをクリック
    await page.locator('button:has-text("申し込む")').first().click();
    
    // 申し込みフォームの読み込みを待機
    await page.waitForFunction(
      () => {
        const form = document.querySelector('form');
        return form && form.children.length > 0;
      },
      { timeout: 15000 }
    );
    
    // 日時選択セクションの確認
    await expect(page.locator('text=希望日時を選択してください')).toBeVisible();
    
    // 会社名フィールドの確認
    await expect(page.locator('label:has-text("会社名")')).toBeVisible();
    
    // お名前フィールドの確認
    await expect(page.locator('label:has-text("お名前")')).toBeVisible();
    
    // PC持参セクションの確認
    await expect(page.locator('text=PC持参について')).toBeVisible();
    
    // 申し込みボタンの確認
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    console.log('✅ 申し込みフォームの要素が確認できました');
  });

  test('マイページの検索機能テスト', async ({ page }) => {
    await page.goto('/my-bookings');
    
    const companyInput = page.locator('input[placeholder="会社名の一部でも検索可能"]');
    const nameInput = page.locator('input[placeholder="お名前の一部でも検索可能"]');
    
    // 入力フィールドの動作確認
    await companyInput.fill('テスト会社');
    await expect(companyInput).toHaveValue('テスト会社');
    
    await nameInput.fill('テスト太郎');
    await expect(nameInput).toHaveValue('テスト太郎');
    
    // 検索実行
    await page.click('button:has-text("申し込み状況を確認")');
    
    // 検索処理の完了を待機
    await page.waitForTimeout(2000);
    
    console.log('✅ マイページの検索機能が確認できました');
  });

  test('ナビゲーション動作確認', async ({ page }) => {
    // トップページから開始
    await page.goto('/');
    
    // マイページに移動
    await page.click('text=マイページ');
    await expect(page).toHaveURL('/my-bookings');
    
    // 講座一覧に戻る
    await page.click('text=講座一覧');
    await expect(page).toHaveURL('/');
    
    console.log('✅ ナビゲーション動作が確認できました');
  });

  test('申し込みフォームの入力フィールド確認', async ({ page }) => {
    await page.goto('/');
    
    // 講座一覧の読み込みを待機
    await page.waitForFunction(
      () => document.querySelectorAll('button').length > 2,
      { timeout: 15000 }
    );
    
    // 申し込みページに移動
    await page.locator('button:has-text("申し込む")').first().click();
    
    // フォームの読み込みを待機
    await page.waitForSelector('form', { timeout: 15000 });
    
    // ラジオボタンの存在確認
    await expect(page.locator('input[type="radio"]').first()).toBeVisible();
    
    // テキストフィールドの存在確認（type="text"のみ）
    const textInputs = page.locator('input[type="text"]');
    const textInputCount = await textInputs.count();
    expect(textInputCount).toBeGreaterThanOrEqual(2); // 会社名とお名前
    
    // PC貸出ラジオボタンの確認
    await expect(page.locator('input[value="false"]')).toBeVisible();
    await expect(page.locator('input[value="true"]')).toBeVisible();
    
    console.log('✅ 申し込みフォームの入力フィールドが確認できました');
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    // デスクトップサイズ
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // 講座一覧の読み込みを待機
    await page.waitForFunction(
      () => document.querySelectorAll('h2').length >= 3,
      { timeout: 15000 }
    );
    
    await expect(page.locator('h2').first()).toBeVisible();
    
    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // モバイルでも講座一覧が表示されることを確認
    await page.waitForFunction(
      () => document.querySelectorAll('h2').length >= 3,
      { timeout: 15000 }
    );
    
    await expect(page.locator('h2').first()).toBeVisible();
    
    console.log('✅ レスポンシブデザインが確認できました');
  });
});
