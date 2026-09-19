import React, { useState } from 'react';
import { Download, Search, ChevronRight, Filter, Users, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
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
  const [tierFilter, setTierFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (results.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
        <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No Candidates Screened Yet</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Upload a Job Description and candidate resumes, or load the built-in sample data to run the AI screening engine.
        </p>
      </div>
    );
  }

  const tier1Count = results.filter((r) => r.tier === 1).length;
  const tier2Count = results.filter((r) => r.tier === 2).length;
  const tier3Count = results.filter((r) => r.tier === 3).length;
  const avgScore = (results.reduce((acc, r) => acc + r.score, 0) / results.length * 100).toFixed(1);

  const filteredResults = results.filter((r) => {
    if (tierFilter !== 'all' && String(r.tier) !== tierFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.candidate_name.toLowerCase().includes(q) ||
        r.file_name.toLowerCase().includes(q) ||
        r.matched_skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Total Processed</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{results.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Avg match: {avgScore}%</div>
        </div>

        <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span>Tier 1 (Shortlist)</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950 mt-1">{tier1Count}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Interview recommended</div>
        </div>

        <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-amber-800 flex items-center justify-between">
            <span>Tier 2 (Review)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-950 mt-1">{tier2Count}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Tech screen needed</div>
        </div>

        <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-rose-800 flex items-center justify-between">
            <span>Tier 3 (Gaps)</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-950 mt-1">{tier3Count}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Significant skill gaps</div>
        </div>
      </div>

      {/* Control Bar: Filter, Search, and Export */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Tier Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tierFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setTierFilter('1')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tierFilter === '1' ? 'bg-emerald-600 text-white font-semibold' : 'hover:text-emerald-800'
              }`}
            >
              Tier 1 ({tier1Count})
            </button>
            <button
              onClick={() => setTierFilter('2')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tierFilter === '2' ? 'bg-amber-500 text-white font-semibold' : 'hover:text-amber-800'
              }`}
            >
              Tier 2 ({tier2Count})
            </button>
            <button
              onClick={() => setTierFilter('3')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tierFilter === '3' ? 'bg-rose-600 text-white font-semibold' : 'hover:text-rose-800'
              }`}
            >
              Tier 3 ({tier3Count})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-[#1B2A4A] w-48"
            />
          </div>
        </div>

        {/* Excel Export Button */}
        <button
          onClick={onExportExcel}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1B2A4A] hover:bg-[#2E4A6E] active:bg-[#152038] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? 'Generating Report...' : '📥 Download Excel Report'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1B2A4A] text-white font-semibold border-b border-slate-300">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-3">File</th>
                <th className="py-3 px-3 text-center">Score %</th>
                <th className="py-3 px-3 text-center">Tier</th>
                <th className="py-3 px-4">Key Matched Skills</th>
                <th className="py-3 px-4">Missing Skills</th>
                <th className="py-3 px-4">Next Action</th>
                <th className="py-3 px-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredResults.map((r, idx) => {
                let tierBg = 'bg-rose-50 text-rose-800 border-rose-200';
                if (r.tier === 1) tierBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (r.tier === 2) tierBg = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectCandidate(r)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.candidate_name}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[140px]" title={r.file_name}>
                      {r.file_name}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-[#1B2A4A]">
                      {(r.score * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${tierBg}`}>
                        Tier {r.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {r.matched_skills.slice(0, 3).map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-medium border border-emerald-200/60">
                            {s}
                          </span>
                        ))}
                        {r.matched_skills.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-medium">+{r.matched_skills.length - 3}</span>
                        )}
                        {r.matched_skills.length === 0 && <span className="text-slate-400 italic">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {r.missing_skills.slice(0, 3).map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-rose-50 text-rose-800 rounded text-[10px] font-medium border border-rose-200/60">
                            {s}
                          </span>
                        ))}
                        {r.missing_skills.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-medium">+{r.missing_skills.length - 3}</span>
                        )}
                        {r.missing_skills.length === 0 && <span className="text-slate-400 italic">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{r.next_action}</td>
                    <td className="py-3 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
