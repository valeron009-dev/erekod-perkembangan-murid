"use client";

import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
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

export default function SummaryClient() {
  const params = useParams();
  const router = useRouter();
  const classSubjectId = params.classSubjectId as string;

  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [classSubject, setClassSubject] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  const fetchData = useCallback(async (uid: string) => {
    if (!uid || !classSubjectId) return;
    
    try {
      setLoading(true);
      
      // STAGE 1: Load essential class info and student list first
      const csDoc = await getDoc(doc(db, "users", uid, "classSubjects", classSubjectId));
      
      if (!csDoc.exists()) {
        console.error("ClassSubject document not found:", classSubjectId);
        setLoading(false);
        router.push("/dashboard");
        return;
      }
      
      const csData = csDoc.data();
      setClassSubject({ id: csDoc.id, ...csData });

      // Load remaining data in parallel
      const [studentList, lsList, classInfo] = await Promise.all([
        getStudentsByClass(uid, csData.classId),
        getLearningStandardsBySubject(csData.subjectId, csData.year),
        getClassById(uid, csData.classId)
      ]);

      setStudents(studentList.filter((s: any) => s.isActive).sort((a: any, b: any) => a.fullName.localeCompare(b.fullName)));
      setStandards(lsList);
      setClassData(classInfo);
      
      // Show names immediately
      setLoading(false);

      // STAGE 2: Load heavy progress records in the background
      setRecordsLoading(true);
      getProgressRecordsByClassSubject(uid, classSubjectId).then(recordList => {
        const recordsMap: Record<string, any[]> = {};
        recordList.forEach((r: any) => {
          const key = `${r.studentId}_${r.groupName}`;
          if (!recordsMap[key]) recordsMap[key] = [];
          recordsMap[key].push(r);
        });
        setRecords(recordsMap);
        setRecordsLoading(false);
      }).catch(err => {
        console.error("Error loading records", err);
        setRecordsLoading(false);
      });

    } catch (error) {
      console.error("Error fetching data", error);
      setLoading(false);
    }
  }, [classSubjectId, router]);

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
      const groupTps: Record<string, string> = {};
      let totalSum = 0;
      let totalCount = 0;

      groupNames.forEach(group => {
        const groupRecords = records[`${student.id}_${group}`] || [];
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

  const visibleData = useMemo(() => {
    return filteredData.slice(0, visibleCount);
  }, [filteredData, visibleCount]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setVisibleCount(prev => Math.min(prev + 20, filteredData.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filteredData.length]);

  if (!classSubject) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} userData={userData} />
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-4">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-48 animate-pulse rounded-lg bg-slate-200" />
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
      <div className="no-print">
        <Navbar user={user} userData={userData} />
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {/* Action Bar - Hidden on Print */}
        <div className="mb-6 no-print">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 rounded-lg px-3">
            <ArrowLeft size={16} className="mr-2" />
            Kembali
          </Button>
        </div>

        {/* Header - Title and Class Info (Visible on Print) */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Ringkasan TP Murid</h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium">
                {classData?.className || classSubject?.className} &bull; {classSubject?.subjectId} &bull; Tahun {classSubject?.year}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.print()} 
              className="no-print h-10 rounded-xl px-4 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 sm:mt-1"
            >
              <Printer size={18} className="mr-2" />
              Cetak
            </Button>
          </div>
          
          {/* Search Bar - Hidden on Print */}
          <div className="relative w-full lg:w-80 no-print">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Cari nama murid..."
              className="h-12 w-full rounded-2xl border-slate-200 bg-white pl-11 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        {/* Dedicated Print Layout (Hidden on Screen) */}
        <div className="print-only">
          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-300 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-700">Nama Murid</th>
                {groupNames.map(group => (
                  <th key={group} className="border border-slate-300 px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-700 w-[80px]">{group}</th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-700 w-[80px] bg-slate-100">TP Akhir</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(student => (
                <tr key={student.id}>
                  <td className="border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-900">{student.name}</td>
                  {groupNames.map(group => (
                    <td key={group} className="border border-slate-300 px-2 py-2 text-center text-[11px] font-bold whitespace-nowrap">
                      {recordsLoading ? "..." : student.groupTps[group]}
                    </td>
                  ))}
                  <td className="border border-slate-300 px-2 py-2 text-center text-[11px] font-bold bg-slate-50 whitespace-nowrap">
                    {recordsLoading ? "..." : student.overallTp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Screen Layout (Hidden on Print) */}
        <div className="no-print space-y-8">
          {/* Desktop View Table */}
          <Card className="hidden lg:block overflow-hidden border-slate-200 shadow-xl rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Nama Murid
                    </th>
                    {groupNames.map((group) => (
                      <th 
                        key={group} 
                        className="border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                      >
                        {group}
                      </th>
                    ))}
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                      TP Akhir
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleData.map((student) => (
                    <SummaryRow 
                      key={student.id} 
                      student={student} 
                      groupNames={groupNames} 
                      recordsLoading={recordsLoading}
                    />
                  ))}
                  {filteredData.length > visibleCount && (
                    <tr>
                      <td colSpan={groupNames.length + 2} className="px-6 py-4 text-center">
                        <Button variant="ghost" onClick={() => setVisibleCount(prev => prev + 20)}>
                          Muat lebih banyak...
                        </Button>
                      </td>
                    </tr>
                  )}
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
          </Card>

          {/* Mobile/Tablet View Cards */}
          <div className="lg:hidden space-y-4">
            {visibleData.map((student) => (
              <SummaryCard 
                key={student.id} 
                student={student} 
                groupNames={groupNames} 
                recordsLoading={recordsLoading}
              />
            ))}
            {filteredData.length > visibleCount && (
              <div className="py-4 text-center">
                <Button variant="ghost" onClick={() => setVisibleCount(prev => prev + 20)}>
                  Muat lebih banyak...
                </Button>
              </div>
            )}
            {filteredData.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-white">
                <p className="text-slate-500 font-medium">Tiada data murid dijumpai.</p>
              </div>
            )}
          </div>

          {/* Legend and Notes */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-none shadow-sm bg-white p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <FileText size={18} className="text-emerald-600" />
                </div>
                Petunjuk Tahap Penguasaan
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TP_COLORS).filter(([tp]) => tp !== "-").map(([tp, color]) => (
                  <div key={tp} className="flex items-center gap-2">
                    <div className={`h-4 w-8 rounded shadow-sm ${color}`}></div>
                    <span className="text-xs font-bold text-slate-600">{tp}</span>
                  </div>
                ))}
              </div>
            </Card>
            
            <Card className="border-none shadow-sm bg-white p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <Download size={18} className="text-emerald-600" />
                </div>
                Nota Pengiraan
              </h3>
              <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 font-medium">
                <li>TP Akhir bagi setiap kemahiran dikira berdasarkan purata semua Standard Pembelajaran dalam kemahiran tersebut.</li>
                <li>TP Akhir adalah purata dari semua TP Akhir kemahiran yang telah dinilai.</li>
                <li>Pengiraan dibundarkan kepada integer terdekat.</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .print-only {
          display: none;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          header {
            margin-bottom: 20px !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            font-size: 10pt !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          @page {
            margin: 1.5cm;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}

// Memoized Summary Row
const SummaryRow = memo(({ student, groupNames, recordsLoading }: any) => {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-900 student-name-cell">
        {student.name}
      </td>
      {groupNames.map((group: string) => {
        const tp = student.groupTps[group];
        return (
          <td key={group} className="border-r border-slate-100 p-2 text-center">
            <span className={`inline-flex items-center justify-center h-8 w-14 rounded-lg text-[11px] font-black shadow-sm ${recordsLoading ? "animate-pulse opacity-50 bg-slate-100 text-slate-400" : (TP_COLORS[tp] || TP_COLORS["-"])}`}>
              {recordsLoading ? "..." : tp}
            </span>
          </td>
        );
      })}
      <td className="p-2 text-center bg-slate-50/30">
        <span className={`inline-flex items-center justify-center h-8 w-16 rounded-lg text-xs font-black shadow-md ${recordsLoading ? "animate-pulse opacity-50 bg-slate-100 text-slate-400" : (TP_COLORS[student.overallTp] || TP_COLORS["-"])}`}>
          {recordsLoading ? "..." : student.overallTp}
        </span>
      </td>
    </tr>
  );
});

SummaryRow.displayName = "SummaryRow";

// Memoized Summary Card
const SummaryCard = memo(({ student, groupNames, recordsLoading }: any) => {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-md rounded-2xl bg-white">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-900 truncate pr-2">{student.name}</h3>
        <div className={`shrink-0 inline-flex items-center justify-center h-8 w-16 rounded-lg text-xs font-black shadow-md ${recordsLoading ? "animate-pulse opacity-50 bg-slate-100 text-slate-400" : (TP_COLORS[student.overallTp] || TP_COLORS["-"])}`}>
          {recordsLoading ? "..." : student.overallTp}
        </div>
      </div>
      <CardContent className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {groupNames.map((group: string) => {
            const tp = student.groupTps[group];
            return (
              <div key={group} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{group}</p>
                <div className={`inline-flex items-center justify-center h-8 w-full rounded-lg text-[11px] font-black shadow-sm ${recordsLoading ? "animate-pulse opacity-50 bg-slate-100 text-slate-400" : (TP_COLORS[tp] || TP_COLORS["-"])}`}>
                  {recordsLoading ? "..." : tp}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

SummaryCard.displayName = "SummaryCard";
