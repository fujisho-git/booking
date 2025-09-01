// @ts-check
import { test, expect } from '@playwright/test';

test.describe('アプリ構造確認', () => {
  test('トップページの構造確認', async ({ page }) => {
    await page.goto('/');
    
    // ページタイトルをログ出力
    const title = await page.title();
    console.log('ページタイトル:', title);
    
    // ページの内容をログ出力
    const bodyText = await page.locator('body').textContent();
    console.log('ページの内容（最初の500文字）:', bodyText?.slice(0, 500));
    
    // ヘッダーの確認
    await expect(page.locator('header')).toBeVisible();
    
    // ナビゲーションボタンの確認
    await expect(page.locator('text=講座一覧')).toBeVisible();
    await expect(page.locator('text=マイページ')).toBeVisible();
    
    // 講座カードの確認
    const courseCards = await page.locator('h2').count();
    console.log('講座カードの数:', courseCards);
    
    // 申し込みボタンの確認
    const bookingButtons = await page.locator('button:has-text("申し込む")').count();
    console.log('申し込みボタンの数:', bookingButtons);
  });

  test('マイページの構造確認', async ({ page }) => {
    await page.goto('/my-bookings');
    
    // ページの内容をログ出力
    const bodyText = await page.locator('body').textContent();
    console.log('マイページの内容（最初の500文字）:', bodyText?.slice(0, 500));
    
    // マイページのタイトル確認
    await expect(page.locator('h1')).toBeVisible();
    
    // 検索フォームの確認（実際の要素を探す）
    const formElements = await page.locator('input').count();
    console.log('入力フィールドの数:', formElements);
    
    const buttonElements = await page.locator('button').count();
    console.log('ボタンの数:', buttonElements);
    
    // 実際の入力フィールドの属性を確認
    const inputs = await page.locator('input').all();
    for (let i = 0; i < inputs.length; i++) {
      const name = await inputs[i].getAttribute('name');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const type = await inputs[i].getAttribute('type');
      console.log(`入力フィールド ${i + 1}: name="${name}", placeholder="${placeholder}", type="${type}"`);
    }
  });

  test('申し込みページの構造確認', async ({ page }) => {
    // まずトップページから申し込みページに移動
    await page.goto('/');
    
    // 最初の申し込みボタンをクリック
    await page.locator('button:has-text("申し込む")').first().click();
    
    // URLの確認
    const currentURL = page.url();
    console.log('申し込みページのURL:', currentURL);
    
    // ページの内容をログ出力
    const bodyText = await page.locator('body').textContent();
    console.log('申し込みページの内容（最初の500文字）:', bodyText?.slice(0, 500));
    
    // フォーム要素の確認
    const formElements = await page.locator('form').count();
    console.log('フォームの数:', formElements);
    
    const inputElements = await page.locator('input').count();
    console.log('入力フィールドの数:', inputElements);
    
    const radioElements = await page.locator('input[type="radio"]').count();
    console.log('ラジオボタンの数:', radioElements);
    
    // 実際の入力フィールドの属性を確認
    const inputs = await page.locator('input').all();
    for (let i = 0; i < inputs.length; i++) {
      const name = await inputs[i].getAttribute('name');
      const type = await inputs[i].getAttribute('type');
      const value = await inputs[i].getAttribute('value');
      console.log(`入力フィールド ${i + 1}: name="${name}", type="${type}", value="${value}"`);
    }
    
    // ボタンの確認
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].textContent();
      console.log(`ボタン ${i + 1}: "${buttonText}"`);
    }
  });
});
