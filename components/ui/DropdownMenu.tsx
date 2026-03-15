"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const DropdownMenuContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
} | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div ref={triggerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const { isOpen, setIsOpen } = context;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  const context = React.useContext(DropdownMenuContext);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  const { isOpen, setIsOpen, triggerRef } = context;

  React.useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: align === "end" ? rect.right + window.scrollX : rect.left + window.scrollX,
      });
    }
  }, [isOpen, triggerRef, align]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className={cn(
        "fixed z-[9999] mt-2 min-w-[12rem] w-max max-w-[16rem] rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden border border-slate-100",
        align === "end" ? "-translate-x-full origin-top-right" : "origin-top-left"
      )}
      style={{ top: coords.top, left: coords.left }}
      onClick={() => setIsOpen(false)}
    >
      <div className="py-1">{children}</div>
    </div>,
    document.body
  );
}

export function DropdownMenuItem({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuItem must be used within DropdownMenu");
  const { setIsOpen } = context;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(false);
        onClick?.();
      }}
      className={cn(
        "flex w-full items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap gap-3",
        className
      )}
    >
      {children}
    </button>
  );
}
