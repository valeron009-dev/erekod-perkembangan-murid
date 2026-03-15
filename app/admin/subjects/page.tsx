"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Info,
  Download
} from "lucide-react";
import { getSubjects, saveSubject } from "@/lib/firestore-helpers";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  
  // Form state
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSummary, setCsvSummary] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error("Error loading subjects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    setFormLoading(true);
    setError(null);
    try {
      await saveSubject({
        subjectCode: newCode.trim().toUpperCase(),
        subjectName: newName.trim(),
        isActive: true
      });
      setIsModalOpen(false);
      setNewCode("");
      setNewName("");
      loadData();
    } catch (err: any) {
      setError(err.message || "Gagal menambah subjek.");
    } finally {
      setFormLoading(false);
    }
  };

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
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        setCsvError("Fail CSV kosong atau tidak mempunyai data.");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const codeIdx = headers.indexOf("subjectcode");
      const nameIdx = headers.indexOf("subjectname");
      const activeIdx = headers.indexOf("isactive");

      if (codeIdx === -1 || nameIdx === -1) {
        setCsvError("Lajur 'subjectCode' atau 'subjectName' tidak dijumpai.");
        return;
      }

      const preview = lines.slice(1).map(line => {
        const cols = line.split(",");
        return {
          subjectCode: cols[codeIdx]?.trim().toUpperCase(),
          subjectName: cols[nameIdx]?.trim(),
          isActive: cols[activeIdx]?.trim().toLowerCase() === "true"
        };
      }).filter(s => s.subjectCode && s.subjectName);

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
      for (const subject of csvPreview) {
        await saveSubject(subject);
        successCount++;
      }
      setCsvSummary({ total: csvPreview.length, success: successCount });
      loadData();
    } catch (err: any) {
      setCsvError("Gagal mengimport CSV. Sila cuba lagi.");
    } finally {
      setCsvLoading(false);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subjectName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pengurusan Subjek</h1>
          <p className="text-slate-500 mt-1">Urus senarai subjek yang ditawarkan dalam sistem.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => setIsCsvModalOpen(true)}
          >
            <Upload size={18} />
            Import CSV
          </Button>
          <Button 
            variant="primary" 
            className="gap-2 h-11 px-6 shadow-lg shadow-emerald-900/10"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            Tambah Subjek
          </Button>
        </div>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                placeholder="Cari kod atau nama subjek..."
                className="pl-10 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Kod Subjek</th>
                  <th className="px-6 py-4">Nama Subjek</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                      <p className="mt-2 text-sm text-slate-500">Memuatkan senarai subjek...</p>
                    </td>
                  </tr>
                ) : filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded text-sm">
                          {subject.subjectCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{subject.subjectName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          subject.isActive 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {subject.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {subject.isActive ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs">Ubah</Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Tiada subjek dijumpai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                <p className="mt-2 text-sm text-slate-500">Memuatkan senarai subjek...</p>
              </div>
            ) : filteredSubjects.length > 0 ? (
              filteredSubjects.map((subject) => (
                <div key={subject.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {subject.subjectCode}
                      </span>
                      <p className="font-bold text-slate-900 text-sm">{subject.subjectName}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      subject.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {subject.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs">Ubah</Button>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">
                Tiada subjek dijumpai.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between p-6">
              <h2 className="text-xl font-bold text-slate-900">Tambah Subjek Baharu</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle size={24} />
              </button>
            </CardHeader>
            <form onSubmit={handleAddSubject}>
              <CardContent className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}
                <Input
                  label="Kod Subjek"
                  placeholder="Contoh: BM, BI, SN"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
                <Input
                  label="Nama Subjek"
                  placeholder="Contoh: Bahasa Melayu"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </CardContent>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button type="submit" variant="primary" className="flex-1 gap-2" disabled={formLoading}>
                  {formLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Simpan Subjek
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between p-6">
              <h2 className="text-xl font-bold text-slate-900">Import Subjek (CSV)</h2>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
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
                      <p className="font-mono text-[10px] bg-blue-100 px-1.5 py-0.5 rounded inline-block mb-2">subjectCode,subjectName,isActive</p>
                      <p>Pastikan baris pertama adalah tajuk lajur.</p>
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
                        {csvPreview.length > 0 ? `${csvPreview.length} subjek dikesan` : "Muat naik fail CSV subjek"}
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
                    <Button variant="outline" className="flex-1" onClick={() => setIsCsvModalOpen(false)}>Batal</Button>
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
                    <p className="text-slate-500 mt-1">Berjaya mengimport {csvSummary.success} daripada {csvSummary.total} subjek.</p>
                  </div>
                  <Button variant="primary" className="w-full" onClick={() => setIsCsvModalOpen(false)}>Tutup</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
