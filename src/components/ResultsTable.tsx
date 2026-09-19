import React, { useState } from 'react';
import {
  Download,
  Search,
  ChevronRight,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  LayoutGrid,
  Table as TableIcon,
  Grid3X3,
  ArrowUpDown,
  Sparkles,
  Award,
  FileSpreadsheet,
  Layers,
  FileText
} from 'lucide-react';
import { ScoreResult } from '../types';

interface ResultsTableProps {
  results: ScoreResult[];
  onSelectCandidate: (candidate: ScoreResult) => void;
  onExportExcel: () => void;
  isExporting: boolean;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  onSelectCandidate,
  onExportExcel,
  isExporting
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'matrix'>('kanban');
  const [tierFilter, setTierFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name' | 'skills'>('score_desc');

  if (results.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-3 shadow-2xs">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Users className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">No Candidates Evaluated Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Upload Job Description and candidate resumes above, or click <span className="font-semibold text-slate-700">"Reset Sample Data"</span> to screen with the Gemini AI engine.
          </p>
        </div>
      </div>
    );
  }

  const tier1Candidates = results.filter((r) => r.tier === 1);
  const tier2Candidates = results.filter((r) => r.tier === 2);
  const tier3Candidates = results.filter((r) => r.tier === 3);

  const tier1Count = tier1Candidates.length;
  const tier2Count = tier2Candidates.length;
  const tier3Count = tier3Candidates.length;
  const avgScore = Math.round((results.reduce((acc, r) => acc + r.score, 0) / results.length) * 100);

  // Filter
  let filtered = results.filter((r) => {
    if (tierFilter !== 'all' && String(r.tier) !== tierFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.candidate_name.toLowerCase().includes(q) ||
        r.file_name.toLowerCase().includes(q) ||
        r.matched_skills.some((s) => s.toLowerCase().includes(q)) ||
        r.missing_skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'score_desc') return b.score - a.score;
    if (sortBy === 'score_asc') return a.score - b.score;
    if (sortBy === 'name') return a.candidate_name.localeCompare(b.candidate_name);
    if (sortBy === 'skills') return b.matched_skills.length - a.matched_skills.length;
    return 0;
  });

  // Collect all unique skills for Matrix View
  const allUniqueSkills = Array.from(
    new Set(results.flatMap((r) => [...r.matched_skills, ...r.missing_skills]))
  ).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Top Bento KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Processed */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Processed</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            {results.length}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Avg Match:</span>
            <span className="font-bold text-slate-800 font-mono">{avgScore}%</span>
          </div>
        </div>

        {/* Tier 1 Shortlist */}
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span>Tier 1 Shortlist</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950 tracking-tight font-mono">
            {tier1Count}
          </div>
          <div className="text-[11px] text-emerald-700">
            {results.length > 0 ? Math.round((tier1Count / results.length) * 100) : 0}% interview pass rate
          </div>
        </div>

        {/* Tier 2 Review */}
        <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span>Tier 2 Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-950 tracking-tight font-mono">
            {tier2Count}
          </div>
          <div className="text-[11px] text-amber-700">Recruiter phone screen</div>
        </div>

