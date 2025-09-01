// @ts-check
import { test, expect } from '@playwright/test';

test.describe('申し込みフロー（実際のアプリ対応）', () => {
  test('講座一覧の表示確認', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機（最大15秒）
    await page.waitForFunction(
      () => {
        const courseCards = document.querySelectorAll('h2');
        return courseCards.length > 0;
      },
      { timeout: 15000 }
    );
    
    // 講座タイトルが表示されることを確認
    await expect(page.locator('h2')).toContainText(['ツール研修', '生成AI研修', 'Excel研修']);
    
    // 申し込みボタンが表示されることを確認
    await expect(page.locator('button:has-text("申し込む")')).toBeVisible();
    
    console.log('講座一覧の表示が確認できました');
  });

  test('講座一覧から申し込みページに遷移', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => {
        const buttons = document.querySelectorAll('button');
        for (let button of buttons) {
          if (button.textContent?.includes('申し込む')) {
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
    
    console.log('申し込みページへの遷移が確認できました');
  });

  test('申し込みフォームの要素確認', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => document.querySelectorAll('button:has-text("申し込む")').length > 0,
      { timeout: 15000 }
    );
    
    // 最初の申し込みボタンをクリック
    await page.locator('button:has-text("申し込む")').first().click();
    
    // 申し込みフォームの読み込みを待機
    await page.waitForFunction(
      () => {
        const inputs = document.querySelectorAll('input');
        return inputs.length > 0;
      },
      { timeout: 15000 }
    );
    
    // React Hook Formでname属性が動的に設定されるため、より柔軟な検索を使用
    
    // 会社名フィールドの確認
    await expect(page.locator('label:has-text("会社名")')).toBeVisible();
    
    // お名前フィールドの確認
    await expect(page.locator('label:has-text("お名前")')).toBeVisible();
    
    // PC持参セクションの確認
    await expect(page.locator('text=PC持参について')).toBeVisible();
    
    // 申し込みボタンの確認
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    console.log('申し込みフォームの要素が確認できました');
  });

  test('正常な申し込みフロー', async ({ page }) => {
    await page.goto('/');
    
    // 講座データの読み込みを待機
    await page.waitForFunction(
      () => document.querySelectorAll('button').length > 2,
      { timeout: 15000 }
    );
    
    // 最初の申し込みボタンをクリック
    await page.locator('button:has-text("申し込む")').first().click();
    
    // フォームの読み込みを待機
    await page.waitForSelector('form', { timeout: 15000 });
    
    // 日時を選択（最初のラジオボタン）
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.locator('input[type="radio"]').first().check();
    
    // 会社名を入力（labelのfor属性でinputを特定）
    const companyNameInput = page.locator('input').filter({ hasText: '' }).first();
    await companyNameInput.fill('テスト会社');
    
    // 名前を入力
    const fullNameInput = page.locator('input').filter({ hasText: '' }).nth(1);
    await fullNameInput.fill('テスト太郎');
    
    // PC持参を選択
    await page.locator('input[value="false"]').check();
    
    // 申し込みボタンをクリック
    await page.locator('button[type="submit"]').click();
    
    // 成功メッセージまたはリダイレクトを待機
    try {
      await expect(page.locator('text=申し込みが完了しました')).toBeVisible({ timeout: 10000 });
      console.log('申し込み成功メッセージが表示されました');
    } catch (error) {
      // リダイレクトの場合
      await page.waitForURL(/.*my-bookings.*/, { timeout: 10000 });
      console.log('マイページにリダイレクトされました');
    }
  });
});
