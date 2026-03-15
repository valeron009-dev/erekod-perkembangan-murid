"use client";

import React, { useEffect, useState } from "react";
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Clock,
  History
} from "lucide-react";
import { getAcademicSessions, setActiveSession, db } from "@/lib/firestore-helpers";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAcademicSessions();
      setSessions(data.sort((a: any, b: any) => b.name.localeCompare(a.name)));
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setFormLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, "academicSessions"), {
        name: newName.trim(),
        isActive: false,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewName("");
      loadData();
    } catch (err: any) {
      setError(err.message || "Gagal menambah sesi.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleActivate = async (sessionId: string) => {
    if (!confirm("Adakah anda pasti mahu menukar sesi akademik aktif? Semua guru akan menggunakan sesi ini secara lalai.")) return;
    
    try {
      setLoading(true);
      await setActiveSession(sessionId);
      loadData();
    } catch (error) {
      console.error("Error activating session:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeSession = sessions.find(s => s.isActive);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sesi Akademik</h1>
          <p className="text-slate-500 mt-1">Urus sesi akademik sekolah dan tentukan sesi aktif semasa.</p>
        </div>
        <Button 
          variant="primary" 
          className="gap-2 h-11 px-6 shadow-lg shadow-emerald-900/10"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          Tambah Sesi
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-none shadow-sm bg-emerald-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Calendar size={120} />
          </div>
          <CardHeader className="pb-2">
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">Sesi Aktif Semasa</p>
            <h2 className="text-4xl font-black mt-2">{activeSession?.name || "Tiada"}</h2>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-emerald-100 text-sm">
              <Clock size={16} />
              <span>Sesi ini digunakan oleh semua guru untuk rekod PBD.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-50 flex flex-row items-center justify-between p-6">
            <div className="flex items-center gap-2">
              <History size={20} className="text-slate-400" />
              <h2 className="text-xl font-bold text-slate-900">Senarai Sesi</h2>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Nama Sesi</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                      </td>
                    </tr>
                  ) : sessions.length > 0 ? (
                    sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{session.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            session.isActive 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {session.isActive ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {session.isActive ? 'Aktif' : 'Arkib'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!session.isActive && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 px-3 text-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                              onClick={() => handleActivate(session.id)}
                            >
                              Aktifkan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                        Tiada sesi dijumpai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between p-6">
              <h2 className="text-xl font-bold text-slate-900">Tambah Sesi Baharu</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle size={24} />
              </button>
            </CardHeader>
            <form onSubmit={handleAddSession}>
              <CardContent className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}
                <Input
                  label="Nama Sesi"
                  placeholder="Contoh: 2024/2025"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </CardContent>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button type="submit" variant="primary" className="flex-1 gap-2" disabled={formLoading}>
                  {formLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Simpan Sesi
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
