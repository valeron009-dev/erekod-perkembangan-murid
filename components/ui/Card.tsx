import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("px-6 py-4 border-bottom border-slate-100", className)}>
    {children}
  </div>
);

export const CardContent = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("px-6 py-4", className)}>
    {children}
  </div>
);

export const CardFooter = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("px-6 py-4 bg-slate-50 border-top border-slate-100", className)}>
    {children}
  </div>
);
