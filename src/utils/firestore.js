import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import dayjs from 'dayjs';

// Firestore接続テスト関数
export const testFirestoreConnection = async () => {
  try {
    // テスト用のシンプルなクエリを実行
    const testQuery = query(coursesCollection);
    await getDocs(testQuery);
    return { success: true, message: 'Firestore接続成功' };
  } catch (error) {
    console.error('Firestore接続テストエラー:', error);
    return {
      success: false,
      message: `Firestore接続エラー: ${error.message}`,
      code: error.code,
    };
  }
};

// 講座関連の操作
export const coursesCollection = collection(db, 'courses');
export const bookingsCollection = collection(db, 'bookings');
export const cancelLogsCollection = collection(db, 'cancelLogs');
export const categoriesCollection = collection(db, 'categories');

// 講座の取得
export const getCourses = async () => {
  try {
    const querySnapshot = await getDocs(
      query(coursesCollection, orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('講座の取得エラー:', error);
    throw error;
  }
};

// 申込者向け講座の取得（アクティブな講座のみ）
export const getActiveCourses = async () => {
  try {
    // 複合インデックスの問題を回避するため、全講座を取得してフィルタリング
    const querySnapshot = await getDocs(
      query(coursesCollection, orderBy('createdAt', 'desc'))
    );

    const allCourses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // isActiveがtrueの講座のみを返す（未設定の場合はtrueとして扱う）
    return allCourses.filter(course => course.isActive !== false);
  } catch (error) {
    console.error('アクティブ講座の取得エラー:', error);
    throw error;
  }
};

// カテゴリ別講座の取得（管理画面用）
export const getCoursesByCategory = async (category = null) => {
  try {
    // 全ての講座を取得してクライアント側でフィルタリング
    const querySnapshot = await getDocs(
      query(coursesCollection, orderBy('createdAt', 'desc'))
    );

    const allCourses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // カテゴリが指定されている場合はフィルタリング
    if (category) {
      return allCourses.filter(course => course.category === category);
    }

    return allCourses;
  } catch (error) {
    console.error('カテゴリ別講座の取得エラー:', error);
    throw error;
  }
};

// 特定の講座の取得
export const getCourse = async courseId => {
  try {
    const docRef = doc(db, 'courses', courseId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error('講座が見つかりません');
    }
  } catch (error) {
    console.error('講座取得エラー:', error);
    throw error;
  }
};

// 講座の作成
export const createCourse = async courseData => {
  try {
    const docRef = await addDoc(coursesCollection, {
      ...courseData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('講座作成エラー:', error);
    throw error;
  }
};

// 申し込みの作成（定員制御付き）
export const createBooking = async bookingData => {
  try {
    const result = await runTransaction(db, async transaction => {
      // 1. 現在の申し込み状況をチェック
      const bookingsQuery = query(
        bookingsCollection,
        where('courseId', '==', bookingData.courseId),
        where('scheduleId', '==', bookingData.scheduleId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const currentBookings = bookingsSnapshot.docs.map(doc => doc.data());

      // 2. 重複申し込みチェック
      const duplicateBooking = currentBookings.find(
        booking =>
          booking.companyName === bookingData.companyName &&
          booking.fullName === bookingData.fullName
      );

      if (duplicateBooking) {
        throw new Error('DUPLICATE_BOOKING');
      }

      // 3. 講座情報を取得
      const courseRef = doc(db, 'courses', bookingData.courseId);
      const courseDoc = await transaction.get(courseRef);

      if (!courseDoc.exists()) {
        throw new Error('COURSE_NOT_FOUND');
      }

      const courseData = courseDoc.data();
      const schedule = courseData.schedules?.find(
        s => s.id === bookingData.scheduleId
      );

      if (!schedule) {
        throw new Error('SCHEDULE_NOT_FOUND');
      }

      // 4. 定員チェック
      const totalBookings = currentBookings.length;
      if (totalBookings >= schedule.capacity) {
        throw new Error('CAPACITY_EXCEEDED');
      }

      // 5. PC貸出枠チェック
      if (bookingData.needsPcRental) {
        const pcRentals = currentBookings.filter(
          booking => booking.needsPcRental
        ).length;
        if (pcRentals >= schedule.pcRentalSlots) {
          throw new Error('PC_RENTAL_FULL');
        }
      }

      // 6. 申し込みデータを作成
      const newBookingRef = doc(bookingsCollection);
      transaction.set(newBookingRef, {
        ...bookingData,
        createdAt: serverTimestamp(),
      });

      return newBookingRef.id;
    });

    return result;
  } catch (error) {
    console.error('申し込み作成エラー:', error);

    // カスタムエラーメッセージを設定
    if (error.message === 'DUPLICATE_BOOKING') {
      throw new Error(
        'この日時には既に申し込み済みです。同じ日時への重複申し込みはできません。'
      );
    } else if (error.message === 'CAPACITY_EXCEEDED') {
      throw new Error(
        '申し訳ございませんが、選択された日時は定員に達しています。他の日時をお選びください。'
      );
    } else if (error.message === 'PC_RENTAL_FULL') {
      throw new Error(
        '申し訳ございませんが、PC貸出枠が満席です。PC持参でお申し込みください。'
      );
    } else if (error.message === 'COURSE_NOT_FOUND') {
      throw new Error('講座が見つかりません。');
    } else if (error.message === 'SCHEDULE_NOT_FOUND') {
      throw new Error('指定された日時が見つかりません。');
    }

    throw error;
  }
};

// 特定のユーザーが特定の講座に申し込み済みかチェック（講座IDベース）
export const checkUserBookingExists = async (
  courseId,
  companyName,
  fullName
) => {
  try {
    if (!companyName || !fullName) {
      return false;
    }

    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      where('companyName', '==', companyName.trim()),
      where('fullName', '==', fullName.trim())
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('申し込み確認エラー:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      courseId,
      companyName: companyName?.trim(),
      fullName: fullName?.trim(),
    });

    // エラーが発生した場合は安全側に倒して false を返す
    // （重複申し込みチェックが失敗した場合、申し込み自体は通すが後でバリデーションされる）
    return false;
  }
};

// 特定のユーザーが特定のスケジュールに申し込み済みかチェック（スケジュールベース）
export const checkUserBookingExistsBySchedule = async (
  courseId,
  scheduleId,
  companyName,
  fullName
) => {
  try {
    if (!companyName || !fullName || !courseId || !scheduleId) {
      return false;
    }

    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      where('scheduleId', '==', scheduleId),
      where('companyName', '==', companyName.trim()),
      where('fullName', '==', fullName.trim())
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('スケジュールベース申し込み確認エラー:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      courseId,
      scheduleId,
      companyName: companyName?.trim(),
      fullName: fullName?.trim(),
    });

    // エラーが発生した場合は安全側に倒して false を返す
    return false;
  }
};

// 特定の講座の申し込み数を取得
export const getBookingsCount = async (courseId, scheduleId) => {
  try {
    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      where('scheduleId', '==', scheduleId)
    );
    const querySnapshot = await getDocs(q);

    const bookings = querySnapshot.docs.map(doc => doc.data());
    const totalBookings = bookings.length;
    const pcRentals = bookings.filter(booking => booking.needsPcRental).length;

    return { totalBookings, pcRentals };
  } catch (error) {
    console.error('申し込み数取得エラー:', error);
    throw error;
  }
};

// 講座の更新
export const updateCourse = async (courseId, updateData) => {
  try {
    const docRef = doc(db, 'courses', courseId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('講座更新エラー:', error);
    throw error;
  }
};

// 既存講座にカテゴリを一括設定
export const updateCoursesWithCategory = async () => {
  try {
    const coursesSnapshot = await getDocs(coursesCollection);
    const updatePromises = [];

    coursesSnapshot.forEach(courseDoc => {
      const courseData = courseDoc.data();
      // カテゴリが設定されていない講座を「第一弾」に設定
      if (!courseData.category) {
        const docRef = doc(db, 'courses', courseDoc.id);
        updatePromises.push(
          updateDoc(docRef, {
            category: '第一弾',
            isActive: false, // 第一弾は非表示に設定
            updatedAt: serverTimestamp(),
          })
        );
      }
    });

    await Promise.all(updatePromises);
    console.log(`${updatePromises.length}件の講座にカテゴリを設定しました`);
    return updatePromises.length;
  } catch (error) {
    console.error('講座カテゴリ一括更新エラー:', error);
    throw error;
  }
};

// すべての申し込みデータを取得
export const getAllBookings = async () => {
  try {
    const q = query(bookingsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('申し込み一覧取得エラー:', error);
    throw error;
  }
};

// 特定の講座の申し込み一覧を取得
export const getBookingsByCourse = async courseId => {
  try {
    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('講座別申し込み取得エラー:', error);
    throw error;
  }
};

// 特定のスケジュールの申し込み一覧を取得
export const getBookingsBySchedule = async (courseId, scheduleId) => {
  try {
    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      where('scheduleId', '==', scheduleId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('スケジュール別申し込み取得エラー:', error);
    throw error;
  }
};

// キャンセルログを記録する関数
export const createCancelLog = async (
  bookingData,
  cancelReason = '利用者によるキャンセル'
) => {
  try {
    const cancelLogData = {
      // 元の申し込み情報
      originalBookingId: bookingData.id,
      courseId: bookingData.courseId,
      courseTitle: bookingData.courseTitle,
      scheduleId: bookingData.scheduleId,
      scheduleDateTime: bookingData.scheduleDateTime,
      companyName: bookingData.companyName,
      fullName: bookingData.fullName,
      needsPcRental: bookingData.needsPcRental,
      originalCreatedAt: bookingData.createdAt,

      // キャンセル情報
      cancelReason,
      canceledAt: serverTimestamp(),
      cancelMethod: bookingData.cancelMethod || 'user_interface', // bookingDataから取得、デフォルトは'user_interface'

      // システム情報
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      ipAddress: 'N/A', // フロントエンドでは取得困難
      sessionInfo: {
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    const docRef = await addDoc(cancelLogsCollection, cancelLogData);

    // 詳細なコンソールログ
    console.log('=== 申し込みキャンセルログ ===');
    console.log('ログID:', docRef.id);
    console.log('申し込みID:', bookingData.id);
    console.log('講座:', bookingData.courseTitle);
    console.log(
      '開催日時:',
      dayjs(bookingData.scheduleDateTime.toDate()).format('YYYY/MM/DD HH:mm')
    );
    console.log(
      'キャンセル者:',
      `${bookingData.companyName} ${bookingData.fullName}`
    );
    console.log(
      'PC貸出:',
      bookingData.needsPcRental ? '希望していた' : '持参予定だった'
    );
    console.log('キャンセル理由:', cancelReason);
    console.log('キャンセル方法:', cancelLogData.cancelMethod);
    console.log('保存されたデータ:', cancelLogData);
    console.log('キャンセル日時:', new Date().toLocaleString('ja-JP'));
    console.log('==========================');

    return docRef.id;
  } catch (error) {
    console.error('キャンセルログ記録エラー:', error);
    // ログ記録に失敗してもキャンセル処理は続行
    return null;
  }
};

// 申し込み者ごとの参加研修情報を取得（メール送信用）
export const getUserBookingsForEmail = async () => {
  try {
    const [bookings, courses] = await Promise.all([
      getAllBookings(),
      getCourses(),
    ]);

    // 講座情報をマップ化（高速検索用）
    const coursesMap = {};
    courses.forEach(course => {
      coursesMap[course.id] = course;
    });

    // ユーザーごとにグループ化
    const userBookingsMap = {};

    bookings.forEach(booking => {
      const userKey = `${booking.companyName}|${booking.fullName}|${booking.email}`;

      if (!userBookingsMap[userKey]) {
        userBookingsMap[userKey] = {
          companyName: booking.companyName,
          fullName: booking.fullName,
          email: booking.email,
          bookings: [],
        };
      }

      // 講座情報から終了時間を取得
      const course = coursesMap[booking.courseId];
      const schedule = course?.schedules?.find(
        s => s.id === booking.scheduleId
      );

      userBookingsMap[userKey].bookings.push({
        courseId: booking.courseId,
        courseTitle: booking.courseTitle,
        courseCategory: course?.category, // カテゴリ情報を追加
        scheduleDateTime: booking.scheduleDateTime,
        scheduleEndTime: booking.scheduleEndTime || schedule?.endTime,
        createdAt: booking.createdAt,
      });
    });

    // 配列に変換して会社名・氏名でソート
    const userBookingsList = Object.values(userBookingsMap);
    userBookingsList.sort((a, b) => {
      const companyCompare = a.companyName.localeCompare(b.companyName, 'ja');
      if (companyCompare !== 0) return companyCompare;
      return a.fullName.localeCompare(b.fullName, 'ja');
    });

    // 各ユーザーの申し込みを日時順でソート
    userBookingsList.forEach(user => {
      user.bookings.sort(
        (a, b) => a.scheduleDateTime.toDate() - b.scheduleDateTime.toDate()
      );
    });

    return userBookingsList;
  } catch (error) {
    console.error('申し込み者情報取得エラー:', error);
    throw error;
  }
};

// 管理者による申し込みキャンセル
export const adminCancelBooking = async (
  bookingId,
  adminReason = '管理者によるキャンセル'
) => {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);

    // 申し込みが存在するかチェック
    const bookingDoc = await getDoc(bookingRef);
    if (!bookingDoc.exists()) {
      throw new Error('申し込みが見つかりません');
    }

    const bookingData = { id: bookingDoc.id, ...bookingDoc.data() };

    // キャンセルログを記録（管理者操作として記録）
    try {
      await createCancelLog(
        {
          ...bookingData,
          cancelMethod: 'admin_panel',
        },
        adminReason
      );
    } catch (logError) {
      console.error(
        'ログ記録は失敗しましたが、キャンセル処理を続行します:',
        logError
      );
    }

    // 申し込みを削除
    await deleteDoc(bookingRef);

    console.log('=== 管理者によるキャンセル完了 ===');
    console.log('キャンセルされた申し込みID:', bookingId);
    console.log('管理者理由:', adminReason);
    console.log('実行時刻:', new Date().toISOString());
    console.log('==================================');

    return true;
  } catch (error) {
    console.error('管理者キャンセルエラー:', error);
    throw error;
  }
};

// 管理者による申し込み追加
export const adminCreateBooking = async bookingData => {
  try {
    // 管理者による追加であることをマーク
    const adminBookingData = {
      ...bookingData,
      createdBy: 'admin',
      createdAt: serverTimestamp(),
    };

    const result = await createBooking(adminBookingData);

    console.log('=== 管理者による申し込み追加完了 ===');
    console.log('追加された申し込みID:', result);
    console.log(
      '申し込み者:',
      `${bookingData.companyName} ${bookingData.fullName}`
    );
    console.log('講座:', bookingData.courseTitle);
    console.log('実行時刻:', new Date().toISOString());
    console.log('=====================================');

    return result;
  } catch (error) {
    console.error('管理者申し込み追加エラー:', error);
    throw error;
  }
};

// キャンセルログ一覧を取得
export const getCancelLogs = async () => {
  try {
    const q = query(cancelLogsCollection, orderBy('canceledAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('キャンセルログ取得エラー:', error);
    throw error;
  }
};

// 特定期間のキャンセルログを取得
export const getCancelLogsByDateRange = async (startDate, endDate) => {
  try {
    const q = query(
      cancelLogsCollection,
      where('canceledAt', '>=', startDate),
      where('canceledAt', '<=', endDate),
      orderBy('canceledAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('期間指定キャンセルログ取得エラー:', error);
    throw error;
  }
};

// カテゴリー管理機能
// すべてのカテゴリーを取得
export const getCategories = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('getCategories: Firestore クエリ開始');
    }

    // 複合インデックスの問題を回避するため、単一のorderByを使用してクライアント側でソート
    const q = query(categoriesCollection, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    const categories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // クライアント側で名前順にもソート
    categories.sort((a, b) => {
      if (a.order !== b.order) {
        return (a.order || 999) - (b.order || 999);
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(
        'getCategories: Firestoreから取得したカテゴリー数:',
        categories.length
      );
      console.log('getCategories: 取得したカテゴリー:', categories);
    }

    // データベースにカテゴリーが存在しない場合はデフォルトカテゴリーを返す
    if (categories.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'getCategories: カテゴリーが0件のためデフォルトカテゴリーを返します'
        );
      }
      return [
        { id: 'default-1', name: '第一弾', isActive: false, order: 1 },
        { id: 'default-2', name: '第二弾', isActive: true, order: 2 },
      ];
    }

    return categories;
  } catch (error) {
    console.error('カテゴリー取得エラー:', error);
    // エラー時はデフォルトカテゴリーを返す
    return [
      { id: 'default-1', name: '第一弾', isActive: false, order: 1 },
      { id: 'default-2', name: '第二弾', isActive: true, order: 2 },
    ];
  }
};

// アクティブなカテゴリーのみ取得
export const getActiveCategories = async () => {
  try {
    const allCategories = await getCategories();
    return allCategories.filter(category => category.isActive !== false);
  } catch (error) {
    console.error('アクティブカテゴリー取得エラー:', error);
    return [];
  }
};

// カテゴリーを作成
export const createCategory = async categoryData => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('createCategory 受信データ:', categoryData);
    }

    const newCategory = {
      name: categoryData.name,
      description: categoryData.description || '',
      isActive:
        categoryData.isActive !== undefined ? categoryData.isActive : true,
      order: categoryData.order || 999,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Firestoreに保存するデータ:', newCategory);
    }

    const docRef = await addDoc(categoriesCollection, newCategory);

    if (process.env.NODE_ENV === 'development') {
      console.log('カテゴリーが作成されました:', docRef.id);
    }

    return docRef.id;
  } catch (error) {
    console.error('カテゴリー作成エラー:', error);
    throw error;
  }
};

// カテゴリーを更新
export const updateCategory = async (categoryId, updates) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('updateCategory 受信データ:', { categoryId, updates });
    }

    const categoryRef = doc(db, 'categories', categoryId);
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Firestoreに更新するデータ:', updateData);
    }

    await updateDoc(categoryRef, updateData);

    if (process.env.NODE_ENV === 'development') {
      console.log('カテゴリーが更新されました:', categoryId);
    }
  } catch (error) {
    console.error('カテゴリー更新エラー:', error);
    throw error;
  }
};

// カテゴリーを削除
export const deleteCategory = async categoryId => {
  try {
    // まず、このカテゴリーを使用している講座があるかチェック
    const coursesWithCategory = await getCoursesByCategory(categoryId);
    if (coursesWithCategory.length > 0) {
      throw new Error(
        'このカテゴリーを使用している講座があるため削除できません'
      );
    }

    const categoryRef = doc(db, 'categories', categoryId);
    await deleteDoc(categoryRef);
    console.log('カテゴリーが削除されました:', categoryId);
  } catch (error) {
    console.error('カテゴリー削除エラー:', error);
    throw error;
  }
};

// 初期カテゴリーデータを作成（初回セットアップ用）
export const initializeDefaultCategories = async (force = false) => {
  try {
    console.log('initializeDefaultCategories: 開始');

    const existingCategories = await getDocs(categoriesCollection);
    console.log(
      'initializeDefaultCategories: 既存カテゴリー数:',
      existingCategories.size
    );

    if (!existingCategories.empty && !force) {
      const existingNames = [];
      existingCategories.forEach(doc => {
        existingNames.push(doc.data().name);
      });
      console.log(
        'initializeDefaultCategories: 既存カテゴリー名:',
        existingNames
      );
      console.log('カテゴリーは既に存在します');
      return;
    }

    console.log('initializeDefaultCategories: 新規カテゴリーを作成します');

    const defaultCategories = [
      {
        name: '第一弾',
        description: '第一弾の研修講座',
        isActive: false,
        order: 1,
      },
      {
        name: '第二弾',
        description: '第二弾の研修講座',
        isActive: true,
        order: 2,
      },
    ];

    const promises = defaultCategories.map(category =>
      createCategory(category)
    );
    await Promise.all(promises);
    console.log('デフォルトカテゴリーが作成されました');
  } catch (error) {
    console.error('デフォルトカテゴリー作成エラー:', error);
    throw error;
  }
};

// キャンセル統計情報を取得
export const getCancelStatistics = async () => {
  try {
    const cancelLogs = await getCancelLogs();

    // 今日のキャンセル数
    const today = dayjs().startOf('day');
    const todayCancels = cancelLogs.filter(log =>
      dayjs(log.canceledAt.toDate()).isSame(today, 'day')
    );

    // 今週のキャンセル数
    const thisWeek = dayjs().startOf('week');
    const weekCancels = cancelLogs.filter(log =>
      dayjs(log.canceledAt.toDate()).isAfter(thisWeek)
    );

    // 今月のキャンセル数
    const thisMonth = dayjs().startOf('month');
    const monthCancels = cancelLogs.filter(log =>
      dayjs(log.canceledAt.toDate()).isAfter(thisMonth)
    );

    return {
      totalCancels: cancelLogs.length,
      todayCancels: todayCancels.length,
      weekCancels: weekCancels.length,
      monthCancels: monthCancels.length,
      recentCancels: cancelLogs.slice(0, 10), // 最新10件
    };
  } catch (error) {
    console.error('キャンセル統計取得エラー:', error);
    throw error;
  }
};

// 申し込み統計情報を取得
export const getBookingStatistics = async () => {
  try {
    const bookings = await getAllBookings();
    const courses = await getCourses();

    // ユニークな申込者数を計算（会社名+氏名の組み合わせ）
    const uniqueApplicants = new Set();
    bookings.forEach(booking => {
      const applicantKey = `${booking.companyName}|${booking.fullName}`;
      uniqueApplicants.add(applicantKey);
    });

    // 講座別統計
    const courseStats = courses.map(course => {
      const courseBookings = bookings.filter(
        booking => booking.courseId === course.id
      );
      const totalBookings = courseBookings.length;
      const pcRentals = courseBookings.filter(
        booking => booking.needsPcRental
      ).length;

      // 講座別のユニークな申込者数
      const courseApplicants = new Set();
      courseBookings.forEach(booking => {
        const applicantKey = `${booking.companyName}|${booking.fullName}`;
        courseApplicants.add(applicantKey);
      });

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalBookings,
        uniqueApplicants: courseApplicants.size,
        pcRentals,
        scheduleStats:
          course.schedules?.map(schedule => {
            const scheduleBookings = courseBookings.filter(
              booking => booking.scheduleId === schedule.id
            );

            // スケジュール別のユニークな申込者数
            const scheduleApplicants = new Set();
            scheduleBookings.forEach(booking => {
              const applicantKey = `${booking.companyName}|${booking.fullName}`;
              scheduleApplicants.add(applicantKey);
            });

            return {
              scheduleId: schedule.id,
              dateTime: schedule.dateTime,
              capacity: schedule.capacity,
              bookings: scheduleBookings.length,
              uniqueApplicants: scheduleApplicants.size,
              pcRentals: scheduleBookings.filter(
                booking => booking.needsPcRental
              ).length,
              remainingSlots: schedule.capacity - scheduleBookings.length,
            };
          }) || [],
      };
    });

    return {
      totalBookings: bookings.length,
      totalApplicants: uniqueApplicants.size,
      totalPcRentals: bookings.filter(booking => booking.needsPcRental).length,
      courseStats,
      recentBookings: bookings.slice(0, 10), // 最新10件
    };
  } catch (error) {
    console.error('統計情報取得エラー:', error);
    throw error;
  }
};
