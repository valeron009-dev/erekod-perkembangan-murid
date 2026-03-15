"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ListChecks, 
  Calendar, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  Menu,
  X
} from "lucide-react";
import { onAuthStateChange, signOutUser } from "@/lib/auth-helpers";
import { getUserData } from "@/lib/firestore-helpers";
import { InstallPWA } from "@/components/InstallPWA";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        const data = await getUserData(firebaseUser.uid);
        if (data?.role !== "super_admin") {
          router.push("/dashboard");
          return;
        }
        setUser({ ...firebaseUser, ...data });
        setLoading(false);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Guru", href: "/admin/teachers", icon: Users },
    { name: "Subjek", href: "/admin/subjects", icon: BookOpen },
    { name: "Standard Pembelajaran", href: "/admin/standards", icon: ListChecks },
    { name: "Sesi Akademik", href: "/admin/sessions", icon: Calendar },
  ];

  const handleNavClick = (href: string) => {
    setIsSidebarOpen(false);
    router.push(href);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-[55] shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg">
            <Image 
              src="https://iili.io/q1EYLYJ.jpg" 
              alt="Logo" 
              fill 
              className="object-cover"
            />
          </div>
          <span className="font-bold">eRekod Admin</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 shadow-2xl z-[70] transition-transform duration-300 transform lg:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl shadow-lg">
              <Image 
                src="https://iili.io/q1EYLYJ.jpg" 
                alt="Logo" 
                fill 
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">eRekod</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Panel Kawalan</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 mt-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" 
                      : "hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={20} className={`shrink-0 ${isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-400"}`} />
                    <span className="font-medium truncate whitespace-nowrap">{item.name}</span>
                  </div>
                  {isActive && <ChevronRight size={16} className="shrink-0" />}
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-800">
              <button
                onClick={() => handleNavClick("/dashboard")}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group hover:bg-emerald-600/10 text-emerald-400 hover:text-emerald-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList size={20} className="shrink-0" />
                  <span className="font-medium truncate">Masuk ke Mod Guru</span>
                </div>
                <ChevronRight size={16} className="shrink-0" />
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="mb-4 px-4">
              <InstallPWA />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0">
                {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user?.displayName || "Admin"}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOutUser()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="font-medium">Log Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 sm:p-8 pt-20 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
