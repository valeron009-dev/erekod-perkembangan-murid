import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  increment,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export { db };

// User Data
export const getUserData = async (uid: string) => {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
};

export const updateUserRecord = async (uid: string, data: any) => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  
  // Get active academic session
  const sessionsRef = collection(db, "academicSessions");
  const qActive = query(sessionsRef, where("isActive", "==", true));
  const activeSnap = await getDocs(qActive);
  const activeSessionId = !activeSnap.empty ? activeSnap.docs[0].id : "2026";
  
  if (!userSnap.exists()) {
    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(now.getDate() + 14);

    await setDoc(userRef, {
      email: data.email,
      displayName: data.displayName,
      role: data.role || "teacher",
      status: "active",
      subscriptionStatus: "trial",
      subscriptionPlan: "trial_14_days",
      trialStartedAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromDate(trialEndsAt),
      isReadOnly: false,
      currentSessionId: activeSessionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });
  } else {
    const existingData = userSnap.data();
    const updates: any = {
      lastLoginAt: serverTimestamp()
    };

    // Backfill currentSessionId if missing
    if (!existingData.currentSessionId) {
      updates.currentSessionId = activeSessionId;
    }

    await updateDoc(userRef, updates);
  }
};

// Client-side Cache
const cache: { [key: string]: any } = {};

// Allowed Teachers
export const checkAllowedTeacher = async (email: string) => {
  const cacheKey = "allowedTeachers_all";
  let teachers = cache[cacheKey];
  
  if (!teachers) {
    const teachersRef = collection(db, "allowedTeachers");
    const snap = await getDocs(teachersRef);
    teachers = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    cache[cacheKey] = teachers;
  }
  
  return teachers.find((t: any) => t.email === email && t.status === "active") || null;
};

// Classes
export const getClassById = async (uid: string, classId: string) => {
  const cacheKey = `class_${uid}_${classId}`;
  if (cache[cacheKey]) return cache[cacheKey];
  
  const classDoc = await getDoc(doc(db, "users", uid, "classes", classId));
  const data = classDoc.exists() ? { id: classDoc.id, ...classDoc.data() } as any : null;
  if (data) cache[cacheKey] = data;
  return data;
};

