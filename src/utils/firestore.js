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
      cancelMethod: 'user_interface', // 'user_interface', 'admin_panel', 'system'

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
    console.log('キャンセル日時:', new Date().toLocaleString('ja-JP'));
    console.log('==========================');

    return docRef.id;
  } catch (error) {
    console.error('キャンセルログ記録エラー:', error);
    // ログ記録に失敗してもキャンセル処理は続行
    return null;
  }
};

// 申し込みのキャンセル（削除）- ログ記録付き
export const cancelBooking = async (
  bookingId,
  cancelReason = '利用者によるキャンセル'
) => {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);

    // 申し込みが存在するかチェック
    const bookingDoc = await getDoc(bookingRef);
    if (!bookingDoc.exists()) {
      throw new Error('申し込みが見つかりません');
    }

    const bookingData = { id: bookingDoc.id, ...bookingDoc.data() };

    // キャンセルログを記録（エラーが発生してもキャンセル処理は続行）
    try {
      await createCancelLog(bookingData, cancelReason);
    } catch (logError) {
      console.error(
        'ログ記録は失敗しましたが、キャンセル処理を続行します:',
        logError
      );
    }

    // 申し込みを削除
    await deleteDoc(bookingRef);

    // 詳細なシステムログ
    console.log('=== システムログ: 申し込み削除完了 ===');
    console.log('キャンセルされた申し込みID:', bookingId);
    console.log('キャンセル理由:', cancelReason);
    console.log('キャンセル実行時刻:', new Date().toISOString());
    console.log('=====================================');

    return true;
  } catch (error) {
    console.error('申し込みキャンセルエラー:', error);
    console.error('=== システムエラーログ ===');
    console.error('失敗した申し込みID:', bookingId);
    console.error('エラー発生時刻:', new Date().toISOString());
    console.error('エラーコード:', error.code);
    console.error('エラーメッセージ:', error.message);
    console.error('=========================');
    throw error;
  }
};

// 特定ユーザーの申し込み一覧を取得（完全一致）
export const getUserBookings = async (companyName, fullName) => {
  try {
    if (!companyName || !fullName) {
      return [];
    }

    // まず、orderByなしでクエリを実行
    const q = query(
      bookingsCollection,
      where('companyName', '==', companyName.trim()),
      where('fullName', '==', fullName.trim())
    );

    const querySnapshot = await getDocs(q);
    const bookings = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // クライアント側でソート（createdAtが存在する場合のみ）
    return bookings.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.toDate() - a.createdAt.toDate();
      }
      return 0;
    });
  } catch (error) {
    console.error('ユーザー申し込み取得エラー:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      companyName: companyName?.trim(),
      fullName: fullName?.trim(),
    });

    // エラーが発生した場合、getAllBookingsにフォールバック
    try {
      console.log('フォールバック: getAllBookingsを使用');
      const allBookings = await getAllBookings();
      return allBookings.filter(
        booking =>
          booking.companyName === companyName.trim() &&
          booking.fullName === fullName.trim()
      );
    } catch (fallbackError) {
      console.error('フォールバック処理も失敗:', fallbackError);
      throw new Error(
        '申し込み情報の取得に失敗しました。時間をおいて再度お試しください。'
      );
    }
  }
};

// 部分検索で申し込み一覧を取得
export const searchBookingsByPartialMatch = async (companyName, fullName) => {
  try {
    if (!companyName && !fullName) {
      return [];
    }

    // すべての申し込みを取得してクライアント側でフィルタリング
    const allBookings = await getAllBookings();

    // 部分一致でフィルタリング
    const filteredBookings = allBookings.filter(booking => {
      const companyMatch =
        !companyName ||
        booking.companyName
          .toLowerCase()
          .includes(companyName.toLowerCase().trim());
      const nameMatch =
        !fullName ||
        booking.fullName.toLowerCase().includes(fullName.toLowerCase().trim());

      return companyMatch && nameMatch;
    });

    // 会社名と氏名でグループ化
    const groupedBookings = {};
    filteredBookings.forEach(booking => {
      const key = `${booking.companyName}|${booking.fullName}`;
      if (!groupedBookings[key]) {
        groupedBookings[key] = {
          companyName: booking.companyName,
          fullName: booking.fullName,
          bookings: [],
        };
      }
      groupedBookings[key].bookings.push(booking);
    });

    // 配列に変換してソート
    return Object.values(groupedBookings).sort((a, b) => {
      // 会社名でソート、同じ会社名なら氏名でソート
      const companyCompare = a.companyName.localeCompare(b.companyName, 'ja');
      if (companyCompare !== 0) return companyCompare;
      return a.fullName.localeCompare(b.fullName, 'ja');
    });
  } catch (error) {
    console.error('部分検索エラー:', error);
    throw new Error('検索に失敗しました。時間をおいて再度お試しください。');
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
