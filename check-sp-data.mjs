import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkData() {
  const q = query(
    collection(db, "learningStandards"),
    where("subjectId", "==", "BI-SM"),
    where("year", "==", 6),
    where("spCode", "==", "1.2.4")
  );
  
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("No document found for BI-SM Tingkatan 6 1.2.4");
    // Try searching by spCode only
    const q2 = query(collection(db, "learningStandards"), where("spCode", "==", "1.2.4"));
    const snap2 = await getDocs(q2);
    snap2.forEach(doc => {
      console.log("Found by spCode:", doc.id, doc.data());
    });
  } else {
    snap.forEach(doc => {
      console.log("Found:", doc.id, doc.data());
    });
  }
}

checkData().catch(console.error);
