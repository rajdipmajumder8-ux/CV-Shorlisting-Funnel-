import React from 'react';
import { Sliders, Sparkles, ShieldCheck, Zap, Award } from 'lucide-react';
import { ScreeningParams, ScoringMethod } from '../types';

interface SidebarProps {
  params: ScreeningParams;
  onChange: (params: ScreeningParams) => void;
  ollamaAvailable?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ params, onChange }) => {
  const handleTier1Change = (val: number) => {
    // Tier 1 must be strictly greater than Tier 2
    const safeVal = Math.max(val, Math.round(params.tier2_min * 100) + 1);
    onChange({ ...params, tier1_min: safeVal / 100 });
  };

  const handleTier2Change = (val: number) => {
    // Tier 2 must be strictly less than Tier 1
    const safeVal = Math.min(val, Math.round(params.tier1_min * 100) - 1);
    onChange({ ...params, tier2_min: safeVal / 100 });
  };

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-xs">
      {/* Sidebar Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="p-2 bg-blue-50 text-blue-900 rounded-lg">
          <Sliders className="w-5 h-5 text-[#1B2A4A]" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 text-sm tracking-tight">AI Screening Engine</h2>
          <p className="text-xs text-slate-500">Gemini AI Model & Evaluation Controls</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Active AI Engine Banner */}
        <div className="p-3.5 bg-gradient-to-br from-[#1B2A4A] to-[#2A3E66] rounded-xl text-white shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              AI Intelligence
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live AI Active
            </span>
          </div>
          <div className="text-xs font-bold text-white tracking-wide">
            Gemini 3.8 Flash Engine
          </div>
          <p className="text-[11px] text-blue-100/80 leading-snug">
            Direct semantic CV-to-JD evaluation. Deep qualitative scoring, gap analysis, and tailored next-step actions.
          </p>
        </div>

        {/* AI Evaluation Mode */}
        <div className="space-y-2.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            AI Evaluation Mode
          </label>
          <div className="space-y-2">
            {(
              [
                {
                  id: 'gemini_ai',
                  label: 'Balanced AI Match',
                  badge: 'Recommended',
                  desc: 'High-precision technical skills, domain scale & experience calibration'
                },
                {
                  id: 'gemini_strict',
                  label: 'Strict Requirements',
                  badge: 'Rigorous',
                  desc: 'Heavy penalties for missing mandatory licenses, tools, or min experience'
                },
                {
                  id: 'gemini_holistic',
                  label: 'Holistic Talent Fit',
                  badge: 'Growth-Minded',
                  desc: 'Credits transferable domain competencies, aptitude & engineering leadership'
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  params.method === opt.id
                    ? 'border-[#1B2A4A] bg-blue-50/40 text-slate-900 shadow-2xs font-medium ring-1 ring-[#1B2A4A]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="scoring_method"
                  value={opt.id}
                  checked={params.method === opt.id}
                  onChange={() => onChange({ ...params, method: opt.id as ScoringMethod })}
                  className="mt-0.5 text-[#1B2A4A] focus:ring-[#1B2A4A]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{opt.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                      {opt.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal leading-tight mt-1">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tier 1 Slider */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Tier 1 Threshold (Shortlist)</label>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {Math.round(params.tier1_min * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={1}
            value={Math.round(params.tier1_min * 100)}
            onChange={(e) => handleTier1Change(Number(e.target.value))}
            className="w-full accent-[#1B2A4A] cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            Candidates scoring ≥ {Math.round(params.tier1_min * 100)}% proceed to Tier 1 (Technical Interview).
          </p>
        </div>

        {/* Tier 2 Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Tier 2 Threshold (Screen)</label>
            <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {Math.round(params.tier2_min * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={74}
            step={1}
            value={Math.round(params.tier2_min * 100)}
            onChange={(e) => handleTier2Change(Number(e.target.value))}
            className="w-full accent-[#1B2A4A] cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            Candidates scoring {Math.round(params.tier2_min * 100)}%–{Math.round(params.tier1_min * 100) - 1}% go to Tier 2 (Phone Screen).
          </p>
        </div>

        {/* Top-K Skills */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Top Skills to Extract</label>
            <span className="font-mono text-xs font-bold text-slate-700">{params.top_k}</span>
          </div>
          <input
            type="range"
            min={5}
            max={15}
            step={1}
            value={params.top_k}
            onChange={(e) => onChange({ ...params, top_k: Number(e.target.value) })}
            className="w-full accent-[#1B2A4A] cursor-pointer"
          />
        </div>

        {/* AI Talent Intelligence Guarantee */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#1B2A4A]">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>AI Semantic Comparison</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Resumes are compared directly by AI against specific engineering deliverables, tools, and technical leadership metrics.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Server-side protected AI proxy</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