export const createClass = async (uid: string, data: {
  classLabel: string;
  year: number;
  sessionId: string;
  subjectId?: string;
}) => {
  const { classLabel, year, sessionId: rawSessionId, subjectId } = data;
  const sessionId = rawSessionId ?? "2026";
  const labelSlug = classLabel.trim().toLowerCase().replace(/\s+/g, "_");
  const classId = `class_${year}_${labelSlug}`;
  const className = `${year} ${classLabel}`;

  // Check for duplicate class
  const classRef = doc(db, "users", uid, "classes", classId);
  const classSnap = await getDoc(classRef);
  
  // If class doesn't exist, create it
  if (!classSnap.exists()) {
    await setDoc(classRef, {
      className,
      classLabel,
      year,
      sessionId,
      studentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Create classSubject record if subjectId is provided
  if (subjectId) {
    const classSubjectId = `${classId}_${subjectId}`;
    const classSubjectRef = doc(db, "users", uid, "classSubjects", classSubjectId);
    
    // Check if classSubject already exists
    const csSnap = await getDoc(classSubjectRef);
    if (csSnap.exists()) {
      throw new Error("Subjek ini sudah didaftarkan untuk kelas ini.");
    }

    await setDoc(classSubjectRef, {
      classId,
      className,
      subjectId,
      year,
      sessionId,
      studentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { id: classId, className };
};

export const getClassesByTeacher = async (uid: string, sessionId: string) => {
  const safeSessionId = sessionId ?? "2026";
  const classesRef = collection(db, "users", uid, "classes");
  const q = query(
    classesRef, 
    where("sessionId", "==", safeSessionId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
};

// Class Subjects
export const getClassSubjectsByTeacher = async (uid: string, sessionId: string) => {
  const safeSessionId = sessionId ?? "2026";
  const cacheKey = `classSubjects_${uid}_${safeSessionId}`;
  if (cache[cacheKey]) return cache[cacheKey];
  
  const classSubjectsRef = collection(db, "users", uid, "classSubjects");
  const q = query(
    classSubjectsRef, 
    where("sessionId", "==", safeSessionId)
  );
  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

// Students
export const getStudentsByClass = async (uid: string, classId: string) => {
  const cacheKey = `students_${uid}_${classId}`;
  if (cache[cacheKey]) return cache[cacheKey];
  
  const studentsRef = collection(db, "users", uid, "students");
  const q = query(studentsRef, where("classId", "==", classId));
  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

export const syncStudents = async (
  uid: string,
  classId: string,
  classInfo: { className: string; sessionId: string },
  studentNames: string[]
) => {
  const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  
  // 1. Load existing students
  const existingStudents = await getStudentsByClass(uid, classId);
  const existingMap = new Map<string, any>(existingStudents.map((s: any) => [s.normalizedFullName, s]));
  
  const csvNormalizedNames = new Set(studentNames.map(normalize));
  
  let newCount = 0;
  let maintainedCount = 0;
  let deactivatedCount = 0;

  const batch: Promise<any>[] = [];

  // 2. Process CSV students
  for (const fullName of studentNames) {
    const normalized = normalize(fullName);
    if (!normalized) continue;

    const existing = existingMap.get(normalized);
    if (existing) {
      // Maintain/Reactivate
      batch.push(updateDoc(doc(db, "users", uid, "students", existing.id), {
        isActive: true,
        updatedAt: serverTimestamp()
      }));
      maintainedCount++;
    } else {
      // Create New
      const studentId = `std_${classId}_${normalized.replace(/\s+/g, "_")}`;
      batch.push(setDoc(doc(db, "users", uid, "students", studentId), {
        classId,
        className: classInfo.className,
        sessionId: classInfo.sessionId,
        fullName,
        normalizedFullName: normalized,
        isActive: true,
        isNewStudent: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      newCount++;
    }
  }

  // 3. Deactivate students not in CSV
  for (const existing of existingStudents) {
    if (!csvNormalizedNames.has(existing.normalizedFullName)) {
      if (existing.isActive) {
        batch.push(updateDoc(doc(db, "users", uid, "students", existing.id), {
          isActive: false,
          updatedAt: serverTimestamp()
        }));
        deactivatedCount++;
      }
    }
  }

  await Promise.all(batch);

  // 4. Update student count in classSubjects
  const allStudents = await getStudentsByClass(uid, classId);
  const activeCount = allStudents.filter((s: any) => s.isActive).length;
  
  const classSubjectsRef = collection(db, "users", uid, "classSubjects");
  const qSubjects = query(classSubjectsRef, where("classId", "==", classId));
  const subjectsSnap = await getDocs(qSubjects);
  
  const subjectUpdates = subjectsSnap.docs.map((sDoc: any) => 
    updateDoc(doc(db, "users", uid, "classSubjects", sDoc.id), {
      studentCount: activeCount,
      updatedAt: serverTimestamp()
    })
  );
  
  await Promise.all(subjectUpdates);

  return {
    totalRead: studentNames.length,
    newCount,
    maintainedCount,
    deactivatedCount
  };
};

export const addStudent = async (
  uid: string,
  classId: string,
  classInfo: { className: string; sessionId: string },
  fullName: string
) => {
  const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  const normalized = normalize(fullName);
  const studentId = `std_${classId}_${normalized.replace(/\s+/g, "_")}`;
  
  const studentRef = doc(db, "users", uid, "students", studentId);
  const studentSnap = await getDoc(studentRef);
  
  if (studentSnap.exists()) {
    // If exists but inactive, reactivate it
    await updateDoc(studentRef, {
      isActive: true,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(studentRef, {
      classId,
      className: classInfo.className,
      sessionId: classInfo.sessionId,
      fullName,
      normalizedFullName: normalized,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Update student count
  await updateClassStudentCount(uid, classId);
};

export const updateStudent = async (uid: string, studentId: string, fullName: string) => {
  const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  const normalized = normalize(fullName);
  
  await updateDoc(doc(db, "users", uid, "students", studentId), {
    fullName,
    normalizedFullName: normalized,
    updatedAt: serverTimestamp()
  });
};

export const toggleStudentStatus = async (uid: string, studentId: string, classId: string, isActive: boolean) => {
  await updateDoc(doc(db, "users", uid, "students", studentId), {
    isActive,
    updatedAt: serverTimestamp()
  });
  
  // Update student count
  await updateClassStudentCount(uid, classId);
};

const updateClassStudentCount = async (uid: string, classId: string) => {
  const students = await getStudentsByClass(uid, classId);
  const activeCount = students.filter((s: any) => s.isActive).length;
  
  const classSubjectsRef = collection(db, "users", uid, "classSubjects");
  const qSubjects = query(classSubjectsRef, where("classId", "==", classId));
  const subjectsSnap = await getDocs(qSubjects);
  
  const batch = subjectsSnap.docs.map((sDoc: any) => 
    updateDoc(doc(db, "users", uid, "classSubjects", sDoc.id), {
      studentCount: activeCount,
      updatedAt: serverTimestamp()
    })
  );
  
  await Promise.all(batch);
};

// Learning Standards
export const getLearningStandardsBySubject = async (subjectId: string, year: number) => {
  const cacheKey = `ls_${subjectId}_${year}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const lsRef = collection(db, "learningStandards");
  const q = query(
    lsRef, 
    where("subjectId", "==", subjectId), 
    where("year", "==", year),
    where("isActive", "==", true),
    orderBy("sortOrder", "asc")
  );
  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

// Progress Records
export const getProgressRecordsByClassSubject = async (uid: string, classSubjectId: string) => {
  const recordsRef = collection(db, "users", uid, "progressRecords");
  const q = query(recordsRef, where("classSubjectId", "==", classSubjectId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
};

// Update Progress Record
export const updateProgressRecord = async (uid: string, recordId: string, data: any) => {
  const recordRef = doc(db, "users", uid, "progressRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  
  if (recordSnap.exists()) {
    await updateDoc(recordRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(recordRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

// Evidence Helpers
export const getEvidencesForRecord = async (uid: string, recordId: string) => {
  const evidencesRef = collection(db, "users", uid, "progressRecords", recordId, "evidences");
  const q = query(evidencesRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
};

export const addEvidenceToRecord = async (uid: string, recordId: string, data: any) => {
  const evidencesRef = collection(db, "users", uid, "progressRecords", recordId, "evidences");
  const recordRef = doc(db, "users", uid, "progressRecords", recordId);
  
  await Promise.all([
    setDoc(doc(evidencesRef), {
      ...data,
      recordId, // Also store recordId for easier mapping
      classSubjectId: data.classSubjectId, // Store classSubjectId for collection group filtering
      createdAt: serverTimestamp()
    }),
    updateDoc(recordRef, {
      evidenceCount: increment(1),
      updatedAt: serverTimestamp()
    }).catch(async (err) => {
      // If record doesn't exist yet (unlikely but possible), create it
      if (err.code === 'not-found') {
        await setDoc(recordRef, {
          uid,
          recordId,
          studentId: data.studentId,
          classSubjectId: data.classSubjectId,
          evidenceCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    })
  ]);
};

// Admin Operations
export const getAdminStats = async () => {
  const [users, subjects, ls, sessions] = await Promise.all([
    getAllUsers(),
    getSubjects(),
    getLearningStandards(),
    getAcademicSessions()
  ]);

  const activeTeachers = users.filter((u: any) => 
    (u.role === "teacher" || u.role === "super_admin") && 
    (u.status !== "inactive")
  ).length;
  const activeSubjects = subjects.filter((s: any) => s.isActive).length;
  const activeSession = sessions.find((s: any) => s.isActive);

  return {
    activeTeachers,
    activeSubjects,
    totalStandards: ls.length,
    currentSession: activeSession ? activeSession.name : "Tiada Sesi Aktif"
  };
};

export const getAllowedTeachers = async () => {
  const cacheKey = "allowedTeachers_all";
  if (cache[cacheKey]) return cache[cacheKey];

  const snap = await getDocs(collection(db, "allowedTeachers"));
  const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
};

export const updateTeacherSubscription = async (uid: string, action: 'activate' | 'expire' | 'reset') => {
  const userRef = doc(db, "users", uid);
  const now = new Date();
  
  if (action === 'activate') {
    await updateDoc(userRef, {
      subscriptionStatus: "active",
      subscriptionPlan: "paid",
      isReadOnly: false,
      updatedAt: serverTimestamp()
    });
  } else if (action === 'expire') {
    await updateDoc(userRef, {
      subscriptionStatus: "expired",
      isReadOnly: true,
      updatedAt: serverTimestamp()
    });
  } else if (action === 'reset') {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(now.getDate() + 14);
    await updateDoc(userRef, {
      subscriptionStatus: "trial",
      subscriptionPlan: "trial_14_days",
      trialStartedAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromDate(trialEndsAt),
      isReadOnly: false,
      updatedAt: serverTimestamp()
    });
  }
};

export const addAllowedTeacher = async (data: { email: string; role: string; status: string }) => {
  const docId = data.email.replace(/[.@]/g, "_");
  await setDoc(doc(db, "allowedTeachers", docId), data);
};

export const updateAllowedTeacher = async (id: string, data: Partial<{ role: string; status: string }>) => {
  await updateDoc(doc(db, "allowedTeachers", id), data);
};

export const getSubjects = async () => {
  const cacheKey = "subjects_all";
  if (cache[cacheKey]) return cache[cacheKey];

  const snap = await getDocs(collection(db, "subjects"));
  const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

export const saveSubject = async (data: { subjectCode: string; subjectName: string; isActive: boolean }) => {
  await setDoc(doc(db, "subjects", data.subjectCode), data);
};

export const getLearningStandards = async () => {
  const cacheKey = "ls_all";
  if (cache[cacheKey]) return cache[cacheKey];

  const snap = await getDocs(collection(db, "learningStandards"));
  const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

export const saveLearningStandard = async (data: any) => {
  const lsRef = collection(db, "learningStandards");
  await setDoc(doc(lsRef), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const deleteEvidence = async (uid: string, recordId: string, evidenceId: string) => {
  const evidenceRef = doc(db, "users", uid, "progressRecords", recordId, "evidences", evidenceId);
  const recordRef = doc(db, "users", uid, "progressRecords", recordId);
  
  await Promise.all([
    deleteDoc(evidenceRef),
    updateDoc(recordRef, {
      evidenceCount: increment(-1),
      updatedAt: serverTimestamp()
    })
  ]);
};

export const getAcademicSessions = async () => {
  const cacheKey = "sessions_all";
  if (cache[cacheKey]) return cache[cacheKey];

  const snap = await getDocs(collection(db, "academicSessions"));
  const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  cache[cacheKey] = data;
  return data;
};

export const setActiveSession = async (sessionId: string) => {
  const sessions = await getAcademicSessions();
  const batch: Promise<any>[] = [];
  
  sessions.forEach((s: any) => {
    batch.push(updateDoc(doc(db, "academicSessions", s.id), {
      isActive: s.id === sessionId
    }));
  });
  
  await Promise.all(batch);
};
