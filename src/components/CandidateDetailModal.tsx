import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Award,
  Sparkles,
  Activity,
  Brain,
  Copy,
  Check,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { ScoreResult } from '../types';

interface CandidateDetailModalProps {
  candidate: ScoreResult | null;
  onClose: () => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({ candidate, onClose }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'skills' | 'interview'>('summary');
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!candidate) return null;

  const scorePct = Math.round(candidate.score * 100);

  let tierBadge = {
    label: 'Tier 1 — Fast-Track Shortlist',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500'
  };

  if (candidate.tier === 2) {
    tierBadge = {
      label: 'Tier 2 — Technical Phone Screen',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-500'
    };
  } else if (candidate.tier === 3) {
    tierBadge = {
      label: 'Tier 3 — Significant Gaps / Decline',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-500'
    };
  }

  // Copy candidate dossier to clipboard
  const handleCopyDossier = () => {
    const text = `
SUNJET ENERGY CANDIDATE DOSSIER
Candidate: ${candidate.candidate_name}
File: ${candidate.file_name}
Match Score: ${scorePct}% (Tier ${candidate.tier})
Recommended Action: ${candidate.next_action}

AI EXECUTIVE SUMMARY:
${candidate.executive_summary || 'N/A'}

PROS & STRENGTHS:
${candidate.pros.map((p) => `• ${p}`).join('\n')}

AREAS TO PROBE & GAPS:
${candidate.cons.map((c) => `• ${c}`).join('\n')}

MATCHED SKILLS:
${candidate.matched_skills.join(', ') || 'None'}

MISSING QUALIFICATIONS:
${candidate.missing_skills.join(', ') || 'None'}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate tailored questions to probe the candidate's gaps
  const probeQuestions = candidate.missing_skills.length > 0
    ? candidate.missing_skills.map((skill) => `Can you detail your hands-on experience or project exposure regarding "${skill}"?`)
    : [
        'Could you walk us through the most technically complex MW-scale challenge you solved on your last project?',
        'How do you approach yield optimization and equipment selection when budgets are constrained?'
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            {/* Avatar Initials with score halo */}
            <div className="relative">
              <div className="w-13 h-13 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-md tracking-tight">
                {candidate.candidate_name
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'CV'}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${tierBadge.dot}`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {candidate.candidate_name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
                >
                  {tierBadge.label}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  {candidate.file_name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5 text-sky-600" />
                  {candidate.raw_breakdown?.model || 'Gemini 3.1 Flash-Lite'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDossier}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-colors cursor-pointer"
              title="Copy candidate dossier summary"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Brief</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex px-6 border-b border-slate-100 bg-white gap-6 text-xs font-bold text-slate-500">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            Executive Summary & SWOT
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'skills'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            Technical Qualifications ({candidate.matched_skills.length} Matched)
          </button>
          <button
            onClick={() => setActiveTab('interview')}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'interview'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            Recruiter Playbook & Questions ({probeQuestions.length})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'summary' && (
            <>
              {/* Top Score Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-xl text-slate-900 shadow-2xs font-mono">
                    {scorePct}%
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Overall Match
                    </span>
                    <p className="text-xs font-semibold text-slate-800">
                      {scorePct >= 75 ? 'Strong Technical Alignment' : scorePct >= 50 ? 'Moderate Competency Fit' : 'Significant Experience Gap'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    {candidate.matched_skills.length}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Core Skills Verified
                    </span>
                    <p className="text-xs font-semibold text-slate-800">Directly demonstrated</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm">
                    {candidate.missing_skills.length}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Missing Gaps
                    </span>
                    <p className="text-xs font-semibold text-slate-800">Unverified in resume</p>
                  </div>
                </div>
              </div>

              {/* AI Executive Verdict */}
              {candidate.executive_summary && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    AI Executive Assessment & Verdict
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed italic bg-white/70 p-3 rounded-xl border border-amber-100">
                    "{candidate.executive_summary}"
                  </p>
                </div>
              )}

              {/* Recommended Next Action */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Recruiter Action Plan
                    </span>
                    <div className="text-sm font-bold">{candidate.next_action}</div>
                  </div>
                </div>
                <div className="text-xs font-bold px-3 py-1 bg-white/10 rounded-lg text-slate-200">
                  Tier {candidate.tier} Decision
                </div>
              </div>

              {/* SWOT: Pros & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pros */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified Strengths & Competencies
                  </h4>
                  <ul className="space-y-2 text-xs text-emerald-950">
                    {candidate.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span className="leading-snug">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cons */}
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Critical Gaps & Deficits
                  </h4>
                  <ul className="space-y-2 text-xs text-rose-950">
                    {candidate.cons.map((con, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-600 font-bold mt-0.5">•</span>
                        <span className="leading-snug">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-5">
              {/* Matched Skills */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    AI Verified Matched Qualifications ({candidate.matched_skills.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Demonstrated in CV</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {candidate.matched_skills.length > 0 ? (
                    candidate.matched_skills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No direct skills matched</span>
                  )}
                </div>
              </div>

              {/* Missing Skills */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Missing Required Skills / Licensures ({candidate.missing_skills.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Not found in resume text</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {candidate.missing_skills.length > 0 ? (
                    candidate.missing_skills.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-50 text-rose-900 border border-rose-200 shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-700 font-semibold">
                      ✓ Candidate covers all primary qualifications identified in the job description!
                    </span>
                  )}
                </div>
              </div>

              {/* AI Evidence Quotes if present */}
              {candidate.raw_breakdown?.evidence_quotes &&
                Array.isArray(candidate.raw_breakdown.evidence_quotes) &&
                candidate.raw_breakdown.evidence_quotes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Direct Resume Quotations & Evidence
                    </h4>
                    <div className="space-y-1.5">
                      {candidate.raw_breakdown.evidence_quotes.map((quote: string, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 bg-white rounded-xl border border-blue-100 text-xs text-slate-700 italic font-mono"
                        >
                          "{quote}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <MessageSquare className="w-4 h-4" />
                  Targeted Interview Playbook
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  These questions have been tailored specifically to probe unverified skills and test depth in critical domain areas.
                </p>
              </div>

              <div className="space-y-3">
                {probeQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                      <span>Question #{idx + 1}</span>
                      <span className="text-amber-600 font-mono">Domain Probe</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Candidate ID: <span className="font-mono text-slate-700">{candidate.file_name}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