        {/* Tier 3 Decline */}
        <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 uppercase tracking-wider">
            <span>Tier 3 Deficit</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-950 tracking-tight font-mono">
            {tier3Count}
          </div>
          <div className="text-[11px] text-rose-700">Significant qualifications gap</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sort, View Modes, Excel Export */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: Filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tier Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                tierFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setTierFilter('1')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                tierFilter === '1'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Tier 1 ({tier1Count})
            </button>
            <button
              onClick={() => setTierFilter('2')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                tierFilter === '2'
                  ? 'bg-amber-500 text-white font-bold shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Tier 2 ({tier2Count})
            </button>
            <button
              onClick={() => setTierFilter('3')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                tierFilter === '3'
                  ? 'bg-rose-600 text-white font-bold shadow-2xs'
                  : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              Tier 3 ({tier3Count})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, skill, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-slate-900 focus:bg-white w-52 transition-all"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold rounded-xl px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
            >
              <option value="score_desc">Highest Match %</option>
              <option value="score_asc">Lowest Match %</option>
              <option value="name">Name (A–Z)</option>
              <option value="skills">Most Skills Matched</option>
            </select>
          </div>
        </div>

        {/* Right: View Mode Toggle & Excel Export */}
        <div className="flex items-center gap-2">
          {/* View Mode Switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Kanban Pipeline Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Data Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Skill Matrix Comparison"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          {/* Export to Excel */}
          <button
            onClick={onExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: KANBAN PIPELINE BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: Tier 1 */}
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Tier 1 — Fast-Track Shortlist
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-900">
                {tier1Candidates.length}
              </span>
            </div>

            <div className="space-y-3">
              {tier1Candidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No Tier 1 candidates at current threshold.
                </div>
              ) : (
                tier1Candidates.map((candidate) => (
                  <KanbanCard
                    key={candidate.file_name}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Tier 2 */}
          <div className="space-y-3">
            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Tier 2 — Technical Review
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-amber-200 text-amber-900">
                {tier2Candidates.length}
              </span>
            </div>

            <div className="space-y-3">
              {tier2Candidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No candidates currently in Tier 2.
                </div>
              ) : (
                tier2Candidates.map((candidate) => (
                  <KanbanCard
                    key={candidate.file_name}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Tier 3 */}
          <div className="space-y-3">
            <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                  Tier 3 — Significant Gaps
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-rose-200 text-rose-900">
                {tier3Candidates.length}
              </span>
            </div>

            <div className="space-y-3">
              {tier3Candidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No candidates in Tier 3.
                </div>
              ) : (
                tier3Candidates.map((candidate) => (
                  <KanbanCard
                    key={candidate.file_name}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Candidate & Resume</th>
                  <th className="py-3.5 px-4 text-center">Match Score</th>
                  <th className="py-3.5 px-4 text-center">Funnel Tier</th>
                  <th className="py-3.5 px-4">AI Verified Skills</th>
                  <th className="py-3.5 px-4">Recommended Action</th>
                  <th className="py-3.5 px-4 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((candidate) => {
                  const scorePct = Math.round(candidate.score * 100);
                  return (
                    <tr
                      key={candidate.file_name}
                      onClick={() => onSelectCandidate(candidate)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Candidate Name & File */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-slate-950 text-xs">
                          {candidate.candidate_name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                          <FileText className="w-3 h-3 text-slate-300" />
                          {candidate.file_name}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono font-bold text-xs">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              candidate.tier === 1
                                ? 'bg-emerald-500'
                                : candidate.tier === 2
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-slate-900">{scorePct}%</span>
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            candidate.tier === 1
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : candidate.tier === 2
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          Tier {candidate.tier}
                        </span>
                      </td>

                      {/* Matched Skills */}
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="flex flex-wrap gap-1">
                          {candidate.matched_skills.slice(0, 3).map((skill, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.matched_skills.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{candidate.matched_skills.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Recommended Action */}
                      <td className="py-3 px-4 font-semibold text-slate-700 text-xs">
                        {candidate.next_action}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidate(candidate);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: SKILL COMPARISON MATRIX */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cross-Candidate Skills Matrix
              </h4>
              <p className="text-[11px] text-slate-500">
                Direct side-by-side verification of required competencies across candidates
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified in CV
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                Gap / Not Found
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10">Candidate</th>
                  <th className="py-3 px-3 text-center">Match</th>
                  {allUniqueSkills.map((skill, idx) => (
                    <th key={idx} className="py-3 px-3 text-center max-w-[120px] truncate" title={skill}>
                      {skill}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((candidate) => (
                  <tr
                    key={candidate.file_name}
                    onClick={() => onSelectCandidate(candidate)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white">
                      {candidate.candidate_name}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-xs">
                      {Math.round(candidate.score * 100)}%
                    </td>
                    {allUniqueSkills.map((skill, idx) => {
                      const hasSkill = candidate.matched_skills.some(
                        (s) => s.toLowerCase() === skill.toLowerCase()
                      );
                      return (
                        <td key={idx} className="py-3 px-3 text-center">
                          {hasSkill ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-400 font-bold text-xs">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual Kanban cards
const KanbanCard: React.FC<{ candidate: ScoreResult; onSelect: () => void }> = ({
  candidate,
  onSelect
}) => {
  const scorePct = Math.round(candidate.score * 100);

  return (
    <div
      onClick={onSelect}
      className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer space-y-3 group"
    >
      {/* Card Header: Avatar & Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {candidate.candidate_name
              .split(' ')
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="truncate">
            <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-slate-950">
              {candidate.candidate_name}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono truncate block">
              {candidate.file_name}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span
            className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
              candidate.tier === 1
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : candidate.tier === 2
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {scorePct}%
          </span>
        </div>
      </div>

      {/* Pro highlight snippet */}
      {candidate.pros.length > 0 && (
        <div className="p-2 bg-slate-50 rounded-xl text-[11px] text-slate-600 leading-snug line-clamp-2 italic">
          "{candidate.pros[0]}"
        </div>
      )}

      {/* Matched Skills Chips */}
      <div className="flex flex-wrap gap-1">
        {candidate.matched_skills.slice(0, 3).map((skill, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
          >
            {skill}
          </span>
        ))}
        {candidate.matched_skills.length > 3 && (
          <span className="text-[10px] text-slate-400 self-center">
            +{candidate.matched_skills.length - 3}
          </span>
        )}
      </div>

      {/* Next Action Footnote */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700 truncate max-w-[180px]">
          {candidate.next_action}
        </span>
        <span className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
};
