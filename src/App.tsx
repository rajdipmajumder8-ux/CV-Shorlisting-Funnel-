import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Play,
  FileCheck,
  Trash2,
  Sparkles,
  Zap,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ResultsTable } from './components/ResultsTable';
import { CandidateDetailModal } from './components/CandidateDetailModal';
import { ScreeningParams, ScoreResult } from './types';
import { SAMPLE_JD, SAMPLE_CVS } from './data/sampleData';
import { scoreCandidateTfidf } from './utils/scoring';

export const App: React.FC = () => {
  // Screening Parameters
  const [params, setParams] = useState<ScreeningParams>({
    tier1_min: 0.75,
    tier2_min: 0.50,
    method: 'gemini_ai',
    top_k: 10,
    ollama_model: 'nomic-embed-text'
  });

  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  // Inputs
  const [jdText, setJdText] = useState('');
  const [jdFile, setJdFile] = useState<File | null>(null);

  // CV items: either real File objects or sample text objects
  const [cvFiles, setCvFiles] = useState<
    Array<{ id: string; name: string; file?: File; content?: string; sizeStr: string }>
  >([]);

  // Results & UI state
  const [isScreening, setIsScreening] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState<ScoreResult[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ScoreResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check health and Ollama status on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.ollamaAvailable) {
          setOllamaAvailable(true);
        }
      })
      .catch((err) => console.log('Health check note:', err));
  }, []);

  // Pre-load sample data on first visit
  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = () => {
    setJdText(SAMPLE_JD);
    setJdFile(null);
    const sampleItems = SAMPLE_CVS.map((cv, idx) => ({
      id: `sample_${idx}`,
      name: cv.name,
      content: cv.content,
      sizeStr: `${(cv.content.length / 1024).toFixed(1)} KB (Sample)`
    }));
    setCvFiles(sampleItems);
    setErrorMessage(null);
  };

  const handleJdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJdFile(file);

    // If it's a plain text file, read into textarea directly
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setJdText((ev.target?.result as string) || '');
      };
      reader.readAsText(file);
    } else {
      setJdText(`[Attached file: ${file.name}]`);
    }
  };

  const handleCvFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: Array<{ id: string; name: string; file?: File; content?: string; sizeStr: string }> = [];

    Array.from(files).forEach((f) => {
      const item: { id: string; name: string; file?: File; content?: string; sizeStr: string } = {
        id: `${f.name}_${Date.now()}_${Math.random()}`,
        name: f.name,
        file: f,
        sizeStr: `${(f.size / 1024).toFixed(1)} KB`
      };

      // Read text files in the browser for instant availability
      if (f.name.endsWith('.txt') || f.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          item.content = (ev.target?.result as string) || '';
        };
        reader.readAsText(f);
      }

      newItems.push(item);
    });

    setCvFiles((prev) => [...prev, ...newItems]);
    e.target.value = ''; // Reset input
  };

  const removeCv = (id: string) => {
    setCvFiles((prev) => prev.filter((c) => c.id !== id));
  };

  const clearAllCvs = () => {
    setCvFiles([]);
  };

  // Run Screening Engine
  const handleRunScreening = async () => {
    setErrorMessage(null);
    if (!jdText.trim() && !jdFile) {
      setErrorMessage('Please provide a Job Description (paste text or upload a file).');
      return;
    }
    if (cvFiles.length === 0) {
      setErrorMessage('Please upload at least one candidate CV or load sample candidates.');
      return;
    }

    setIsScreening(true);
    setProgressMsg(`Evaluating ${cvFiles.length} candidate CV(s) with Gemini AI...`);

    try {
      const formData = new FormData();
      if (jdFile) {
        formData.append('jd_file', jdFile);
      }
      formData.append('jd_text', jdText);
      formData.append('tier1_min', String(params.tier1_min));
      formData.append('tier2_min', String(params.tier2_min));
      formData.append('method', params.method);
      formData.append('top_k', String(params.top_k));

      const inlineCvList: Array<{ name: string; content: string }> = [];
      cvFiles.forEach((item) => {
        if (item.file) {
          formData.append('cv_files', item.file);
        } else if (item.content) {
          inlineCvList.push({ name: item.name, content: item.content });
        }
      });

      if (inlineCvList.length > 0) {
        formData.append('cv_list', JSON.stringify(inlineCvList));
      }

      const res = await fetch('/api/screen', {
        method: 'POST',
        body: formData
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
          return;
        }
      }

      // Handle non-OK JSON response
      if (contentType.includes('application/json')) {
        const errData = await res.json();
        throw new Error(errData.error || `AI evaluation failed with status ${res.status}`);
      } else {
        const textResp = await res.text();
        throw new Error(`AI Screening failed: ${textResp.slice(0, 150) || res.statusText}`);
      }
    } catch (err: any) {
      console.error('AI Screening failed:', err);
      setErrorMessage(err.message || 'AI Screening request failed.');
    } finally {
      setIsScreening(false);
      setProgressMsg('');
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (results.length === 0) return;
    setIsExporting(true);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });

      if (!res.ok) {
        throw new Error('Failed to download Excel report');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sunjet_talent_funnel_report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Error downloading Excel: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* Left Sidebar: Screening Configuration */}
      <Sidebar params={params} onChange={setParams} ollamaAvailable={ollamaAvailable} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B2A4A] text-white flex items-center justify-center font-bold text-lg shadow-xs">
              🎯
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Sunjet Energy — AI Talent Funnel & CV Ranker
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-[#1B2A4A] px-2 py-0.5 rounded-full border border-blue-200">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Gemini AI
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                AI-Powered semantic candidate screening, qualification analysis & tiered talent funnel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Reset Sample Data
            </button>
          </div>
        </header>

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Screening Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Section 1: Inputs (Grid of JD and CVs) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1A: Job Description Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1B2A4A]" />
                  <h3 className="font-bold text-sm text-slate-900">Job Description (JD)</h3>
                </div>
                <label className="text-xs text-[#1B2A4A] hover:underline font-semibold cursor-pointer">
                  Upload file (PDF, DOCX, TXT)
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleJdFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {jdFile && (
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <span className="truncate font-medium">📄 {jdFile.name}</span>
                  <button
                    onClick={() => {
                      setJdFile(null);
                      setJdText('');
                    }}
                    className="text-blue-700 hover:text-blue-900 font-bold ml-2"
                  >
                    ×
                  </button>
                </div>
              )}

              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste Job Description text here or upload a file above..."
                className="w-full flex-1 min-h-[160px] p-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#1B2A4A] focus:bg-white resize-none font-mono"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Supports PDF, DOCX, TXT</span>
                <span>{jdText.length} characters</span>
              </div>
            </div>

            {/* 1B: Candidate CVs Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#1B2A4A]" />
                  <h3 className="font-bold text-sm text-slate-900">Candidate CVs ({cvFiles.length})</h3>
                </div>
                {cvFiles.length > 0 && (
                  <button
                    onClick={clearAllCvs}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Upload Drop Zone */}
              <label className="border-2 border-dashed border-slate-200 hover:border-[#1B2A4A] rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-blue-50/30 flex flex-col items-center justify-center">
                <UploadCloud className="w-6 h-6 text-[#1B2A4A] mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  Click or Drag & Drop multiple CVs
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PDF, DOCX, TXT — batch upload up to 50 files
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={handleCvFilesUpload}
                  className="hidden"
                />
              </label>

              {/* Uploaded File List */}
              <div className="flex-1 min-h-[120px] max-h-[150px] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/40">
                {cvFiles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No CVs added yet. Click above or click "Reset Sample Data".
                  </div>
                ) : (
                  cvFiles.map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 flex items-center justify-between text-xs hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate max-w-[220px]">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">({item.sizeStr})</span>
                      </div>
                      <button
                        onClick={() => removeCv(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Screening Action Banner */}
          <div className="bg-gradient-to-r from-[#1B2A4A] to-[#2E4A6E] rounded-2xl p-4 text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Ready to Screen Candidates with AI</h3>
                <p className="text-xs text-slate-200">
                  Deep semantic AI evaluation compares each candidate against required domain competencies, toolchains & leadership deliverables.
                </p>
              </div>
            </div>

            <button
              onClick={handleRunScreening}
              disabled={isScreening || (!jdText.trim() && !jdFile) || cvFiles.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {isScreening ? progressMsg || 'AI Screening in progress...' : '⚡ Screen Resumes with AI'}
            </button>
          </div>

          {/* Section 2: Results Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Screening Matrix & Results</h2>
              {results.length > 0 && (
                <span className="text-xs text-slate-500">
                  {results.length} candidate(s) evaluated
                </span>
              )}
            </div>

            <ResultsTable
              results={results}
              onSelectCandidate={(candidate) => setSelectedCandidate(candidate)}
              onExportExcel={handleExportExcel}
              isExporting={isExporting}
            />
          </div>
        </main>
      </div>

      {/* Candidate Drilldown Modal */}
      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
};
export default App;
