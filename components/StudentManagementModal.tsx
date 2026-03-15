"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface StudentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fullName: string) => Promise<void>;
  initialName?: string;
  mode: "add" | "edit";
}

export default function StudentManagementModal({
  isOpen,
  onClose,
  onSave,
  initialName = "",
  mode
}: StudentManagementModalProps) {
  const [fullName, setFullName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(initialName);
      setError(null);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Sila masukkan nama murid.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(fullName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan maklumat murid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === "add" ? "Tambah Murid Baharu" : "Kemaskini Nama Murid"}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Nama Penuh Murid"
              placeholder="Contoh: Ahmad bin Ali"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              className="h-12 sm:h-10"
            />
            <p className="text-xs text-slate-500 italic">
              * Nama ini akan digunakan dalam semua rekod PBD dan laporan.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 sm:h-10"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              className="flex-1 h-12 sm:h-10 gap-2 font-bold"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {mode === "add" ? "Tambah Murid" : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
