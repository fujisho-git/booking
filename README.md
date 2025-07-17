# 研修スケジュール管理システム

ReactとFirebaseを使用した講座申し込み管理システムです。

## 機能

### 一般ユーザー向け機能
- 📚 **講座一覧表示**: カテゴリ別の講座一覧を確認
- 🗓️ **複数日時選択**: 講座ごとに複数の開催日時から選択可能
- 👥 **定員管理**: リアルタイムの空き状況表示
- 💻 **PC貸出管理**: PC持参・貸出選択機能
- 📝 **申し込みフォーム**: 会社名・名前入力（ログイン不要）
- ✅ **申し込み完了通知**: 申し込み後の確認画面

### 管理者向け機能
- 🛠️ **講座管理**: 講座の作成・編集・削除
- 📊 **申し込み状況確認**: リアルタイムの申し込み数とPC貸出状況の確認
- 🎯 **定員設定**: 講座ごとの定員とPC貸出枠の設定
- 📅 **スケジュール管理**: 複数の開催日時設定

## 技術スタック

- **フロントエンド**: React 19, Material-UI, React Router, React Hook Form
- **バックエンド**: Firebase Firestore
- **日付処理**: Day.js
- **ビルドツール**: Vite

## データ構造

### 講座 (courses)
```javascript
{
  id: string,
  title: string,           // 講座名
  description: string,     // 講座説明
  category: string,        // カテゴリ
  schedules: [
    {
      id: string,
      dateTime: Timestamp,   // 開催日時
      capacity: number,      // 定員
      pcRentalSlots: number  // PC貸出枠
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 申し込み (bookings)
```javascript
{
  id: string,
  courseId: string,        // 講座ID
  scheduleId: string,      // スケジュールID
  companyName: string,     // 会社名
  fullName: string,        // 氏名
  needsPcRental: boolean,  // PC貸出希望
  courseTitle: string,     // 講座名（参照用）
  scheduleDateTime: Timestamp, // 開催日時（参照用）
  createdAt: Timestamp
}
```

## セットアップ手順

### 1. 環境設定

```bash
# プロジェクトのクローン
git clone <repository-url>
cd training-schedule-app

# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp env.example .env
```

### 2. Firebase設定

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成
2. Firestoreデータベースを有効化
3. プロジェクト設定からFirebase SDKの設定情報を取得
4. `.env`ファイルに設定情報を記載:

```env
VITE_apiKey=your_firebase_api_key
VITE_authDomain=your_project_id.firebaseapp.com
VITE_projectId=your_project_id
VITE_storageBucket=your_project_id.appspot.com
VITE_messagingSenderId=your_messaging_sender_id
VITE_appId=your_app_id
```

### 3. 開発サーバー起動

```bash
npm run dev
```

アプリケーションは `http://localhost:5173` で起動します。

## 使用方法

### 講座申し込み（一般ユーザー）

1. トップページで講座一覧を確認
2. カテゴリでの絞り込み可能
3. 「申し込む」ボタンをクリック
4. 希望日時を選択
5. 会社名・氏名を入力
6. PC持参/貸出希望を選択
7. 申し込み完了

### 講座管理（管理者）

1. `/admin` ページにアクセス
2. 「新規講座作成」ボタンをクリック
3. 講座情報を入力:
   - 講座名
   - 説明
   - カテゴリ
   - 複数の開催スケジュール（日時、定員、PC貸出枠）
4. 保存して講座を公開
5. 申し込み状況をリアルタイムで確認

## 特徴

- **レスポンシブデザイン**: PC・タブレット・スマートフォンに対応
- **リアルタイム更新**: Firestoreによる即座のデータ同期
- **バリデーション**: フォーム入力の詳細なエラーチェック
- **ユーザビリティ**: 直感的な操作インターフェース
- **ログイン不要**: 一般ユーザーは登録なしで申し込み可能

## ライセンス

MIT License
