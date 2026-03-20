import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function fixCorruptedData() {
  const lsRef = collection(db, "learningStandards");
  const snap = await getDocs(lsRef);
  
  let fixCount = 0;
  const batch = writeBatch(db);
  
  snap.forEach(doc => {
    const data = doc.data();
    let { spDescription, spCode } = data;
    let changed = false;

    if (spDescription && typeof spDescription === 'string') {
      // Check for leading quotes
      if (spDescription.startsWith('"')) {
        spDescription = spDescription.substring(1);
        changed = true;
      }
      // Check for trailing quotes
      if (spDescription.endsWith('"')) {
        spDescription = spDescription.substring(0, spDescription.length - 1);
        changed = true;
      }
      // Trim again
      spDescription = spDescription.trim();
    }

    if (spCode && typeof spCode === 'string') {
        if (spCode.startsWith('"')) {
            spCode = spCode.substring(1);
            changed = true;
        }
        if (spCode.endsWith('"')) {
            spCode = spCode.substring(0, spCode.length - 1);
            changed = true;
        }
        spCode = spCode.trim();
    }

    if (changed) {
      batch.update(doc.ref, {
        spDescription,
        spCode,
        updatedAt: serverTimestamp()
      });
      fixCount++;
    }
  });

  if (fixCount > 0) {
    // await batch.commit(); // Don't commit yet, just log
    console.log(`Would fix ${fixCount} records.`);
  } else {
    console.log("No corrupted records found.");
  }
}

fixCorruptedData().catch(console.error);
