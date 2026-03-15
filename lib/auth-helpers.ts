import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user.email && !user.email.endsWith("@moe-dl.edu.my")) {
      await signOut(auth);
      throw new Error("Hanya akaun @moe-dl.edu.my dibenarkan.");
    }
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user && user.email && !user.email.endsWith("@moe-dl.edu.my")) {
      await signOut(auth);
      callback(null);
    } else {
      callback(user);
    }
  });
};
