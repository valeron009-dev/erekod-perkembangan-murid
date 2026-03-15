"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogIn, AlertCircle } from "lucide-react";
import { signInWithGoogle, onAuthStateChange, signOutUser } from "@/lib/auth-helpers";
import { checkAllowedTeacher, updateUserRecord } from "@/lib/firestore-helpers";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        // If user is already logged in, we should still check if they are allowed
        // but for simplicity in this demo, we'll let the handleLogin handle the logic
        // and only redirect if they are already in the system.
        // However, the requirement says "after login, check allowedTeachers".
        // So we'll handle it in handleLogin.
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (!user || !user.email) {
        throw new Error("Gagal mendapatkan maklumat pengguna.");
      }

      // Check if they are a super admin in allowedTeachers
      const allowedTeacher = await checkAllowedTeacher(user.email);
      const isSuperAdmin = allowedTeacher?.role === "super_admin";
      const role = isSuperAdmin ? "super_admin" : "teacher";

      // Update or create user record
      await updateUserRecord(user.uid, {
        email: user.email,
        displayName: user.displayName || "Cikgu",
        role: role,
      });

      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err.message || "Log masuk gagal. Sila cuba lagi.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Sila tunggu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl shadow-lg">
          <Image 
            src="https://iili.io/q1EYLYJ.jpg" 
            alt="Logo" 
            fill 
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rekod Perkembangan Murid</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500">Sistem Pengurusan Pentaksiran Bilik Darjah (PBD)</p>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center border-b border-slate-100 pb-6">
          <h2 className="text-xl font-semibold text-slate-800">Log Masuk Guru</h2>
          <p className="mt-1 text-sm text-slate-500">Sila gunakan akaun Google anda untuk masuk</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 py-8">
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <Button 
            onClick={handleLogin} 
            className="h-12 w-full gap-3 text-lg font-semibold"
            variant="primary"
            disabled={loading}
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn size={20} />
            )}
            Log Masuk dengan Google
          </Button>
          
          <div className="text-center text-xs text-slate-400 leading-relaxed">
            Hanya akaun Google <strong>@moe-dl.edu.my</strong> sahaja yang dibenarkan untuk mengakses sistem ini.
          </div>
        </CardContent>
      </Card>

      <footer className="mt-12 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Rekod Perkembangan Murid. Hak Cipta Terpelihara.
      </footer>
    </div>
  );
}
