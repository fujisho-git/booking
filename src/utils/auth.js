import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../firebase';

// ログイン
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('ログインエラー:', error);
    throw error;
  }
};

// ログアウト
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('ログアウトエラー:', error);
    throw error;
  }
};

// 管理者アカウント作成（開発用）
export const createAdminUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('アカウント作成エラー:', error);
    throw error;
  }
};

// 認証状態の監視
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
}; 