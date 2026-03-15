"use client";

import React, { useState, useRef } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileText, Info } from "lucide-react";
import { Button } from "./ui/Button";
import { syncStudents } from "@/lib/firestore-helpers";

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classId: string;
  classInfo: { className: string; teacherId: string; sessionId: string };
}

export const StudentImportModal = ({
  isOpen,
  onClose,
  onSuccess,
  classId,
  classInfo
}: StudentImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Sila pilih fail CSV sahaja.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((line: string) => line.trim());
      
      if (lines.length < 2) {
        setError("Fail CSV kosong atau tidak mempunyai data.");
        return;
      }

      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
      const nameIndex = headers.indexOf("studentname");

      if (nameIndex === -1) {
        setError("Lajur 'studentName' tidak dijumpai dalam fail CSV.");
        return;
      }

      const names = lines.slice(1).map((line: string) => {
        const cols = line.split(",");
        return cols[nameIndex]?.trim();
      }).filter(Boolean);

      setPreviewNames(names);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (previewNames.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const result = await syncStudents(classInfo.teacherId, classId, classInfo, previewNames);
      setSummary(result);
      onSuccess();
    } catch (err: any) {
      setError("Gagal mengimport data murid. Sila cuba lagi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewNames([]);
    setError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Import Murid (CSV)</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!summary ? (
            <>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-bold mb-1">Format CSV:</p>
                  <p>Fail CSV anda mesti mempunyai satu lajur bertajuk <code className="bg-blue-100 px-1 rounded">studentName</code>.</p>
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                  file ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50"
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".csv"
                />
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                  file ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                }`}>
                  {file ? <FileText size={32} /> : <Upload size={32} />}
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900">
                    {file ? file.name : "Klik untuk pilih fail CSV"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {previewNames.length > 0 ? `${previewNames.length} nama murid dijumpai` : "Muat naik senarai murid anda"}
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={onClose}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 gap-2"
                  disabled={loading || previewNames.length === 0}
                  onClick={handleImport}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  Mula Import
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Import Berjaya!</h3>
                <p className="text-slate-500">Data murid telah dikemaskini dalam sistem.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumlah Dibaca</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.totalRead}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Murid Baharu</p>
                  <p className="text-2xl font-bold text-emerald-700">{summary.newCount}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Dikekalkan</p>
                  <p className="text-2xl font-bold text-blue-700">{summary.maintainedCount}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Dinyahaktifkan</p>
                  <p className="text-2xl font-bold text-orange-700">{summary.deactivatedCount}</p>
                </div>
              </div>

              <Button 
                variant="primary" 
                className="w-full"
                onClick={onClose}
              >
                Tutup
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
