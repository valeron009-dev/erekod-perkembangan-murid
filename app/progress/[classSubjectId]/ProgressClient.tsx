"use client";

import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2,
  Info,
  ChevronDown,
  Upload,
  Paperclip,
  Camera,
  AlertCircle,
  FileText,
  UserPlus,
  UserMinus,
  UserCheck,
  MoreVertical
} from "lucide-react";
import { onAuthStateChange } from "@/lib/auth-helpers";
import { 
  getStudentsByClass, 
  getLearningStandardsBySubject, 
  getProgressRecordsByClassSubject,
  updateProgressRecord,
  getClassById,
  getUserData,
  addStudent,
  toggleStudentStatus,
  db
} from "@/lib/firestore-helpers";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/Card";
import { Navbar } from "@/components/ui/Navbar";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StudentImportModal } from "@/components/StudentImportModal";
import { EvidenceModal } from "@/components/EvidenceModal";
import StudentManagementModal from "@/components/StudentManagementModal";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/DropdownMenu";


export default function ProgressClient() {
  const params = useParams();
  const router = useRouter();
  const classSubjectId = params.classSubjectId as string;

  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [classSubject, setClassSubject] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedRecordForEvidence, setSelectedRecordForEvidence] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<"add" | "edit">("add");
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);

  // Prefetch summary page
  useEffect(() => {
    if (classSubjectId) {
      router.prefetch(`/progress/${classSubjectId}/summary`);
    }
  }, [classSubjectId, router]);

  const fetchData = useCallback(async (uid: string) => {
    if (!uid || !classSubjectId) return;
    
    try {
      setLoading(true);
      
      // STAGE 1: Load essential class info and student list first
      const csDoc = await getDoc(doc(db, "users", uid, "classSubjects", classSubjectId));
      
      if (!csDoc.exists()) {
        console.error("ClassSubject document not found:", classSubjectId);
        setLoading(false);
        return;
      }
      
      const csData = csDoc.data();
      setClassSubject({ id: csDoc.id, ...csData });

      // Load students and standards in parallel to show the grid structure as fast as possible
      const [studentList, lsList, classInfo] = await Promise.all([
        getStudentsByClass(uid, csData.classId),
        getLearningStandardsBySubject(csData.subjectId, csData.year),
        getClassById(uid, csData.classId)
      ]);

      setStudents(studentList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setStandards(lsList);
      setClassData(classInfo);

      if (lsList.length > 0) {
        setSelectedGroupName(prev => prev || lsList[0].groupName);
      }

      // SET LOADING FALSE HERE so student names appear immediately
      setLoading(false);

      // STAGE 2: Load heavy progress records in the background (Non-blocking)
      setRecordsLoading(true);
      getProgressRecordsByClassSubject(uid, classSubjectId).then(recordList => {
        const recordMap: Record<string, any> = {};
        recordList.forEach((r: any) => {
          recordMap[`${r.studentId}_${r.learningStandardId}`] = r;
        });
        setRecords(recordMap);
        setRecordsLoading(false);
      }).catch(err => {
        console.error("Error loading records", err);
        setRecordsLoading(false);
      });

    } catch (error) {
      console.error("Error fetching data", error);
      setLoading(false);
    }
  }, [classSubjectId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Load userData and class data in parallel
        const [data] = await Promise.all([
          getUserData(firebaseUser.uid),
          fetchData(firebaseUser.uid)
        ]);
        setUserData(data);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [classSubjectId, router, fetchData]);

  const groupNames = useMemo(() => {
    const groups = Array.from(new Set(standards.map(s => s.groupName)));
    return groups.map(g => ({ label: g, value: g }));
  }, [standards]);

  const filteredStandards = useMemo(() => {
    return standards.filter(s => s.groupName === selectedGroupName);
  }, [standards, selectedGroupName]);

  const tpToNumber = (tp: string): number => {
    if (!tp) return 0;
    const match = tp.match(/TP(\d)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const numberToTp = (num: number): string => {
    if (num < 1) return "-";
    const rounded = Math.round(num);
    return `TP${Math.min(6, Math.max(1, rounded))}`;
  };

  const studentSummaries = useMemo(() => {
    const summaries: Record<string, { average: number; finalTp: string }> = {};
    
    students.forEach(student => {
      const studentTpNumbers = filteredStandards.map(s => {
        const record = records[`${student.id}_${s.id}`];
        return tpToNumber(record?.tp || "");
      }).filter(n => n > 0);

      if (studentTpNumbers.length > 0) {
        const sum = studentTpNumbers.reduce((a, b) => a + b, 0);
        const avg = sum / studentTpNumbers.length;
        summaries[student.id] = {
          average: avg,
          finalTp: numberToTp(avg)
        };
      } else {
        summaries[student.id] = {
          average: 0,
          finalTp: "-"
        };
      }
    });

    return summaries;
  }, [students, filteredStandards, records]);

  const classSummary = useMemo(() => {
    const assessedStudents = Object.values(studentSummaries).filter(s => s.average > 0);
    const totalAvg = assessedStudents.length > 0 
      ? assessedStudents.reduce((a, b) => a + b.average, 0) / assessedStudents.length 
      : 0;

    return {
      totalStandards: filteredStandards.length,
      studentsAssessed: assessedStudents.length,
      classAverage: numberToTp(totalAvg)
    };
  }, [studentSummaries, filteredStandards]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = showInactiveStudents ? !s.isActive : s.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, showInactiveStudents]);

  const visibleStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleCount);
  }, [filteredStudents, visibleCount]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setVisibleCount(prev => Math.min(prev + 20, filteredStudents.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filteredStudents.length]);

  const handleTPChange = async (studentId: string, standardId: string, tp: string) => {
    if (userData?.isReadOnly) return;
    
    const standard = standards.find(s => s.id === standardId);
    if (!standard) return;
    
    const key = `${studentId}_${standardId}`;
    const newRecord = {
      ...records[key],
      classId: classSubject.classId,
      classSubjectId: classSubject.id,
      studentId,
      subjectId: classSubject.subjectId,
      learningStandardId: standardId,
      groupName: standard.groupName,
      spCode: standard.spCode,
      tp,
      sessionId: classSubject.sessionId,
    };

    setRecords(prev => ({ ...prev, [key]: newRecord }));

    try {
      const recordId = records[key]?.id || `${classSubject.id}_${studentId}_${standardId}`;
      await updateProgressRecord(user.uid, recordId, newRecord);
    } catch (error) {
      console.error("Failed to save TP", error);
    }
  };

  const handleStudentSave = async (fullName: string) => {
    if (!user || !classSubject) return;
    
    if (studentModalMode === "add") {
      await addStudent(user.uid, classSubject.classId, {
        className: classData?.className || classSubject.className,
        sessionId: classSubject.sessionId
      }, fullName);
    }
    
    await fetchData(user.uid);
  };

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [studentToToggle, setStudentToToggle] = useState<{id: string, currentStatus: boolean} | null>(null);

  const handleToggleStatus = async (studentId: string, currentStatus: boolean) => {
    if (!user || !classSubject) return;
    
    if (currentStatus) { // Marking as inactive (Tandakan Pindah)
      setStudentToToggle({ id: studentId, currentStatus });
      setIsConfirmModalOpen(true);
    } else { // Re-activating
      await toggleStudentStatus(user.uid, studentId, classSubject.classId, true);
      await fetchData(user.uid);
    }
  };

  const confirmToggleStatus = async () => {
    if (!user || !classSubject || !studentToToggle) return;
    await toggleStudentStatus(user.uid, studentToToggle.id, classSubject.classId, false);
    await fetchData(user.uid);
    setIsConfirmModalOpen(false);
    setStudentToToggle(null);
  };

  if (!classSubject) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} userData={userData} />
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-4">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-48 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} userData={userData} />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="w-fit">
            <ArrowLeft size={18} className="mr-2" />
            Kembali
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none gap-2 border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => router.push(`/progress/${classSubjectId}/summary`)}
            >
              <FileText size={16} />
              <span className="whitespace-nowrap">Ringkasan TP</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                setStudentModalMode("add");
                setIsStudentModalOpen(true);
              }}
              disabled={userData?.isReadOnly}
            >
              <UserPlus size={16} />
              <span className="whitespace-nowrap">Tambah Murid</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setIsImportModalOpen(true)}
              disabled={userData?.isReadOnly}
            >
              <Upload size={16} />
              <span className="whitespace-nowrap">Import Murid</span>
            </Button>
          </div>
        </div>

        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {classData?.className || classSubject?.className} &bull; {classSubject?.subjectId}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-sm">
              <span>Tahun {classSubject?.year}</span>
              <span>&bull;</span>
              <span>Sesi {classSubject?.sessionId}</span>
              <span>&bull;</span>
              <button 
                onClick={() => setShowInactiveStudents(!showInactiveStudents)}
                className={`font-bold transition-colors ${showInactiveStudents ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
              >
                {showInactiveStudents ? "Lihat Murid Aktif" : "Lihat Murid Pindah"}
              </button>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <Select
                label="Pilih Topik / Unit"
                options={groupNames}
                value={selectedGroupName}
                onChange={(e) => setSelectedGroupName(e.target.value)}
              />
            </div>
            <div className="relative pt-0 sm:pt-6">
              <Search className="absolute left-3 top-1/2 sm:top-[calc(50%+12px)] -translate-y-1/2 text-slate-400" size={18} />
              <Input
                placeholder="Cari murid..."
                className="pl-10 w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Topic Summary Section */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ringkasan Topik</p>
              <p className="text-sm font-bold text-slate-900 truncate mt-1" title={selectedGroupName}>
                {selectedGroupName}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bilangan Standard</p>
              <p className="text-xl font-black text-slate-900 mt-1">{classSummary.totalStandards}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Murid Dinilai</p>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {classSummary.studentsAssessed} <span className="text-xs font-bold text-slate-400">/ {students.length}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mobile/Tablet View (Cards) */}
        <div className="block lg:hidden space-y-4 mb-8">
          {visibleStudents.map((student) => (
            <StudentCard 
              key={student.id}
              student={student}
              filteredStandards={filteredStandards}
              records={records}
              recordsLoading={recordsLoading}
              userData={userData}
              studentSummaries={studentSummaries}
              classSubject={classSubject}
              user={user}
              handleTPChange={handleTPChange}
              onOpenEvidence={(data: any) => {
                setSelectedRecordForEvidence(data);
                setIsEvidenceModalOpen(true);
              }}
              onToggleStatus={handleToggleStatus}
            />
          ))}
          {filteredStudents.length > visibleCount && (
            <div className="py-4 text-center">
              <Button variant="ghost" onClick={() => setVisibleCount(prev => prev + 20)}>
                Muat lebih banyak...
              </Button>
            </div>
          )}
          {filteredStudents.length === 0 && (
            <div className="py-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">Tiada murid dijumpai.</p>
            </div>
          )}
        </div>

        {/* Desktop View (Table) */}
        <Card className="hidden lg:block overflow-hidden border-slate-200 shadow-sm">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-30">
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-40 min-w-[200px] max-w-[200px] border-b border-r border-slate-200 bg-slate-50 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nama Murid
                  </th>
                  {filteredStandards.map((s) => (
                    <th 
                      key={s.id} 
                      className="min-w-[120px] border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-600 group relative"
                      title={s.spDescription}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{s.spCode}</span>
                        <Info size={14} className="text-slate-400 cursor-help" />
                      </div>
                      {/* Custom Tooltip on Hover */}
                      <div className="absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-left text-[10px] font-normal normal-case leading-relaxed text-white shadow-2xl group-hover:block">
                        <p className="font-bold mb-1 text-emerald-400">{s.spCode}</p>
                        {s.spDescription}
                      </div>
                    </th>
                  ))}
                  <th className="min-w-[100px] border-b border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                    TP Akhir
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleStudents.map((student) => (
                  <StudentRow 
                    key={student.id}
                    student={student}
                    filteredStandards={filteredStandards}
                    records={records}
                    recordsLoading={recordsLoading}
                    userData={userData}
                    studentSummaries={studentSummaries}
                    classSubject={classSubject}
                    user={user}
                    handleTPChange={handleTPChange}
                    onOpenEvidence={(data: any) => {
                      setSelectedRecordForEvidence(data);
                      setIsEvidenceModalOpen(true);
                    }}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <CardFooter className="flex items-center justify-between bg-slate-50/50 border-t border-slate-100 py-3">
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span>Telah Dinilai</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-200 border border-slate-300"></div>
                <span>Belum Dinilai</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={14} />
              Auto-simpan Aktif
            </div>
          </CardFooter>
        </Card>
      </main>

      {classSubject && user && (
        <StudentImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => fetchData(user.uid)}
          classId={classSubject.classId}
          classInfo={{
            className: classData?.className || classSubject.className,
            teacherId: user.uid,
            sessionId: classSubject.sessionId
          }}
        />
      )}

      {selectedRecordForEvidence && (
        <EvidenceModal
          isOpen={isEvidenceModalOpen}
          onClose={() => setIsEvidenceModalOpen(false)}
          onSuccess={() => fetchData(user.uid)}
          recordData={selectedRecordForEvidence}
          isReadOnly={userData?.isReadOnly}
        />
      )}

      <StudentManagementModal
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
        }}
        onSave={handleStudentSave}
        mode={studentModalMode}
      />

      {/* Confirmation Modal for Tandakan Pindah */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <AlertCircle size={24} />
                <h3 className="text-lg font-bold text-slate-900">Tandakan murid sebagai berpindah?</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Murid ini akan disembunyikan daripada senarai murid aktif, tetapi rekod dan data pentaksiran tidak akan dipadam. Data masih disimpan dalam sistem.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    setStudentToToggle(null);
                  }}
                >
                  Batal
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none font-bold"
                  onClick={confirmToggleStatus}
                >
                  Ya, Tandakan Pindah
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tap-based TP Picker Component
const TPPicker = ({ value, onChange, disabled, loading }: { value: string, onChange: (val: string) => void, disabled?: boolean, loading?: boolean }) => {
  const options = ["TP1", "TP2", "TP3", "TP4", "TP5", "TP6"];
  
  return (
    <div className={cn(
      "flex flex-wrap gap-1 items-center justify-center max-w-[140px]",
      loading && "animate-pulse opacity-50 pointer-events-none"
    )}>
      {options.map((tp) => {
        const isActive = value === tp;
        return (
          <button
            key={tp}
            type="button"
            disabled={disabled}
            onClick={() => onChange(isActive ? "" : tp)}
            className={cn(
              "px-1.5 py-1 text-[10px] font-bold rounded-md transition-all border min-w-[32px]",
              isActive 
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" 
                : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tp}
          </button>
        );
      })}
    </div>
  );
};

// Memoized Student Card for Mobile View
const StudentCard = memo(({ 
  student, 
  filteredStandards, 
  records, 
  recordsLoading,
  userData, 
  studentSummaries, 
  classSubject, 
  user, 
  handleTPChange,
  onOpenEvidence,
  onToggleStatus
}: any) => {
  return (
    <Card className={`border-none shadow-sm bg-white overflow-hidden ${!student.isActive ? "opacity-60" : ""}`}>
      <CardHeader className="bg-slate-50/50 p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${student.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
              {student.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{student.fullName}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wider">ID: {student.studentId || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TP Akhir</p>
              <p className="text-lg font-black text-emerald-600 leading-none mt-1">
                {recordsLoading ? <span className="animate-pulse opacity-50">...</span> : studentSummaries[student.id]?.finalTp}
              </p>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 ${student.isActive ? "text-slate-400 hover:text-red-600" : "text-emerald-600"}`}
              onClick={() => onToggleStatus(student.id, student.isActive)}
            >
              {student.isActive ? <UserMinus size={16} /> : <UserCheck size={16} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => onToggleStatus(student.id, student.isActive)} 
                  className={`gap-2 ${student.isActive ? "text-red-600" : "text-emerald-600"}`}
                >
                  {student.isActive ? (
                    <>
                      <UserMinus size={14} />
                      Tandakan Pindah
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} />
                      Aktifkan Semula
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-50">
          {filteredStandards.map((s: any) => {
            const record = records[`${student.id}_${s.id}`];
            const hasEvidence = record?.evidenceUrl || (record?.evidenceUrls && record.evidenceUrls.length > 0);
            
            return (
              <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{s.spCode}</span>
                    <span className="text-[10px] font-bold text-slate-500 truncate">{s.spDescription}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TPPicker
                      value={record?.tp || ""}
                      onChange={(val) => handleTPChange(student.id, s.id, val)}
                      disabled={userData?.isReadOnly}
                      loading={recordsLoading}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-10 w-10 p-0 flex items-center justify-center rounded-xl border-2 transition-all ${
                    hasEvidence 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" 
                      : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                  }`}
                  onClick={() => onOpenEvidence({
                    studentId: student.id,
                    studentName: student.fullName,
                    standardId: s.id,
                    standardCode: s.spCode,
                    standardDescription: s.spDescription,
                    tp: record?.tp || "",
                    evidenceUrl: record?.evidenceUrl,
                    evidenceUrls: record?.evidenceUrls || [],
                    classSubjectId: classSubject.id,
                    teacherId: user.uid
                  })}
                >
                  {hasEvidence ? <Paperclip size={16} /> : <Camera size={16} />}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

StudentCard.displayName = "StudentCard";

// Memoized Student Row for Desktop View
const StudentRow = memo(({ 
  student, 
  filteredStandards, 
  records, 
  recordsLoading,
  userData, 
  studentSummaries, 
  classSubject, 
  user, 
  handleTPChange,
  onOpenEvidence,
  onToggleStatus
}: any) => {
  return (
    <tr className={`hover:bg-slate-50/50 transition-colors ${!student.isActive ? "opacity-60" : ""}`}>
      <td className="sticky left-0 z-20 border-r border-slate-200 bg-white px-6 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${student.isActive ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-400"}`}>
              {student.fullName.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{student.fullName}</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{student.studentId || "N/A"}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 ${student.isActive ? "text-slate-400 hover:text-red-600" : "text-emerald-600"}`}
              title={student.isActive ? "Tandakan Pindah" : "Aktifkan Semula"}
              onClick={() => onToggleStatus(student.id, student.isActive)}
            >
              {student.isActive ? <UserMinus size={16} /> : <UserCheck size={16} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => onToggleStatus(student.id, student.isActive)} 
                  className={`gap-2 ${student.isActive ? "text-red-600" : "text-emerald-600"}`}
                >
                  {student.isActive ? (
                    <>
                      <UserMinus size={14} />
                      Tandakan Pindah
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} />
                      Aktifkan Semula
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </td>
      {filteredStandards.map((s: any) => {
        const record = records[`${student.id}_${s.id}`];
        const hasEvidence = record?.evidenceUrl || (record?.evidenceUrls && record.evidenceUrls.length > 0);
        
        return (
          <td key={s.id} className="border-r border-slate-100 px-3 py-3 text-center">
            <div className="flex flex-col items-center gap-3">
              <TPPicker
                value={record?.tp || ""}
                onChange={(val) => handleTPChange(student.id, s.id, val)}
                disabled={userData?.isReadOnly}
                loading={recordsLoading}
              />
              <Button
                variant="outline"
                size="sm"
                className={`h-8 w-8 p-0 rounded-lg border transition-all ${
                  hasEvidence 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" 
                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                }`}
                onClick={() => onOpenEvidence({
                  studentId: student.id,
                  studentName: student.fullName,
                  standardId: s.id,
                  standardCode: s.spCode,
                  standardDescription: s.spDescription,
                  tp: record?.tp || "",
                  evidenceUrl: record?.evidenceUrl,
                  evidenceUrls: record?.evidenceUrls || [],
                  classSubjectId: classSubject.id,
                  teacherId: user.uid
                })}
              >
                {hasEvidence ? <Paperclip size={14} /> : <Camera size={14} />}
              </Button>
            </div>
          </td>
        );
      })}
      <td className="px-4 py-4 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white shadow-sm">
          {recordsLoading ? <span className="animate-pulse opacity-50">...</span> : studentSummaries[student.id]?.finalTp}
        </span>
      </td>
    </tr>
  );
});

StudentRow.displayName = "StudentRow";
