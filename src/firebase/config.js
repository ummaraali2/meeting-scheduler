import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDBACRCk1NnxEByOkr33eJl8qF5sYeeLs4",
  authDomain: "meeting-scheduler-53198.firebaseapp.com",
  projectId: "meeting-scheduler-53198",
  storageBucket: "meeting-scheduler-53198.firebasestorage.app",
  messagingSenderId: "419183092116",
  appId: "1:419183092116:web:70778893aa77129a7b2f81",
  measurementId: "G-ETHFJYX95Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Request Gmail permissions for sending emails
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    
    return {
      user: result.user,
      token: token
    };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};