"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, ClipboardList, User, ShieldCheck, MessageCircle, AlertTriangle } from "lucide-react";
import { signOutUser } from "@/lib/auth-helpers";
import { Button } from "./Button";
import { InstallPWA } from "../InstallPWA";

export const Navbar = ({ user, userData }: { user: any; userData?: any }) => {
  const pathname = usePathname();
  const router = useRouter();

  const isExpired = userData?.trialEndsAt && userData.trialEndsAt.toDate() < new Date();
  const showBanner = isExpired || userData?.subscriptionStatus === "expired";

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  if (!user) return null;

  return (
    <>
      {showBanner && (
        <div className="sticky top-0 z-[60] w-full bg-red-600 text-white px-4 py-2.5 shadow-lg">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle size={18} className="shrink-0 animate-pulse" />
              <span>Trial anda telah tamat. Akaun kini dalam mod baca sahaja. Hubungi admin untuk langganan penuh.</span>
            </div>
            <a 
              href="https://wa.me/60168353984?text=Saya%20ingin%20melanggan%20eRekod%20Perkembangan%20Murid"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-black hover:bg-red-50 transition-colors shadow-sm shrink-0"
            >
              <MessageCircle size={14} />
              Hubungi Admin (WhatsApp)
            </a>
          </div>
        </div>
      )}
      <nav className={`${showBanner ? 'sticky top-[52px] sm:top-[44px]' : 'sticky top-0'} z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-slate-200">
                <Image 
                  src="https://iili.io/q1EYLYJ.jpg" 
                  alt="Logo" 
                  fill 
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-lg font-bold text-slate-900 hidden sm:inline-block">
                Rekod Perkembangan Murid
              </span>
              {showBanner && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 border border-red-200 text-[10px] font-black text-red-700 uppercase tracking-wider">
                  READ ONLY
                </div>
              )}
              {userData?.subscriptionStatus === "trial" && !showBanner && (
                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Trial
                </div>
              )}
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
              
              {userData?.role === "super_admin" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/admin")}
                  className="flex items-center gap-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-bold"
                >
                  <ShieldCheck size={18} />
                  Kembali ke Admin
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {userData?.role === "super_admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="md:hidden p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                title="Admin Panel"
              >
                <ShieldCheck size={20} />
              </button>
            )}
            <div className="hidden sm:block">
              <InstallPWA />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <User size={16} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-700 max-w-[120px] truncate">
                {user.displayName || user.email}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOutUser()}
              className="text-slate-500 hover:text-red-600"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline-block ml-2">Log Keluar</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
};
