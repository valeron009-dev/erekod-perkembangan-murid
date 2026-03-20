"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  ListChecks, 
  Plus, 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Info,
  Download,
  Filter,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw
} from "lucide-react";
import { getLearningStandards, saveLearningStandard, getSubjects, db } from "@/lib/firestore-helpers";
import { doc, writeBatch, collection, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function AdminStandardsPage() {
  const [standards, setStandards] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeleteFilteredModalOpen, setIsDeleteFilteredModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'sortOrder',
    direction: 'asc'
  });
  
  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSummary, setCsvSummary] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetCsvState = () => {
    setCsvFile(null);
    setCsvPreview([]);
    setCsvLoading(false);
    setCsvError(null);
    setCsvSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const [lsData, subData] = await Promise.all([
        getLearningStandards(forceRefresh),
        getSubjects(forceRefresh)
      ]);
      setStandards(lsData);
      setSubjects(subData);
    } catch (error) {
      console.error("Error loading standards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setCsvError("Sila pilih fail CSV sahaja.");
      return;
    }

    setCsvFile(file);
    setCsvError(null);
    setCsvSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((line: string) => line.trim());
      
      if (lines.length < 2) {
        setCsvError("Fail CSV kosong atau tidak mempunyai data.");
        return;
      }

      // Robust CSV line parser to handle quotes and commas
      const parseCSVLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase());
      const required = ["subjectid", "year", "groupname", "spcode", "spdescription", "sortorder", "isactive"];
      const missing = required.filter((r: string) => headers.indexOf(r) === -1);

      if (missing.length > 0) {
        setCsvError(`Lajur berikut tidak dijumpai: ${missing.join(", ")}`);
        return;
      }

      const preview = lines.slice(1).map((line: string) => {
        const cols = parseCSVLine(line);
        
        const yearRaw = String(cols[headers.indexOf("year")] ?? "").trim();
        const yearParsed = parseInt(yearRaw, 10);
        
        const sortOrderRaw = String(cols[headers.indexOf("sortorder")] ?? "").trim();
        const sortOrderParsed = parseInt(sortOrderRaw, 10);
        
        const isActiveRaw = String(cols[headers.indexOf("isactive")] ?? "").trim().toLowerCase();

        return {
          subjectId: cols[headers.indexOf("subjectid")]?.trim().toUpperCase(),
          year: isNaN(yearParsed) ? null : yearParsed,
          groupName: cols[headers.indexOf("groupname")]?.trim(),
          spCode: cols[headers.indexOf("spcode")]?.trim(),
          spDescription: cols[headers.indexOf("spdescription")]?.trim(),
          sortOrder: isNaN(sortOrderParsed) ? null : sortOrderParsed,
          isActive: isActiveRaw === "true"
        };
      }).filter((s: any) => s.subjectId && s.spCode);

      setCsvPreview(preview);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (csvPreview.length === 0) return;

    setCsvLoading(true);
    setCsvError(null);
    try {
      let successCount = 0;
      for (const standard of csvPreview) {
        await saveLearningStandard(standard);
        successCount++;
      }
      setCsvSummary({ total: csvPreview.length, success: successCount });
      await loadData(true);
    } catch (err: any) {
      setCsvError("Gagal mengimport CSV. Sila cuba lagi.");
    } finally {
      setCsvLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;

    setBulkLoading(true);
    try {
      console.log(`Bulk updating ${selectedIds.length} documents to isActive: ${isActive}`);
      console.log("IDs to update:", selectedIds);
      
      const batch = writeBatch(db);
      selectedIds.forEach((id: string) => {
        const ref = doc(db, "learningStandards", id);
        batch.update(ref, { isActive });
      });
      await batch.commit();
      
      console.log("Bulk update successful");
      
      setSelectedIds([]);
      await loadData(true);
    } catch (error) {
      console.error("Error bulk updating status:", error);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStandards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStandards.map((s: any) => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    try {
      const lsRef = collection(db, "learningStandards");
      const snap = await getDocs(lsRef);
      
      const chunks = [];
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 500) {
        chunks.push(docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }

      setIsDeleteAllModalOpen(false);
      await loadData(true);
    } catch (error) {
      console.error("Error deleting all standards:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteFiltered = async () => {
    if (subjectFilter === "all") return;
    
    setDeleteLoading(true);
    try {
      const lsRef = collection(db, "learningStandards");
      let q = query(lsRef, where("subjectId", "==", subjectFilter));
      
      if (yearFilter !== "all") {
        q = query(q, where("year", "==", parseInt(yearFilter)));
      }
      
      const snap = await getDocs(q);
      const docs = snap.docs;
      
      if (docs.length > 0) {
        const chunks = [];
        for (let i = 0; i < docs.length; i += 500) {
          chunks.push(docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      setIsDeleteFilteredModalOpen(false);
      setSelectedIds([]);
      await loadData(true);
    } catch (error) {
      console.error("Error deleting filtered standards:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredStandards = standards.filter((s: any) => {
    const matchesSearch = s.spCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.spDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectFilter === "all" || s.subjectId === subjectFilter;
    const matchesYear = yearFilter === "all" || s.year.toString() === yearFilter;
    return matchesSearch && matchesSubject && matchesYear;
  });

  const sortedStandards = React.useMemo(() => {
    const sortableItems = [...filteredStandards];
    if (sortConfig.key) {
      sortableItems.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredStandards, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFixData = async () => {
    if (!confirm("Adakah anda pasti mahu membetulkan data yang terbalik?")) return;
    setLoading(true);
    try {
      const lsRef = collection(db, "learningStandards");
      const snap = await getDocs(lsRef);
      const docs = snap.docs;
      
      let fixCount = 0;
      const batch = writeBatch(db);
      
      docs.forEach((d: any) => {
        const data = d.data();
        const { spCode, spDescription } = data;
        
        if (!spCode || !spDescription) return;

        const isCode = (str: string) => /^\d+(\.\d+)*$/.test(str.trim());
        
        const spCodeIsCode = isCode(spCode);
        const spDescriptionIsCode = isCode(spDescription);

        if (!spCodeIsCode && spDescriptionIsCode) {
          batch.update(d.ref, {
            spCode: spDescription,
            spDescription: spCode,
            updatedAt: serverTimestamp()
          });
          fixCount++;
        }
      });

      if (fixCount > 0) {
        await batch.commit();
        alert(`Berjaya membetulkan ${fixCount} rekod.`);
        loadData(true);
      } else {
        alert("Tiada rekod terbalik dijumpai.");
      }
    } catch (error) {
      console.error("Error fixing data:", error);
      alert("Ralat membetulkan data.");
    } finally {
      setLoading(false);
    }
  };

  const SortButton = ({ columnKey, label }: { columnKey: string; label: string }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <button 
        onClick={() => handleSort(columnKey)}
        className={`flex items-center gap-1 hover:text-emerald-600 transition-colors ${isActive ? 'text-emerald-600' : ''}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : (
          <ChevronsUpDown size={14} className="text-slate-300" />
        )}
      </button>
    );
  };

  const subjectOptions = [
    { label: "Semua Subjek", value: "all" },
    ...subjects.map((s: any) => ({ label: s.subjectName, value: s.subjectCode }))
  ];

  const yearOptions = [
    { label: "Semua", value: "all" },
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Standard Pembelajaran</h1>
          <p className="text-slate-500 mt-1">Urus data induk Standard Pembelajaran (SP) mengikut subjek dan tahun.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={handleFixData}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Betulkan Data Terbalik
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={() => setIsDeleteFilteredModalOpen(true)}
            disabled={subjectFilter === "all"}
          >
            <Filter size={18} />
            Padam Ditapis
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setIsDeleteAllModalOpen(true)}
          >
            <Trash2 size={18} />
            Padam Semua
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => setIsCsvModalOpen(true)}
          >
            <Upload size={18} />
            Import CSV
          </Button>
        </div>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end flex-1">
              <div className="w-full sm:w-64">
                <Select
                  label="Subjek"
                  options={subjectOptions}
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  label="Tahun / Tingkatan"
                  options={yearOptions}
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-[calc(50%+12px)] -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  label="Cari SP"
                  placeholder="Kod atau huraian..."
                  className="pl-10 h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4 w-10">
                    <button 
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredStandards.length ? (
                        <CheckSquare size={18} className="text-emerald-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="subjectId" label="Subjek" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="year" label="Tahun / Tingkatan" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="groupName" label="Topik/Unit" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="spCode" label="Kod SP" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="spDescription" label="Huraian SP" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="sortOrder" label="Susunan" />
                  </th>
                  <th className="px-6 py-4">
                    <SortButton columnKey="isActive" label="Status" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                      <p className="mt-2 text-sm text-slate-500">Memuatkan senarai SP...</p>
                    </td>
                  </tr>
                ) : sortedStandards.length > 0 ? (
                  sortedStandards.map((ls: any) => (
                    <tr 
                      key={ls.id} 
                      className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(ls.id) ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleSelect(ls.id)}
                          className="text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          {selectedIds.includes(ls.id) ? (
                            <CheckSquare size={18} className="text-emerald-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{ls.subjectId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">
                          {ls.subjectId?.includes("-SM") ? "Tingkatan" : "Tahun"} {ls.year}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 font-medium">{ls.groupName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs">
                          {ls.spCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-600 max-w-xs truncate" title={ls.spDescription}>
                          {ls.spDescription}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-400">{ls.sortOrder}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          ls.isActive 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {ls.isActive ? 'Aktif' : 'Tidak'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Tiada Standard Pembelajaran dijumpai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <Card className="bg-slate-900 text-white border-none shadow-2xl px-6 py-4 flex items-center gap-6 rounded-2xl">
            <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
              <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                {selectedIds.length}
              </div>
              <p className="text-sm font-bold">Item dipilih</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="primary" 
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-10 px-4"
                onClick={() => handleBulkStatusUpdate(true)}
                disabled={bulkLoading}
              >
                {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <ToggleRight size={18} />}
                Aktifkan
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 bg-transparent border-slate-700 text-white hover:bg-slate-800 h-10 px-4"
                onClick={() => handleBulkStatusUpdate(false)}
                disabled={bulkLoading}
              >
                {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <ToggleLeft size={18} />}
                Nyahaktifkan
              </Button>
              <button 
                onClick={() => setSelectedIds([])}
                className="ml-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Batal
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Filtered Modal */}
      {isDeleteFilteredModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900">Padam Standard Ditapis?</h2>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle size={24} className="text-orange-600 shrink-0" />
                <div className="text-sm text-orange-900">
                  <p className="font-bold mb-1">Pengesahan Padam</p>
                  <p>
                    Padam semua SP bagi subjek <strong>{subjectFilter}</strong>
                    {yearFilter !== "all" ? ` ${subjectFilter.includes("-SM") ? "Tingkatan" : "Tahun"} ${yearFilter}` : ""}?
                  </p>
                  <p className="mt-2 text-xs opacity-80 italic">Tindakan ini tidak boleh dikembalikan.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsDeleteFilteredModalOpen(false)} disabled={deleteLoading}>
                  Batal
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2" 
                  onClick={handleDeleteFiltered}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Ya, Padam Ditapis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900">Padam Semua Standard?</h2>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle size={24} className="text-red-600 shrink-0" />
                <div className="text-sm text-red-900">
                  <p className="font-bold mb-1">Amaran Bahaya!</p>
                  <p>Tindakan ini akan memadamkan <strong>SEMUA</strong> {standards.length} Standard Pembelajaran secara kekal. Data ini tidak boleh dikembalikan.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsDeleteAllModalOpen(false)} disabled={deleteLoading}>
                  Batal
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2" 
                  onClick={handleDeleteAll}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Ya, Padam Semua
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between p-6">
              <h2 className="text-xl font-bold text-slate-900">Import Standard (CSV)</h2>
              <button onClick={() => { setIsCsvModalOpen(false); resetCsvState(); }} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle size={24} />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {!csvSummary ? (
                <>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                    <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-bold mb-1">Format CSV:</p>
                      <p className="font-mono text-[9px] bg-blue-100 px-1.5 py-0.5 rounded inline-block mb-2">
                        subjectId,year,groupName,spCode,spDescription,sortOrder,isActive
                      </p>
                      <p>Pastikan semua lajur di atas wujud dalam fail CSV anda.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                      csvFile ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50"
                    }`}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                    <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                      csvFile ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {csvFile ? <FileText size={32} /> : <Upload size={32} />}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-900">{csvFile ? csvFile.name : "Klik untuk pilih fail CSV"}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {csvPreview.length > 0 ? `${csvPreview.length} SP dikesan` : "Muat naik fail CSV SP"}
                      </p>
                    </div>
                  </div>

                  {csvError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p className="font-medium">{csvError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setIsCsvModalOpen(false); resetCsvState(); }}>Batal</Button>
                    <Button 
                      variant="primary" 
                      className="flex-1 gap-2" 
                      disabled={csvLoading || csvPreview.length === 0}
                      onClick={handleCsvImport}
                    >
                      {csvLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                      Mula Import
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-6 py-4">
                  <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Import Selesai!</h3>
                    <p className="text-slate-500 mt-1">Berjaya mengimport {csvSummary.success} daripada {csvSummary.total} Standard Pembelajaran.</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button variant="primary" className="w-full" onClick={() => { setIsCsvModalOpen(false); resetCsvState(); }}>Tutup</Button>
                    <Button variant="outline" className="w-full" onClick={resetCsvState}>Muat Naik Lagi</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
