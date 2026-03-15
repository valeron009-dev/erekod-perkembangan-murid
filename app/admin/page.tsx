"use client";

import React, { useEffect, useState } from "react";
import { 
  Users, 
  BookOpen, 
  ListChecks, 
  Calendar, 
  ArrowUpRight,
  TrendingUp,
  Activity
} from "lucide-react";
import { getAdminStats } from "@/lib/firestore-helpers";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { 
      label: "Guru Aktif", 
      value: stats?.activeTeachers || 0, 
      icon: Users, 
      color: "bg-blue-500", 
      trend: "+2 minggu ini",
      bgColor: "bg-blue-50"
    },
    { 
      label: "Subjek Aktif", 
      value: stats?.activeSubjects || 0, 
      icon: BookOpen, 
      color: "bg-emerald-500", 
      trend: "Sedia digunakan",
      bgColor: "bg-emerald-50"
    },
    { 
      label: "Standard Pembelajaran", 
      value: stats?.totalStandards || 0, 
      icon: ListChecks, 
      color: "bg-purple-500", 
      trend: "Data induk",
      bgColor: "bg-purple-50"
    },
    { 
      label: "Sesi Akademik", 
      value: stats?.currentSession || "-", 
      icon: Calendar, 
      color: "bg-orange-500", 
      trend: "Sesi aktif",
      bgColor: "bg-orange-50"
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Ringkasan Sistem</h1>
        <p className="text-slate-500 mt-1">Selamat datang ke panel kawalan Super Admin.</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className={`p-3 rounded-2xl ${stat.bgColor} ${stat.color.replace('bg-', 'text-')} transition-transform duration-300 group-hover:scale-110`}>
                <stat.icon size={24} />
              </div>
              <ArrowUpRight size={20} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Activity size={12} />
                {stat.trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="border-b border-slate-50 flex flex-row items-center justify-between py-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Aktiviti Terkini</h2>
              <p className="text-sm text-slate-500">Log masuk dan perubahan data sistem</p>
            </div>
            <TrendingUp size={20} className="text-emerald-500" />
          </CardHeader>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Activity size={32} />
            </div>
            <p className="font-medium">Tiada aktiviti dikesan buat masa ini.</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader className="py-6">
            <h2 className="text-xl font-bold">Status Sistem</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Penggunaan Firestore</span>
                <span className="text-emerald-400 font-bold">Normal</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-[15%] bg-emerald-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Kapasiti Storan</span>
                <span className="text-emerald-400 font-bold">Normal</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-[5%] bg-emerald-500 rounded-full" />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 leading-relaxed">
                Sistem beroperasi dengan lancar. Semua perkhidmatan Firebase berada dalam status aktif.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
