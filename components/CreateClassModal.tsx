"use client";

import React, { useState, useEffect } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { createClass, getSubjects, db } from "@/lib/firestore-helpers";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teacherId: string;
  sessionId: string;
}

const YEAR_OPTIONS = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

export const CreateClassModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  teacherId, 
  sessionId 
}: CreateClassModalProps) => {
  const [year, setYear] = useState("1");
  const [classLabel, setClassLabel] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await getSubjects();
        const activeSubjects = data.filter((s: any) => s.isActive);
        setSubjects(activeSubjects);
        if (activeSubjects.length > 0) {
          setSelectedSubject(activeSubjects[0].subjectCode);
        }
      } catch (err: any) {
        console.error("Error loading subjects:", err);
      }
    };
    if (isOpen) {
      loadSubjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classLabel.trim()) {
      setError("Sila masukkan nama kelas.");
      return;
    }
    if (!selectedSubject) {
      setError("Sila pilih subjek.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newClass = await createClass(teacherId, {
        classLabel: classLabel.trim(),
        year: parseInt(year),
        sessionId,
      });

      // Create classSubject document
      await addDoc(collection(db, "users", teacherId, "classSubjects"), {
        classId: newClass.id,
        className: newClass.className,
        subjectId: selectedSubject,
        year: parseInt(year),
        sessionId,
        isActive: true,
        studentCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess();
      onClose();
      // Reset form
      setYear("1");
      setClassLabel("");
      if (subjects.length > 0) {
        setSelectedSubject(subjects[0].subjectCode);
      }
    } catch (err: any) {
      setError(err.message || "Gagal menambah kelas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Tambah Kelas Baharu</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <Select
              label="Tahun / Tingkatan"
              options={YEAR_OPTIONS}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className="h-12 sm:h-10"
            />

            <Input
              label="Nama Kelas"
              placeholder="Contoh: Onsoi, Pintar, Amanah"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              required
              className="h-12 sm:h-10"
            />

            <Select
              label="Subjek"
              options={subjects.map((s: any) => ({ label: `${s.subjectCode} - ${s.subjectName}`, value: s.subjectCode }))}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              required
              className="h-12 sm:h-10"
            />
            
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Pratonton Nama Penuh</p>
              <p className="text-base sm:text-lg font-bold text-emerald-600">
                {selectedSubject.includes("-SM") ? "Tingkatan" : "Tahun"} {year} {classLabel || "..."}
              </p>
            </div>
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
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : null}
              Simpan Kelas
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
