"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChange } from "@/lib/auth-helpers";
import { getUserData } from "@/lib/firestore-helpers";

export function TrialLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isExpired, setIsExpired] = useState(false);

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
        }
      } else {
        setIsExpired(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className={isExpired ? "pt-[110px] sm:pt-[64px]" : ""}>
      {children}
    </div>
  );
}
