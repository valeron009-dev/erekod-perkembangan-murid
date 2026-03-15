"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ClipboardList, 
  Users, 
  BookOpen, 
  ChevronRight, 
  Search, 
  Plus, 
  Filter,
  LayoutDashboard,
  LogOut,
  User,
  AlertCircle,
  Archive,
  CheckCircle2,
  MoreVertical,
  RotateCcw,
  FileText,
  Calendar,
  Sparkles
} from "lucide-react";
import { onAuthStateChange, signOutUser } from "@/lib/auth-helpers";
import { getClassSubjectsByTeacher, getUserData, getClassById, db } from "@/lib/firestore-helpers";
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/Card";
import { Navbar } from "@/components/ui/Navbar";
import { Input } from "@/components/ui/Input";
import { CreateClassModal } from "@/components/CreateClassModal";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");

  const isExpired = userData?.trialEndsAt && userData.trialEndsAt.toDate() < new Date();
  const isReadOnly = isExpired || userData?.subscriptionStatus === "expired" || userData?.isReadOnly;
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalRecords: 0,
    totalEvidences: 0
  });

  const loadDashboardData = async (uid: string, sessionId: string) => {
    try {
      // Fetch subjects and userData in parallel
      const subjects = await getClassSubjectsByTeacher(uid, sessionId);
      setClassSubjects(subjects);

      // Prefetch the first few classes to make transitions feel instant
      subjects.slice(0, 5).forEach(cs => {
        router.prefetch(`/progress/${cs.id}`);
      });

      // Calculate stats
      const totalClasses = subjects.length;
      const totalStudents = subjects.reduce((acc, cs) => acc + (cs.studentCount || 0), 0);
      
      // OPTIMIZATION: Instead of fetching all records, we could use a counter or just show '-' 
      // if it's too slow, but for now let's keep it but make it parallel
      const recordsSnapPromise = getDocs(query(collection(db, "users", uid, "progressRecords"), limit(1)));
      
      setStats(prev => ({
        ...prev,
        totalClasses,
        totalStudents,
      }));

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const toggleStatus = async (csId: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      const csRef = doc(db, "users", user.uid, "classSubjects", csId);
      await updateDoc(csRef, {
        isActive: !currentStatus,
        updatedAt: serverTimestamp()
      });
      // Refresh local state
      setClassSubjects(prev => prev.map(cs => 
        cs.id === csId ? { ...cs, isActive: !currentStatus } : cs
      ));
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const data = await getUserData(firebaseUser.uid);
          setUserData(data);
          
          const sessionId = data?.currentSessionId ?? "2026";
          await loadDashboardData(firebaseUser.uid, sessionId);
        } catch (error) {
          console.error("Error loading user data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const filteredSubjects = classSubjects.filter((cs) => {
    const matchesSearch = cs.className?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         cs.subjectId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "active" ? (cs.isActive !== false) : (cs.isActive === false);
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Sedang memuatkan sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-50 via-slate-50 to-emerald-50/30">
      <Navbar user={user} userData={userData} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Jumlah Kelas", value: stats.totalClasses, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Jumlah Murid", value: stats.totalStudents, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Rekod PBD", value: stats.totalRecords, icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Sesi Aktif", value: userData?.currentSessionId || "-", icon: Calendar, color: "text-orange-600", bg: "bg-orange-50" },
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm bg-white/60 backdrop-blur-sm hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-widest">
              <Sparkles size={16} />
              <span>Selamat Datang</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Dashboard Guru</h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">Urus kelas dan pantau perkembangan murid anda dengan mudah.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <Input
                placeholder="Cari kelas atau subjek..."
                className="pl-12 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm sm:text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              variant="primary" 
              className="h-12 px-6 rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all gap-2 font-bold w-full sm:w-auto relative group"
              onClick={() => setIsModalOpen(true)}
              disabled={isReadOnly}
            >
              <Plus size={20} />
              Tambah Kelas
              {isReadOnly && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50">
                  Tidak tersedia. Trial anda telah tamat.
                </div>
              )}
            </Button>
          </div>
        </header>

        <div className="space-y-6">
          {/* Main Content - Classes */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-1 p-1 bg-slate-200/50 rounded-2xl w-full sm:w-fit backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("active")}
                  className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    activeTab === "active" 
                      ? "bg-white text-emerald-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Aktif
                </button>
                <button
                  onClick={() => setActiveTab("archive")}
                  className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    activeTab === "archive" 
                      ? "bg-white text-emerald-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Arkib
                </button>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400">
                {filteredSubjects.length} Kelas Dijumpai
              </p>
            </div>

            <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects.length > 0 ? (
                filteredSubjects.map((cs) => (
                  <Link 
                    href={`/progress/${cs.id}`}
                    key={cs.id} 
                    className={`group cursor-pointer border-none shadow-sm bg-white/80 backdrop-blur-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] relative overflow-hidden block rounded-3xl border border-transparent ${
                      cs.isActive === false ? "opacity-75 grayscale-[0.5]" : ""
                    }`}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                        <BookOpen size={28} />
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            Tahun {cs.year}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isReadOnly) return;
                              toggleStatus(cs.id, cs.isActive !== false);
                            }}
                            disabled={isReadOnly}
                            className={`p-2 rounded-xl transition-all relative group ${
                              cs.isActive === false 
                                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" 
                                : "bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
                            } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                            title={isReadOnly ? "Tidak tersedia. Trial anda telah tamat." : (cs.isActive === false ? "Aktifkan Semula" : "Nyahaktifkan")}
                          >
                            {cs.isActive === false ? <RotateCcw size={16} /> : <Archive size={16} />}
                            {isReadOnly && (
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-40 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50">
                                Tidak tersedia. Trial anda telah tamat.
                              </div>
                            )}
                          </button>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mt-1 group-hover:text-emerald-700 transition-colors">{cs.className}</h3>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 pb-6">
                      <div className="space-y-5">
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subjek</p>
                          <p className="text-lg font-black text-slate-800">{cs.subjectId}</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-500 font-bold">
                            <div className="flex -space-x-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold">
                                  {i}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs ml-1">{cs.studentCount || 0} Murid Terdaftar</span>
                          </div>
                          <div className="flex items-center gap-1 text-emerald-600 font-black text-sm group-hover:translate-x-1 transition-transform">
                            Buka <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white/40 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    {activeTab === "active" ? <ClipboardList size={48} /> : <Archive size={48} />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {activeTab === "active" ? "Tiada Kelas Aktif" : "Arkib Kosong"}
                  </h3>
                  <p className="mt-2 text-slate-500 max-w-xs mx-auto font-medium">
                    {activeTab === "active" 
                      ? "Anda belum mempunyai kelas yang aktif untuk sesi ini." 
                      : "Tiada kelas yang telah diarkibkan."}
                  </p>
                  {activeTab === "active" && (
                    <Button 
                      variant="outline" 
                      className="mt-8 rounded-2xl px-8 font-bold"
                      onClick={() => window.location.reload()}
                    >
                      Segarkan Halaman
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {user && userData && (
        <CreateClassModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => loadDashboardData(user.uid, userData?.currentSessionId ?? "2026")}
          teacherId={user.uid}
          sessionId={userData?.currentSessionId ?? "2026"}
        />
      )}
    </div>
  );
}
