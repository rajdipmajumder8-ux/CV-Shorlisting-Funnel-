import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  ShieldCheck,
  Zap,
  Award,
  CheckCircle2,
  Cpu,
  Gauge,
  Info
} from 'lucide-react';
import { ScreeningParams, ScoringMethod } from '../types';

interface SidebarProps {
  params: ScreeningParams;
  onChange: (params: ScreeningParams) => void;
  ollamaAvailable?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ params, onChange }) => {
  const [activeTab, setActiveTab] = useState<'funnel' | 'engine'>('funnel');

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

  const setPresetThresholds = (t1: number, t2: number) => {
    onChange({ ...params, tier1_min: t1, tier2_min: t2 });
  };

  const isCurrentPreset = (t1: number, t2: number) =>
    Math.round(params.tier1_min * 100) === Math.round(t1 * 100) &&
    Math.round(params.tier2_min * 100) === Math.round(t2 * 100);

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-xs select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold shadow-xs">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Funnel Controls
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Evaluation Calibration</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
          <button
            onClick={() => setActiveTab('funnel')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'funnel'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tiers
          </button>
          <button
            onClick={() => setActiveTab('engine')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === 'engine'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Engine
          </button>
        </div>
      </div>

      {/* Sidebar Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'funnel' ? (
          <>
            {/* Quick Threshold Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Calibration Presets</span>
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Balanced', t1: 0.75, t2: 0.50, sub: '75 / 50' },
                  { label: 'Strict', t1: 0.85, t2: 0.65, sub: '85 / 65' },
                  { label: 'Volume', t1: 0.65, t2: 0.40, sub: '65 / 40' }
                ].map((preset) => {
                  const active = isCurrentPreset(preset.t1, preset.t2);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setPresetThresholds(preset.t1, preset.t2)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{preset.label}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${active ? 'text-amber-300' : 'text-slate-400'}`}>
                        {preset.sub}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Funnel Distribution Gauge */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Funnel Threshold Distribution
              </div>
              <div className="h-3 rounded-full overflow-hidden flex bg-slate-200 shadow-inner">
                {/* Tier 3 width */}
                <div
                  style={{ width: `${Math.round(params.tier2_min * 100)}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title={`Tier 3: 0% - ${Math.round(params.tier2_min * 100)}%`}
                />
                {/* Tier 2 width */}
                <div
                  style={{
                    width: `${Math.round(params.tier1_min * 100) - Math.round(params.tier2_min * 100)}%`
                  }}
                  className="bg-amber-400 h-full transition-all duration-300"
                  title={`Tier 2: ${Math.round(params.tier2_min * 100)}% - ${Math.round(params.tier1_min * 100)}%`}
                />
                {/* Tier 1 width */}
                <div
                  style={{ width: `${100 - Math.round(params.tier1_min * 100)}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Tier 1: ${Math.round(params.tier1_min * 100)}% - 100%`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1 text-rose-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Tier 3 (&lt;{Math.round(params.tier2_min * 100)}%)
                </span>
                <span className="flex items-center gap-1 text-amber-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Tier 2
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Tier 1 (≥{Math.round(params.tier1_min * 100)}%)
                </span>
              </div>
            </div>

            {/* Tier 1 Slider */}
            <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <label className="font-bold text-slate-800">Tier 1: Shortlist</label>
                </div>
                <span className="font-mono font-bold text-xs px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                  ≥ {Math.round(params.tier1_min * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={1}
                value={Math.round(params.tier1_min * 100)}
                onChange={(e) => handleTier1Change(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <p className="text-[11px] text-slate-500 leading-snug">
                Candidates meeting or exceeding this match are fast-tracked directly to technical interviews.
              </p>
            </div>

            {/* Tier 2 Slider */}
            <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <label className="font-bold text-slate-800">Tier 2: Review</label>
                </div>
                <span className="font-mono font-bold text-xs px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                  ≥ {Math.round(params.tier2_min * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={74}
                step={1}
                value={Math.round(params.tier2_min * 100)}
                onChange={(e) => handleTier2Change(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <p className="text-[11px] text-slate-500 leading-snug">
                Candidates between {Math.round(params.tier2_min * 100)}% and {Math.round(params.tier1_min * 100) - 1}% undergo a targeted recruiter phone screen.
              </p>
            </div>

            {/* Top-K Skills */}
            <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">Key Competencies Analyzed</label>
                <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                  {params.top_k} skills
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={15}
                step={1}
                value={params.top_k}
                onChange={(e) => onChange({ ...params, top_k: Number(e.target.value) })}
                className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <p className="text-[11px] text-slate-500 leading-snug">
                Extracts the top {params.top_k} core qualifications from the job description for cross-verification.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Engine Status Banner */}
            <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Primary AI Model
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  Gemini 3.1 Flash-Lite
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Low-latency semantic parsing engine with direct multimodal document ingestion and automated high-demand cooldown failover.
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Latency: ~2.1s</span>
                <span>Context: 1M Tokens</span>
              </div>
            </div>

            {/* AI Evaluation Mode Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Evaluation Persona
              </label>

              <div className="space-y-2">
                {[
                  {
                    id: 'gemini_ai',
                    title: 'Balanced Precision Match',
                    badge: 'Standard',
                    desc: 'Calibrated weight across mandatory qualifications, tools (PVsyst/AutoCAD), and MW scale experience.'
                  },
                  {
                    id: 'gemini_strict',
                    title: 'Strict Technical Filter',
                    badge: 'Rigorous',
                    desc: 'Zero tolerance for missing technical licenses, statutory certifications, or required years of direct experience.'
                  },
                  {
                    id: 'gemini_holistic',
                    title: 'Holistic Talent Potential',
                    badge: 'Growth',
                    desc: 'Rewards transferable engineering achievements, technical leadership, and renewable energy adaptability.'
                  }
                ].map((mode) => {
                  const isSelected = params.method === mode.id;
                  return (
                    <div
                      key={mode.id}
                      onClick={() => onChange({ ...params, method: mode.id as ScoringMethod })}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{mode.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {mode.badge}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-1.5 leading-snug ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {mode.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Security & Architecture Badge */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Enterprise Privacy Standard</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            CV documents are processed in-memory via secure server-side API proxy. No candidate data is retained on external servers.
          </p>
        </div>
      </div>
    </aside>
  );
};
