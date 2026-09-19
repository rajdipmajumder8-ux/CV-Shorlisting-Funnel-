import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Play,
  FileCheck,
  Trash2,
  Sparkles,
  Zap,
  HelpCircle,
  AlertCircle,
  Sun,
  ChevronDown,
  Layers,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sidebar } from './components/Sidebar';
import { ResultsTable } from './components/ResultsTable';
import { CandidateDetailModal } from './components/CandidateDetailModal';
import { ScreeningParams, ScoreResult } from './types';
import { SAMPLE_JD, SAMPLE_CVS, JOB_PRESETS } from './data/sampleData';

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
  const [jdText, setJdText] = useState(SAMPLE_JD);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('solar_bess_engineer');

  // CV items: either real File objects or sample text objects
  const [cvFiles, setCvFiles] = useState<
    Array<{ id: string; name: string; file?: File; content?: string; sizeStr: string }>
  >([]);

  // Results & UI state
  const [isScreening, setIsScreening] = useState(false);
  const [isDraggingCv, setIsDraggingCv] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  const [screeningStep, setScreeningStep] = useState<string>('');
  const [screeningProgress, setScreeningProgress] = useState<number>(0);
  const [results, setResults] = useState<ScoreResult[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ScoreResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Health check on mount
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

  // Pre-load sample data on initial mount
  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = () => {
    setJdText(SAMPLE_JD);
    setJdFile(null);
    setSelectedPresetId('solar_bess_engineer');
    const sampleItems = SAMPLE_CVS.map((cv, idx) => ({
      id: `sample_${idx}`,
      name: cv.name,
      content: cv.content,
      sizeStr: `${(cv.content.length / 1024).toFixed(1)} KB (Sample)`
    }));
    setCvFiles(sampleItems);
    setErrorMessage(null);
    setSuccessNotice('Sunjet Energy sample job description and 4 candidate resumes loaded.');
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = JOB_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setJdText(preset.text);
    setJdFile(null);
  };

  const handleJdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJdFile(file);

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

  const addCvFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const newItems: Array<{ id: string; name: string; file?: File; content?: string; sizeStr: string }> = [];

    Array.from(files).forEach((f) => {
      const item: { id: string; name: string; file?: File; content?: string; sizeStr: string } = {
        id: `${f.name}_${Date.now()}_${Math.random()}`,
        name: f.name,
        file: f,
        sizeStr: `${(f.size / 1024).toFixed(1)} KB`
      };

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
    setSuccessNotice(`Added ${newItems.length} candidate CV file(s) to the queue.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleCvFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addCvFiles(e.target.files);
    }
    e.target.value = '';
  };

  const removeCv = (id: string) => {
    setCvFiles((prev) => prev.filter((c) => c.id !== id));
  };

  const clearAllCvs = () => {
    setCvFiles([]);
  };

  const clearWorkspace = () => {
    setJdText('');
    setJdFile(null);
    setCvFiles([]);
    setResults([]);
    setErrorMessage(null);
    setSuccessNotice('Workspace cleared.');
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // Run Screening Engine
  const handleRunScreening = async () => {
    setErrorMessage(null);
    if (!jdText.trim() && !jdFile) {
      setErrorMessage('Please provide a Job Description (paste text, select a preset, or upload a file).');
      return;
    }
    if (cvFiles.length === 0) {
      setErrorMessage('Please upload at least one candidate CV or click "Reset Sample Data".');
      return;
    }

    setIsScreening(true);
    setScreeningStep('1/3 Ingesting & parsing candidate documents...');
    setScreeningProgress(25);

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

      setScreeningStep('2/3 Semantic skill extraction with Gemini AI...');
      setScreeningProgress(60);

      let lastErrMessage = '';
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 1) {
            setScreeningStep(`Connecting to AI model (attempt ${attempt} of ${MAX_RETRIES})...`);
            await new Promise((r) => setTimeout(r, attempt * 1500));
          }

          const res = await fetch('/api/screen', {
            method: 'POST',
            body: formData
          });

          const contentType = res.headers.get('content-type') || '';

          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.results && Array.isArray(data.results)) {
              setScreeningStep('3/3 Finalizing tiered rankings & executive verdicts...');
              setScreeningProgress(100);
              await new Promise((r) => setTimeout(r, 400));
              setResults(data.results);
              setErrorMessage(null);

              // If Tier 1 candidates exist, trigger celebratory confetti!
              const hasTier1 = data.results.some((r: ScoreResult) => r.tier === 1);
              if (hasTier1) {
                confetti({
                  particleCount: 60,
                  spread: 70,
                  origin: { y: 0.6 }
                });
              }

              return;
            }
          }

          if (contentType.includes('text/html') || res.status === 502 || res.status === 503 || res.status === 504) {
            lastErrMessage = 'Screening service is warming up. Retrying automatically...';
            continue;
          }

          if (contentType.includes('application/json')) {
            const errData = await res.json();
            throw new Error(errData.error || `Evaluation failed with status ${res.status}`);
          } else {
            const textResp = await res.text();
            throw new Error(`Screening failed: ${textResp.slice(0, 150) || res.statusText}`);
          }
        } catch (fetchErr: any) {
          const msg = fetchErr?.message || String(fetchErr);
          if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
            lastErrMessage = 'Connecting to screening backend...';
            if (attempt < MAX_RETRIES) {
              continue;
            }
          } else {
            throw fetchErr;
          }
        }
      }

      throw new Error(lastErrMessage || 'Unable to connect to the screening engine. Please retry.');
    } catch (err: any) {
      console.error('AI Screening failed:', err);
      setErrorMessage(err.message || 'AI Screening request failed.');
    } finally {
      setIsScreening(false);
      setScreeningStep('');
      setScreeningProgress(0);
    }
  };

  // Export Excel Report
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
      a.download = `Sunjet_Talent_Funnel_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 antialiased font-sans">
      {/* Left Sidebar: Screening & Model Calibration */}
      <Sidebar params={params} onChange={setParams} ollamaAvailable={ollamaAvailable} />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Executive Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
          {/* Brand & Corporate Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl shadow-xs border border-slate-800">
              <Sun className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  Sunjet Energy
                </h1>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-700">
                  Talent Funnel &amp; AI Candidate Ranker
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Gemini 3.1 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Direct semantic CV-to-JD qualification analysis, skills gap detection, and executive interview tiering
              </p>
            </div>
          </div>

          {/* Quick Actions Header Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
              title="Reload sample Sunjet Energy Solar Engineer JD & candidate resumes"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
              <span>Reset Sample Data</span>
            </button>

            <button
              onClick={clearWorkspace}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 hover:border-rose-200 transition-colors cursor-pointer"
              title="Clear all fields and start fresh"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </header>

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notification Banners */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-3 shadow-2xs animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Evaluation Alert: </span>
                {errorMessage}
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-700 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{successNotice}</span>
              </div>
              <button
                onClick={() => setSuccessNotice(null)}
                className="text-emerald-500 hover:text-emerald-800 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* SECTION 1: DUAL INPUT STUDIO (JD & Candidate CVs) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1A: Job Description Studio */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-3.5">
              {/* Card Header & Presets */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
                    <Briefcase className="w-4 h-4 text-slate-700" />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Job Description (JD)
                  </h3>
                </div>

                <label className="text-xs text-slate-700 hover:text-slate-900 font-semibold cursor-pointer flex items-center gap-1">
                  <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attach Document</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleJdFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Job Preset Selector Tabs */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {JOB_PRESETS.map((p) => {
                  const isSelected = selectedPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPreset(p.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                      }`}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>

              {/* Attached file chip if any */}
              {jdFile && (
                <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                  <span className="truncate font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    {jdFile.name} ({(jdFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    onClick={() => {
                      setJdFile(null);
                      setJdText('');
                    }}
                    className="text-blue-600 hover:text-blue-900 font-bold ml-2 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Text Area */}
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  setSelectedPresetId('');
                }}
                placeholder="Paste Job Description specifications, key responsibilities, required years of experience, and toolchain expectations..."
                className="w-full flex-1 min-h-[175px] p-3.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:border-slate-900 focus:bg-white resize-none font-mono leading-relaxed transition-colors"
              />

              {/* Footer specs */}
              <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium pt-0.5">
                <span>PDF, DOCX, TXT supported</span>
                <span className="font-mono">{jdText.length} characters</span>
              </div>
            </div>

            {/* 1B: Candidate CV Studio */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
                    <UploadCloud className="w-4 h-4 text-slate-700" />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Candidate CV Queue ({cvFiles.length})
                  </h3>
                </div>

                {cvFiles.length > 0 && (
                  <button
                    onClick={clearAllCvs}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Interactive Upload Drop Zone */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingCv(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingCv(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingCv(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    addCvFiles(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[90px] ${
                  isDraggingCv
                    ? 'border-slate-900 bg-amber-50/60 ring-2 ring-amber-300'
                    : 'border-slate-200 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100/60'
                }`}
              >
                <UploadCloud className="w-5 h-5 text-slate-700 mb-1" />
                <span className="text-xs font-bold text-slate-800">
                  {isDraggingCv ? 'Drop candidate CV files here' : 'Click or Drag & Drop Multiple Resumes'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Batch upload PDF, DOCX, TXT (up to 50 candidates at once)
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
              <div className="flex-1 min-h-[120px] max-h-[145px] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-slate-50/50">
                {cvFiles.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-400">
                    No candidate CVs loaded. Drop files above or click "Reset Sample Data".
                  </div>
                ) : (
                  cvFiles.map((item) => (
                    <div
                      key={item.id}
                      className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({item.sizeStr})
                        </span>
                      </div>
                      <button
                        onClick={() => removeCv(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Remove resume"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: AI SCREENING LAUNCHPAD DECK */}
          <div className="bg-slate-900 rounded-3xl p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-md border border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">
                    AI Talent Funnel Evaluation Engine
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 rounded-full text-slate-300 border border-slate-700">
                    Tier 1: ≥{Math.round(params.tier1_min * 100)}% | Tier 2: ≥{Math.round(params.tier2_min * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Evaluates candidate documents directly against required solar engineering qualifications, scale, and tools.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isScreening && (
                <div className="text-right mr-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 justify-end">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>{screeningStep}</span>
                  </div>
                  <div className="w-44 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      style={{ width: `${screeningProgress}%` }}
                      className="bg-amber-400 h-full transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleRunScreening}
                disabled={isScreening || (!jdText.trim() && !jdFile) || cvFiles.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 rounded-2xl font-bold text-xs tracking-wide shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>
                  {isScreening
                    ? 'AI Screening in Progress...'
                    : `⚡ Screen ${cvFiles.length} Candidate(s) with AI`}
                </span>
              </button>
            </div>
          </div>

          {/* SECTION 3: RESULTS DASHBOARD & TALENT FUNNEL */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Screening Matrix &amp; Talent Funnel
                </h2>
                <p className="text-xs text-slate-500">
                  Review candidate scores, drill down into evidence citations, and export reports
                </p>
              </div>

              {results.length > 0 && (
                <span className="text-xs font-mono font-semibold bg-white border border-slate-200 px-3 py-1 rounded-xl text-slate-700 shadow-2xs">
                  {results.length} candidate(s) screened
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

      {/* Candidate Drilldown Executive Dossier Modal */}
      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
};

export default App;
