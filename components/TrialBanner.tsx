"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChange } from "@/lib/auth-helpers";
import { getUserData } from "@/lib/firestore-helpers";
import { MessageCircle, AlertTriangle } from "lucide-react";

export function TrialBanner() {
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          if (userData) {
            const now = new Date();
            const trialEndsAt = userData.trialEndsAt?.toDate();
            const isTrialExpired = trialEndsAt && now > trialEndsAt;
            const isPaidExpired = userData.subscriptionStatus === "expired";
            
            setIsExpired(!!(isTrialExpired || isPaidExpired || userData.isReadOnly));
          }
        } catch (error) {
          console.error("Error checking trial status:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setIsExpired(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading || !isExpired) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white shadow-2xl border-b border-red-700">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} className="shrink-0 animate-pulse" />
          <p className="font-bold text-sm sm:text-base tracking-tight">
            Trial anda telah tamat. Hubungi admin untuk langganan penuh.
          </p>
        </div>
        <a
          href="https://wa.me/60168353984?text=Saya%20ingin%20melanggan%20eRekod%20Perkembangan%20Murid"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white text-red-600 px-5 py-2 rounded-full font-black text-xs uppercase tracking-wider hover:bg-red-50 transition-all hover:scale-105 active:scale-95 shadow-lg shrink-0"
        >
          <MessageCircle size={18} />
          Hubungi Admin (WhatsApp)
        </a>
      </div>
    </div>
  );
}
