"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  FileText
} from "lucide-react";
import { onAuthStateChange } from "@/lib/auth-helpers";
import { 
  getStudentsByClass, 
  getLearningStandardsBySubject, 
  getProgressRecordsByClassSubject,
  updateProgressRecord,
  getClassById,
  getUserData,
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

const TP_OPTIONS = [
  { label: "-", value: "" },
  { label: "TP1", value: "TP1" },
  { label: "TP2", value: "TP2" },
  { label: "TP3", value: "TP3" },
  { label: "TP4", value: "TP4" },
  { label: "TP5", value: "TP5" },
  { label: "TP6", value: "TP6" },
];

export default function ProgressPage() {
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedRecordForEvidence, setSelectedRecordForEvidence] = useState<any>(null);

  const isExpired = userData?.trialEndsAt && userData.trialEndsAt.toDate() < new Date();
  const isReadOnly = isExpired || userData?.subscriptionStatus === "expired" || userData?.isReadOnly;

  const fetchData = useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const csDoc = await getDoc(doc(db, "users", uid, "classSubjects", classSubjectId));
      if (!csDoc.exists()) {
        router.push("/dashboard");
        return;
      }
      const csData = csDoc.data();
      setClassSubject({ id: csDoc.id, ...csData });

      const [studentList, lsList, recordList, classInfo] = await Promise.all([
        getStudentsByClass(uid, csData.classId),
        getLearningStandardsBySubject(csData.subjectId, csData.year),
        getProgressRecordsByClassSubject(uid, classSubjectId),
        getClassById(uid, csData.classId)
      ]);

      setStudents(studentList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setStandards(lsList);
      setClassData(classInfo);

      const recordMap: Record<string, any> = {};
      recordList.forEach((r: any) => {
        recordMap[`${r.studentId}_${r.learningStandardId}`] = r;
      });
      setRecords(recordMap);

      if (lsList.length > 0 && !selectedGroupName) {
        setSelectedGroupName(lsList[0].groupName);
      }
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  }, [classSubjectId, router, selectedGroupName]);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const data = await getUserData(firebaseUser.uid);
        setUserData(data);
        await fetchData(firebaseUser.uid);
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
    return students.filter((s) => 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const handleTPChange = async (studentId: string, standardId: string, tp: string) => {
    if (isReadOnly) return;
    
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Memuatkan rekod...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} userData={userData} />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={18} className="mr-2" />
            Kembali
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => router.push(`/progress/${classSubjectId}/summary`)}
            >
              <FileText size={16} />
              Lihat Ringkasan TP
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 relative group"
              onClick={() => setIsImportModalOpen(true)}
              disabled={isReadOnly}
            >
              <Upload size={16} />
              Import Murid
              {isReadOnly && (
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50">
                  Tidak tersedia. Trial anda telah tamat.
                </div>
              )}
            </Button>
          </div>
        </div>

        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {classData?.className || classSubject?.className} &bull; {classSubject?.subjectId}
            </h1>
            <p className="text-sm sm:text-base text-slate-500">
              Tahun {classSubject?.year} &bull; Sesi {classSubject?.sessionId}
            </p>
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
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-1" title={selectedGroupName}>
                {selectedGroupName}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bilangan Standard</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{classSummary.totalStandards}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Murid Dinilai</p>
              <p className="text-lg sm:text-xl font-black text-emerald-600 mt-1">
                {classSummary.studentsAssessed} <span className="text-[10px] sm:text-xs font-bold text-slate-400">/ {students.length}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
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
                {filteredStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className={`transition-colors ${!student.isActive ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50/50"}`}
                  >
                    <td className={`sticky left-0 z-30 border-r border-slate-100 px-6 py-4 font-medium transition-colors ${!student.isActive ? "bg-slate-50" : "bg-white"}`}>
                      <div className="flex flex-col gap-1 w-[150px]" title={student.fullName}>
                        <span className="text-sm truncate line-clamp-2">{student.fullName}</span>
                        {!student.isActive && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Tidak Aktif</span>
                        )}
                      </div>
                    </td>
                    {filteredStandards.map((s) => {
                      const record = records[`${student.id}_${s.id}`];
                      const tpValue = record?.tp || "";
                      const isDisabled = !student.isActive || isReadOnly;
                      const recordId = record?.id || `${classSubject.id}_${student.id}_${s.id}`;

                      return (
                        <td key={s.id} className="border-r border-slate-100 p-2 text-center">
                          <div className="flex items-center justify-center gap-1 relative group">
                            <Select
                              options={TP_OPTIONS}
                              value={tpValue}
                              disabled={isDisabled}
                              onChange={(e) => handleTPChange(student.id, s.id, e.target.value)}
                              className={`h-9 w-20 text-center text-xs font-bold transition-all ${
                                tpValue ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"
                              } ${isDisabled ? "opacity-50 cursor-not-allowed grayscale" : "hover:border-emerald-400"}`}
                            />
                            {isDisabled && isReadOnly && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-40 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50">
                                Tidak tersedia. Trial anda telah tamat.
                              </div>
                            )}
                            {tpValue && (
                              <button
                                onClick={() => {
                                  setSelectedRecordForEvidence({
                                    uid: user.uid,
                                    recordId,
                                    studentId: student.id,
                                    studentName: student.fullName,
                                    classId: classSubject.classId,
                                    classSubjectId: classSubject.id,
                                    spCode: s.spCode,
                                    tpGiven: tpValue
                                  });
                                  setIsEvidenceModalOpen(true);
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200`}
                                title="Evidens"
                              >
                                <Paperclip size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center bg-white">
                      <span className={`inline-flex items-center justify-center h-8 w-16 rounded-full text-xs font-black ring-1 ring-inset ${
                        studentSummaries[student.id]?.average > 0 
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200" 
                          : "bg-slate-50 text-slate-400 ring-slate-200"
                      }`}>
                        {studentSummaries[student.id]?.finalTp || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredStudents.map((student) => (
              <div key={student.id} className={`p-4 ${!student.isActive ? "bg-slate-50 opacity-75" : "bg-white"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900">{student.fullName}</span>
                    {!student.isActive && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tidak Aktif</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TP Akhir</span>
                    <span className={`inline-flex items-center justify-center h-7 w-14 rounded-full text-xs font-black ring-1 ring-inset ${
                      studentSummaries[student.id]?.average > 0 
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200" 
                        : "bg-slate-50 text-slate-400 ring-slate-200"
                    }`}>
                      {studentSummaries[student.id]?.finalTp || "-"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {filteredStandards.map((s) => {
                    const record = records[`${student.id}_${s.id}`];
                    const tpValue = record?.tp || "";
                    const isDisabled = !student.isActive || isReadOnly;
                    const recordId = record?.id || `${classSubject.id}_${student.id}_${s.id}`;

                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 relative group">
                        <div className="flex flex-col gap-0.5 max-w-[60%]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700">{s.spCode}</span>
                            <button 
                              onClick={() => alert(s.spDescription)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <Info size={14} />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{s.spDescription}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            options={TP_OPTIONS}
                            value={tpValue}
                            disabled={isDisabled}
                            onChange={(e) => handleTPChange(student.id, s.id, e.target.value)}
                            className={`h-10 w-20 text-center text-xs font-bold transition-all ${
                              tpValue ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"
                            }`}
                          />
                          {isDisabled && isReadOnly && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-40 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50">
                              Tidak tersedia. Trial anda telah tamat.
                            </div>
                          )}
                          {tpValue && (
                            <button
                              onClick={() => {
                                setSelectedRecordForEvidence({
                                  uid: user.uid,
                                  recordId,
                                  studentId: student.id,
                                  studentName: student.fullName,
                                  classId: classSubject.classId,
                                  classSubjectId: classSubject.id,
                                  spCode: s.spCode,
                                  tpGiven: tpValue
                                });
                                setIsEvidenceModalOpen(true);
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-sm active:scale-95 transition-all"
                            >
                              <Paperclip size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                Tiada murid dijumpai.
              </div>
            )}
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
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
