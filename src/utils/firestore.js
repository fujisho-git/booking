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
  serverTimestamp 
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

// 申し込みの作成
export const createBooking = async (bookingData) => {
  try {
    const docRef = await addDoc(bookingsCollection, {
      ...bookingData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('申し込み作成エラー:', error);
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