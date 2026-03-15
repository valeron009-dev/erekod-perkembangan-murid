"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Upload, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { addEvidenceToRecord, getEvidencesForRecord, deleteEvidence } from "@/lib/firestore-helpers";
import { compressImage } from "@/lib/image-utils";

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isReadOnly?: boolean;
    recordData: {
    uid: string;
    recordId: string;
    studentId: string;
    studentName: string;
    classId: string;
    classSubjectId: string;
    spCode: string;
    tpGiven: string;
  };
}

export function EvidenceModal({ isOpen, onClose, onSuccess, recordData, isReadOnly }: EvidenceModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [evidences, setEvidences] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEvidences = useCallback(async () => {
    if (!recordData.recordId) return;
    setFetching(true);
    try {
      const data = await getEvidencesForRecord(recordData.uid, recordData.recordId);
      setEvidences(data);
    } catch (error) {
      console.error("Error fetching evidences", error);
    } finally {
      setFetching(false);
    }
  }, [recordData.uid, recordData.recordId]);

  useEffect(() => {
    if (isOpen && recordData.recordId) {
      fetchEvidences();
    }
  }, [isOpen, recordData.recordId, fetchEvidences]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validation: Max 5MB before compression
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert("Saiz fail melebihi 5MB. Sila pilih fail yang lebih kecil.");
        return;
      }
      
      // Validation: Allowed types
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(selectedFile.type)) {
        alert("Hanya fail JPG, JPEG dan PNG sahaja dibenarkan.");
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (isReadOnly) return;
    if (!file || !recordData.recordId) return;
    if (evidences.length >= 3) {
      alert("Had maksimum 3 evidens telah dicapai.");
      return;
    }

    setLoading(true);
    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file);
      
      // Final size check after compression
      if (compressedBlob.size > 1024 * 1024) { // 1MB absolute max after compression
        alert("Gagal memampatkan gambar ke saiz yang dibenarkan. Sila cuba gambar lain.");
        setLoading(false);
        return;
      }

      const timestamp = Date.now();
      const storagePath = `evidences/${recordData.uid}/${recordData.classId}/${recordData.studentId}/${timestamp}.jpg`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, compressedBlob);
      const imageUrl = await getDownloadURL(storageRef);

      const evidenceData = {
        imageUrl,
        storagePath,
        note,
        tpGiven: recordData.tpGiven,
        spCode: recordData.spCode,
        studentId: recordData.studentId,
        studentName: recordData.studentName,
        createdBy: recordData.uid,
        classSubjectId: recordData.classSubjectId,
      };

      await addEvidenceToRecord(recordData.uid, recordData.recordId, evidenceData);
      
      setFile(null);
      setNote("");
      await fetchEvidences();
      onSuccess();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Gagal memuat naik evidens.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (evidenceId: string, storagePath: string) => {
    if (isReadOnly) return;
    if (!confirm("Padam evidens ini?")) return;

    setDeletingId(evidenceId);
    try {
      // 1. Delete from Storage if path exists
      if (storagePath) {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef).catch(err => console.warn("Storage delete failed", err));
      }

      // 2. Delete from Firestore
      await deleteEvidence(recordData.uid, recordData.recordId, evidenceId);
      
      await fetchEvidences();
      onSuccess();
    } catch (error) {
      console.error("Delete failed", error);
      alert("Gagal memadam evidens.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-4 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Tambah Evidens</h2>
            <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">{recordData.studentName} &bull; {recordData.spCode}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-200 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Existing Evidences */}
          <div className="space-y-3">
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Evidens Sedia Ada ({evidences.length}/3)</h3>
            {fetching ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-emerald-600" size={24} />
              </div>
            ) : evidences.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {evidences.map((ev) => (
                  <div key={ev.id} className="group relative aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                    <Image 
                      src={ev.imageUrl} 
                      alt="Evidence" 
                      fill 
                      className="object-cover cursor-pointer"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onClick={() => setPreviewImage(ev.imageUrl)}
                    />
                    
                    {/* Delete Button */}
                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ev.id, ev.storagePath);
                        }}
                        disabled={deletingId === ev.id}
                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {deletingId === ev.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="text-[9px] text-white px-2 text-center line-clamp-1">{ev.note || "Tiada nota"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 sm:p-8 text-center">
                <ImageIcon className="mx-auto mb-2 text-slate-300" size={32} />
                <p className="text-sm text-slate-400">Tiada evidens dijumpai.</p>
              </div>
            )}
          </div>

          {/* Upload Form */}
          {evidences.length < 3 && !isReadOnly && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Muat Naik Gambar</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex h-12 sm:h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 transition-colors hover:border-emerald-400">
                      <span className="text-sm text-slate-500 truncate">
                        {file ? file.name : "Pilih fail..."}
                      </span>
                      <Upload size={18} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Nota Guru</label>
                <Input
                  placeholder="Masukkan nota ringkas..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-12 sm:h-10"
                />
              </div>

              <Button
                className="w-full h-12 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleUpload}
                disabled={!file || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Evidens"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X size={32} />
          </button>
          <div className="relative w-full max-w-4xl aspect-video sm:aspect-auto sm:h-[80vh]">
            <Image
              src={previewImage}
              alt="Preview"
              fill
              className="object-contain"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
