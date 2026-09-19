import React from 'react';
import { X, CheckCircle2, AlertCircle, FileText, Award, Sparkles, Activity, Brain } from 'lucide-react';
import { ScoreResult } from '../types';

interface CandidateDetailModalProps {
  candidate: ScoreResult | null;
  onClose: () => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({ candidate, onClose }) => {
  if (!candidate) return null;

  const scorePct = (candidate.score * 100).toFixed(1);

  let tierColor = 'bg-rose-100 text-rose-800 border-rose-200';
  if (candidate.tier === 1) tierColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (candidate.tier === 2) tierColor = 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center font-bold text-base shadow-xs">
              {candidate.candidate_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{candidate.candidate_name}</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  AI Evaluated
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
                {candidate.file_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 font-medium">AI Match Score</span>
              <div className="text-2xl font-bold text-[#1B2A4A] mt-0.5">{scorePct}%</div>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Funnel Tier</span>
              <div className="mt-1">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tierColor}`}>
                  Tier {candidate.tier}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">AI Engine</span>
              <div className="text-xs font-semibold text-[#1B2A4A] mt-1 flex items-center gap-1">
                <Brain className="w-3.5 h-3.5 text-blue-600" />
                {candidate.raw_breakdown?.model || 'Gemini 3.8 Flash'}
              </div>
            </div>
          </div>

          {/* AI Executive Summary */}
          {candidate.executive_summary && (
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/70 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1B2A4A]">
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI Executive Verdict & Candidate Assessment
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{candidate.executive_summary}"
              </p>
            </div>
          )}

          {/* Recommended Next Action */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <div className="p-2 bg-[#1B2A4A] text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Recommended Next Action</span>
              <p className="text-sm font-bold text-[#1B2A4A] mt-0.5">{candidate.next_action}</p>
            </div>
          </div>

          {/* Rationale: Pros & Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Strengths & Core Competencies (Pros)
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {candidate.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Areas to Probe & Skill Gaps (Cons)
              </h4>
              <ul className="space-y-1.5 text-xs text-rose-950">
                {candidate.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Skills Breakdown */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                ✓ AI Verified Matched Skills ({candidate.matched_skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {candidate.matched_skills.length > 0 ? (
                  candidate.matched_skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No direct qualifications matched</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                ✗ Critical Missing Skills / Gaps ({candidate.missing_skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {candidate.missing_skills.length > 0 ? (
                  candidate.missing_skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No missing core requirements</span>
                )}
              </div>
            </div>
          </div>

          {/* Raw Breakdown Details */}
          {candidate.raw_breakdown && Object.keys(candidate.raw_breakdown).length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                AI Evaluation Metadata
              </h4>
              <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-600 space-y-1">
                {Object.entries(candidate.raw_breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-400">{k}:</span>
                    <span className="font-semibold text-slate-800">{Array.isArray(v) ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
