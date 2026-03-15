"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Search, 
  Download,
  FileText,
  Printer
} from "lucide-react";
import { onAuthStateChange } from "@/lib/auth-helpers";
import { 
  getStudentsByClass, 
  getLearningStandardsBySubject, 
  getProgressRecordsByClassSubject,
  getClassById,
  getUserData,
  db
} from "@/lib/firestore-helpers";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Navbar } from "@/components/ui/Navbar";
import { Input } from "@/components/ui/Input";

const TP_COLORS: Record<string, string> = {
  "TP1": "bg-red-500 text-white",
  "TP2": "bg-orange-500 text-white",
  "TP3": "bg-yellow-400 text-slate-900",
  "TP4": "bg-green-500 text-white",
  "TP5": "bg-blue-500 text-white",
  "TP6": "bg-purple-600 text-white",
  "-": "bg-slate-100 text-slate-400"
};

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const classSubjectId = params.classSubjectId as string;

  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [classSubject, setClassSubject] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

      setStudents(studentList.filter(s => s.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setStandards(lsList);
      setRecords(recordList);
      setClassData(classInfo);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  }, [classSubjectId, router]);

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

  const groupNames = useMemo(() => {
    return Array.from(new Set(standards.map(s => s.groupName))).sort();
  }, [standards]);

  const summaryData = useMemo(() => {
    return students.map(student => {
      const studentRecords = records.filter(r => r.studentId === student.id);
      
      const groupTps: Record<string, string> = {};
      let totalSum = 0;
      let totalCount = 0;

      groupNames.forEach(group => {
        const groupRecords = studentRecords.filter(r => r.groupName === group);
        const tpNumbers = groupRecords.map(r => tpToNumber(r.tp)).filter(n => n > 0);
        
        if (tpNumbers.length > 0) {
          const sum = tpNumbers.reduce((a, b) => a + b, 0);
          const avg = sum / tpNumbers.length;
          const finalTp = numberToTp(avg);
          groupTps[group] = finalTp;
          
          totalSum += avg;
          totalCount++;
        } else {
          groupTps[group] = "-";
        }
      });

      const overallAvg = totalCount > 0 ? totalSum / totalCount : 0;

      return {
        id: student.id,
        name: student.fullName,
        groupTps,
        overallTp: numberToTp(overallAvg)
      };
    });
  }, [students, records, groupNames]);

  const filteredData = useMemo(() => {
    return summaryData.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [summaryData, searchTerm]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Menjana ringkasan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} userData={userData} />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={18} className="mr-2" />
            Kembali
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:flex">
              <Printer size={16} className="mr-2" />
              Cetak
            </Button>
          </div>
        </div>

        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Ringkasan TP Murid</h1>
            <p className="text-sm sm:text-base text-slate-500">
              {classData?.className || classSubject?.className} &bull; {classSubject?.subjectId} &bull; Tahun {classSubject?.year} &bull; Sesi {classSubject?.sessionId}
            </p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Cari nama murid..."
              className="pl-10 h-11 sm:h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        <Card className="overflow-hidden border-slate-200 shadow-xl print:shadow-none print:border-none">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-100">
                  <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nama Murid
                  </th>
                  {groupNames.map((group) => (
                    <th 
                      key={group} 
                      className="border-b border-r border-slate-200 bg-slate-100 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      {group}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-slate-200 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                    Purata Keseluruhan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredData.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-900 student-name-cell">
                      {student.name}
                    </td>
                    {groupNames.map((group) => {
                      const tp = student.groupTps[group];
                      return (
                        <td key={group} className="border-r border-slate-100 p-2 text-center">
                          <span className={`inline-flex items-center justify-center h-8 w-14 rounded-lg text-[11px] font-black shadow-sm ${TP_COLORS[tp] || TP_COLORS["-"]}`}>
                            {tp}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center bg-slate-50/50">
                      <span className={`inline-flex items-center justify-center h-8 w-16 rounded-lg text-xs font-black shadow-md ${TP_COLORS[student.overallTp] || TP_COLORS["-"]}`}>
                        {student.overallTp}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={groupNames.length + 2} className="px-6 py-12 text-center text-slate-500">
                      Tiada data murid dijumpai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredData.map((student) => (
              <div key={student.id} className="p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-900">{student.name}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purata</span>
                    <span className={`inline-flex items-center justify-center h-7 w-14 rounded-lg text-[11px] font-black shadow-sm ${TP_COLORS[student.overallTp] || TP_COLORS["-"]}`}>
                      {student.overallTp}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {groupNames.map((group) => {
                    const tp = student.groupTps[group];
                    return (
                      <div key={group} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase truncate w-full text-center" title={group}>
                          {group}
                        </span>
                        <span className={`inline-flex items-center justify-center h-6 w-12 rounded-md text-[10px] font-black ${TP_COLORS[tp] || TP_COLORS["-"]}`}>
                          {tp}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                Tiada data murid dijumpai.
              </div>
            )}
          </div>
        </Card>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 no-print">
          <Card className="border-none shadow-sm bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-emerald-600" />
              Petunjuk Tahap Penguasaan
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TP_COLORS).filter(([tp]) => tp !== "-").map(([tp, color]) => (
                <div key={tp} className="flex items-center gap-2">
                  <div className={`h-4 w-8 rounded ${color}`}></div>
                  <span className="text-xs font-medium text-slate-600">{tp}</span>
                </div>
              ))}
            </div>
          </Card>
          
          <Card className="border-none shadow-sm bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Download size={18} className="text-emerald-600" />
              Nota Pengiraan
            </h3>
            <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
              <li>TP Akhir bagi setiap kemahiran dikira berdasarkan purata semua Standard Pembelajaran dalam kemahiran tersebut.</li>
              <li>Purata Keseluruhan adalah purata dari semua TP Akhir kemahiran yang telah dinilai.</li>
              <li>Pengiraan dibundarkan kepada integer terdekat.</li>
            </ul>
          </Card>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          main {
            padding: 0 !important;
            max-width: none !important;
          }
          table {
            font-size: 9px !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #e2e8f0 !important;
            padding: 4px !important;
          }
          .student-name-cell {
            width: 150px !important;
            min-width: 150px !important;
            max-width: 150px !important;
            font-size: 8px !important;
            line-height: 1.1 !important;
            padding: 4px 6px !important;
            white-space: normal !important;
            overflow: hidden !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            height: auto !important;
          }
          .sticky {
            position: static !important;
          }
          .shadow-sm, .shadow-md, .shadow-xl {
            shadow: none !important;
            box-shadow: none !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
