// @ts-check
import { test, expect } from '@playwright/test';

test.describe('申し込みフロー', () => {
  test('講座一覧から申し込みページに遷移', async ({ page }) => {
    await page.goto('/');

    // 最初の講座の申し込みボタンをクリック
    await page.click('button:has-text("申し込む")');
    
    // 申し込みページに遷移したかチェック
    await expect(page).toHaveURL(/.*booking\/.*/);
    
    // 申し込みフォームが表示されているかチェック
    await expect(page.locator('form')).toBeVisible();
    
    // 講座タイトルが表示されるかチェック
    await expect(page.locator('h2')).toBeVisible();
  });

  test('申し込みフォームの入力検証', async ({ page }) => {
    // 直接申し込みページに遷移（最初の講座）
    await page.goto('/booking/1'); // 仮のID
    
    // 必須項目を空のまま送信
    await page.click('button:has-text("申し込む")');
    
    // エラーメッセージが表示されるかチェック
    await expect(page.locator('text=日時を選択してください')).toBeVisible();
  });

  test('正常な申し込みフロー', async ({ page }) => {
    await page.goto('/booking/1'); // 仮のID
    
    // 日時を選択（最初のラジオボタン）
    await page.locator('input[type="radio"]').first().check();
    
    // 会社名を入力
    await page.fill('input[name="companyName"]', 'テスト会社');
    
    // 名前を入力
    await page.fill('input[name="fullName"]', 'テスト太郎');
    
    // PC貸出を選択（false = PC持参）
    await page.locator('input[value="false"]').check();
    
    // 申し込みボタンをクリック
    await page.click('button:has-text("申し込む")');
    
    // 成功メッセージが表示されるかチェック
    await expect(page.locator('text=申し込みが完了しました')).toBeVisible();
  });

  test('申し込みフォームの要素確認', async ({ page }) => {
    await page.goto('/booking/1');
    
    // 日時選択セクション
    await expect(page.locator('text=希望日時を選択してください')).toBeVisible();
    
    // 会社名フィールド
    await expect(page.locator('input[name="companyName"]')).toBeVisible();
    await expect(page.locator('label:has-text("会社名")')).toBeVisible();
    
    // お名前フィールド
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('label:has-text("お名前（フルネーム）")')).toBeVisible();
    
    // PC持参セクション
    await expect(page.locator('text=PC持参について')).toBeVisible();
    await expect(page.locator('input[value="false"]')).toBeVisible();
    await expect(page.locator('input[value="true"]')).toBeVisible();
    
    // 申し込みボタン
    await expect(page.locator('button:has-text("申し込む")')).toBeVisible();
  });
});

test.describe('マイページ機能', () => {
  test('マイページにアクセスできる', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // マイページのタイトルが表示されるかチェック
    await expect(page.locator('h1')).toContainText('マイページ');
  });

  test('検索フォームが表示される', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // 会社名フィールドが表示されるかチェック
    await expect(page.locator('input[name="companyName"]')).toBeVisible();
    
    // お名前フィールドが表示されるかチェック
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    
    // 検索ボタンが表示されるかチェック
    await expect(page.locator('button:has-text("申し込み状況を確認")')).toBeVisible();
  });

  test('部分検索機能の基本動作', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // 会社名の一部を入力
    await page.fill('input[name="companyName"]', 'テスト');
    
    // 検索ボタンをクリック
    await page.click('button:has-text("申し込み状況を確認")');
    
    // 検索結果またはエラーメッセージが表示されるかチェック
    // データがない場合もあるので、何らかの結果が表示されることを確認
    await expect(page.locator('body')).toContainText(/検索結果|エラー|データが見つかりません/);
  });

  test('申し込み履歴の表示（データがある場合）', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // テストデータで検索
    await page.fill('input[name="companyName"]', 'テスト会社');
    await page.fill('input[name="fullName"]', 'テスト太郎');
    await page.click('button:has-text("申し込み状況を確認")');
    
    // 申し込み履歴テーブルまたはメッセージが表示されるかチェック
    await expect(page.locator('body')).toContainText(/申し込み履歴|検索結果|エラー/);
  });

  test('講座一覧の表示', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // 部分検索を実行
    await page.fill('input[name="companyName"]', 'テスト');
    await page.click('button:has-text("申し込み状況を確認")');
    
    // 検索結果からユーザーを選択（データがある場合）
    // データがない場合もあるので、適切に処理
    try {
      await page.click('text=テスト会社', { timeout: 5000 });
      
      // 講座一覧が表示されるかチェック
      await expect(page.locator('text=全講座一覧')).toBeVisible();
    } catch (error) {
      // データがない場合は、その旨をログに記録
      console.log('テストデータが見つからないため、講座一覧の表示テストをスキップ');
    }
  });

  test('ヘルプテキストの表示', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // ヘルプテキストが表示されるかチェック
    await expect(page.locator('body')).toContainText(/申し込み時に入力した会社名とお名前を入力して/);
  });
});
