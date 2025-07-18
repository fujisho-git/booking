import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db } from '../firebase';

// 講座関連の操作
export const coursesCollection = collection(db, 'courses');
export const bookingsCollection = collection(db, 'bookings');

// 講座の取得
export const getCourses = async () => {
  try {
    const querySnapshot = await getDocs(query(coursesCollection, orderBy('createdAt', 'desc')));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('講座の取得エラー:', error);
    throw error;
  }
};

// 特定の講座の取得
export const getCourse = async (courseId) => {
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
export const createCourse = async (courseData) => {
  try {
    const docRef = await addDoc(coursesCollection, {
      ...courseData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('講座作成エラー:', error);
    throw error;
  }
};

// 申し込みの作成（定員制御付き）
export const createBooking = async (bookingData) => {
  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. 現在の申し込み状況をチェック
      const bookingsQuery = query(
        bookingsCollection,
        where('courseId', '==', bookingData.courseId),
        where('scheduleId', '==', bookingData.scheduleId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const currentBookings = bookingsSnapshot.docs.map(doc => doc.data());

      // 2. 重複申し込みチェック
      const duplicateBooking = currentBookings.find(booking => 
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
      const schedule = courseData.schedules?.find(s => s.id === bookingData.scheduleId);
      
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
        const pcRentals = currentBookings.filter(booking => booking.needsPcRental).length;
        if (pcRentals >= schedule.pcRentalSlots) {
          throw new Error('PC_RENTAL_FULL');
        }
      }

      // 6. 申し込みデータを作成
      const newBookingRef = doc(bookingsCollection);
      transaction.set(newBookingRef, {
        ...bookingData,
        createdAt: serverTimestamp()
      });

      return newBookingRef.id;
    });

    return result;
  } catch (error) {
    console.error('申し込み作成エラー:', error);
    
    // カスタムエラーメッセージを設定
    if (error.message === 'DUPLICATE_BOOKING') {
      throw new Error('この講座には既に申し込み済みです。一つの講座につき一人一回までの申し込みとなります。');
    } else if (error.message === 'CAPACITY_EXCEEDED') {
      throw new Error('申し訳ございませんが、選択された日時は定員に達しています。他の日時をお選びください。');
    } else if (error.message === 'PC_RENTAL_FULL') {
      throw new Error('申し訳ございませんが、PC貸出枠が満席です。PC持参でお申し込みください。');
    } else if (error.message === 'COURSE_NOT_FOUND') {
      throw new Error('講座が見つかりません。');
    } else if (error.message === 'SCHEDULE_NOT_FOUND') {
      throw new Error('指定された日時が見つかりません。');
    }
    
    throw error;
  }
};

// 特定のユーザーが特定の講座に申し込み済みかチェック
export const checkUserBookingExists = async (courseId, companyName, fullName) => {
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
      updatedAt: serverTimestamp()
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
      ...doc.data()
    }));
  } catch (error) {
    console.error('申し込み一覧取得エラー:', error);
    throw error;
  }
};

// 特定の講座の申し込み一覧を取得
export const getBookingsByCourse = async (courseId) => {
  try {
    const q = query(
      bookingsCollection,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
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
      ...doc.data()
    }));
  } catch (error) {
    console.error('スケジュール別申し込み取得エラー:', error);
    throw error;
  }
};

// 申し込み統計情報を取得
export const getBookingStatistics = async () => {
  try {
    const bookings = await getAllBookings();
    const courses = await getCourses();
    
    // 講座別統計
    const courseStats = courses.map(course => {
      const courseBookings = bookings.filter(booking => booking.courseId === course.id);
      const totalBookings = courseBookings.length;
      const pcRentals = courseBookings.filter(booking => booking.needsPcRental).length;
      
      return {
        courseId: course.id,
        courseTitle: course.title,
        totalBookings,
        pcRentals,
        scheduleStats: course.schedules?.map(schedule => {
          const scheduleBookings = courseBookings.filter(booking => booking.scheduleId === schedule.id);
          return {
            scheduleId: schedule.id,
            dateTime: schedule.dateTime,
            capacity: schedule.capacity,
            bookings: scheduleBookings.length,
            pcRentals: scheduleBookings.filter(booking => booking.needsPcRental).length,
            remainingSlots: schedule.capacity - scheduleBookings.length
          };
        }) || []
      };
    });

    return {
      totalBookings: bookings.length,
      totalPcRentals: bookings.filter(booking => booking.needsPcRental).length,
      courseStats,
      recentBookings: bookings.slice(0, 10) // 最新10件
    };
  } catch (error) {
    console.error('統計情報取得エラー:', error);
    throw error;
  }
}; 