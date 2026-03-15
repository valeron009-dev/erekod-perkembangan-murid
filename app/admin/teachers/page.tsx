"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  CreditCard,
  Ban,
  RefreshCw,
} from "lucide-react";
import { 
  getAllUsers, 
  addAllowedTeacher, 
  updateTeacherSubscription 
} from "@/lib/firestore-helpers";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function AdminTeachersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'expire' | 'reset';
    userId: string;
    userName: string;
  } | null>(null);
  
  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();
      // Filter for teachers and super admins
      const teachers = allUsers.filter(u => u.role === "teacher" || u.role === "super_admin");
      setUsers(teachers);
    } catch (error) {
      console.error("Error loading teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setFormLoading(true);
    setError(null);
    try {
      await addAllowedTeacher({
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        status: "active"
      });
      setIsAddModalOpen(false);
      setNewEmail("");
      loadData();
    } catch (err: any) {
      setError(err.message || "Gagal menambah guru.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubscriptionAction = async () => {
    if (!confirmAction) return;
    
    try {
      await updateTeacherSubscription(confirmAction.userId, confirmAction.type);
      setConfirmAction(null);
      loadData();
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };

  const filteredTeachers = useMemo(() => {
    return users.filter(t => {
      const matchesSearch = 
        (t.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (t.displayName?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        subscriptionFilter === "all" || 
        t.subscriptionStatus === subscriptionFilter;
        
      return matchesSearch && matchesFilter;
    });
  }, [users, searchTerm, subscriptionFilter]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pengurusan Guru</h1>
          <p className="text-slate-500 mt-1">Urus akaun guru dan status langganan mereka.</p>
        </div>
        <Button 
          variant="primary" 
          className="gap-2 shadow-lg shadow-emerald-900/10"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={18} />
          Tambah Guru
        </Button>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                placeholder="Cari nama atau email..."
                className="pl-10 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {[
                  { label: "Semua", value: "all" },
                  { label: "Trial", value: "trial" },
                  { label: "Aktif", value: "active" },
                  { label: "Tamat", value: "expired" }
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setSubscriptionFilter(tab.value)}
                    className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
                      subscriptionFilter === tab.value 
                        ? "bg-white text-emerald-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Nama & Email</th>
                  <th className="px-6 py-4">Peranan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Langganan</th>
                  <th className="px-6 py-4">Pelan</th>
                  <th className="px-6 py-4">Trial Tamat</th>
                  <th className="px-6 py-4">Read Only</th>
                  <th className="px-6 py-4">Log Terakhir</th>
                  <th className="px-6 py-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                      <p className="mt-2 text-sm text-slate-500">Memuatkan senarai guru...</p>
                    </td>
                  </tr>
                ) : filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200">
                            {(teacher.displayName?.[0] || teacher.email?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{teacher.displayName || "Cikgu"}</p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Mail size={12} />
                              {teacher.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          teacher.role === "super_admin" 
                            ? "bg-purple-100 text-purple-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {teacher.role === "super_admin" ? <Shield size={10} /> : <Users size={10} />}
                          {teacher.role === "super_admin" ? "SUPER ADMIN" : "GURU"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          teacher.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {teacher.status === 'active' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {teacher.status === 'active' ? 'AKTIF' : 'TIDAK AKTIF'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          teacher.subscriptionStatus === 'active' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : teacher.subscriptionStatus === 'trial'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <CreditCard size={10} />
                          {teacher.subscriptionStatus === 'active' ? 'AKTIF' : 
                           teacher.subscriptionStatus === 'trial' ? 'TRIAL' : 'TAMAT'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-600 uppercase">
                          {teacher.subscriptionPlan?.replace(/_/g, ' ') || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">
                          {formatDate(teacher.trialEndsAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          teacher.isReadOnly 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {teacher.isReadOnly ? <Ban size={10} /> : <CheckCircle2 size={10} />}
                          {teacher.isReadOnly ? 'READ ONLY' : 'BOLEH EDIT'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] text-slate-500">
                          {formatDate(teacher.lastLoginAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {teacher.subscriptionStatus !== 'active' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                              title="Aktifkan Langganan"
                              onClick={() => setConfirmAction({
                                type: 'activate',
                                userId: teacher.id,
                                userName: teacher.displayName || teacher.email
                              })}
                            >
                              <CheckCircle2 size={16} />
                            </Button>
                          )}
                          {teacher.subscriptionStatus !== 'expired' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                              title="Tamatkan Langganan"
                              onClick={() => setConfirmAction({
                                type: 'expire',
                                userId: teacher.id,
                                userName: teacher.displayName || teacher.email
                              })}
                            >
                              <Ban size={16} />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50"
                            title="Reset Trial"
                            onClick={() => setConfirmAction({
                              type: 'reset',
                              userId: teacher.id,
                              userName: teacher.displayName || teacher.email
                            })}
                          >
                            <RefreshCw size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      Tiada guru dijumpai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                <p className="mt-2 text-sm text-slate-500">Memuatkan senarai guru...</p>
              </div>
            ) : filteredTeachers.length > 0 ? (
              filteredTeachers.map((teacher) => (
                <div key={teacher.id} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200">
                        {(teacher.displayName?.[0] || teacher.email?.[0] || "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{teacher.displayName || "Cikgu"}</p>
                        <p className="text-[11px] text-slate-500">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {teacher.subscriptionStatus !== 'active' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-emerald-600"
                          onClick={() => setConfirmAction({
                            type: 'activate',
                            userId: teacher.id,
                            userName: teacher.displayName || teacher.email
                          })}
                        >
                          <CheckCircle2 size={16} />
                        </Button>
                      )}
                      {teacher.subscriptionStatus !== 'expired' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-600"
                          onClick={() => setConfirmAction({
                            type: 'expire',
                            userId: teacher.id,
                            userName: teacher.displayName || teacher.email
                          })}
                        >
                          <Ban size={16} />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-amber-600"
                        onClick={() => setConfirmAction({
                          type: 'reset',
                          userId: teacher.id,
                          userName: teacher.displayName || teacher.email
                        })}
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Peranan</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        teacher.role === "super_admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {teacher.role === "super_admin" ? "SUPER ADMIN" : "GURU"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Langganan</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        teacher.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                        teacher.subscriptionStatus === 'trial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {teacher.subscriptionStatus === 'active' ? 'AKTIF' : 
                         teacher.subscriptionStatus === 'trial' ? 'TRIAL' : 'TAMAT'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pelan</p>
                      <p className="text-xs font-medium text-slate-600 uppercase">
                        {teacher.subscriptionPlan?.replace(/_/g, ' ') || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Read Only</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        teacher.isReadOnly ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {teacher.isReadOnly ? 'YA' : 'TIDAK'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">
                Tiada guru dijumpai.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="p-6 pb-0">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Sahkan Tindakan</h2>
              <p className="text-sm text-slate-500 mt-2">
                Adakah anda pasti mahu {
                  confirmAction.type === 'activate' ? 'mengaktifkan langganan' :
                  confirmAction.type === 'expire' ? 'menamatkan langganan' :
                  'set semula trial'
                } untuk <strong>{confirmAction.userName}</strong>?
              </p>
            </CardHeader>
            <CardContent className="p-6 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setConfirmAction(null)}
              >
                Batal
              </Button>
              <Button 
                variant="primary" 
                className={`flex-1 ${
                  confirmAction.type === 'expire' ? 'bg-red-600 hover:bg-red-700' : 
                  confirmAction.type === 'reset' ? 'bg-amber-600 hover:bg-amber-700' : ''
                }`}
                onClick={handleSubscriptionAction}
              >
                Sahkan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between p-6">
              <h2 className="text-xl font-bold text-slate-900">Tambah Guru Baharu</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle size={24} />
              </button>
            </CardHeader>
            <form onSubmit={handleAddTeacher}>
              <CardContent className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}
                <Input
                  label="Alamat Email (Google)"
                  placeholder="contoh@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  type="email"
                />
                <Select
                  label="Peranan"
                  options={[
                    { label: "Guru", value: "teacher" },
                    { label: "Super Admin", value: "super_admin" }
                  ]}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
              </CardContent>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 gap-2"
                  disabled={formLoading}
                >
                  {formLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Daftar Guru
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
