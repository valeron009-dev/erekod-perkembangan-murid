import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    console.log("Total users:", snap.size);
    const teachers = snap.docs.filter(doc => {
      const data = doc.data();
      return data.role === "teacher" || data.role === "super_admin";
    });
    console.log("Teachers count:", teachers.length);
    teachers.forEach(doc => {
      console.log(doc.id, doc.data().email, doc.data().status, doc.data().isActive);
    });
  } catch (e) {
    console.error("Error:", e);
  }
}

checkUsers();
