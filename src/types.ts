export interface TierThresholds {
  tier1_min: number; // e.g. 0.75
  tier2_min: number; // e.g. 0.50
}

export interface ScoreResult {
  candidate_name: string;
  file_name: string;
  score: number; // 0.0 - 1.0
  tier: 1 | 2 | 3;
  matched_skills: string[];
  missing_skills: string[];
  pros: string[];
  cons: string[];
  next_action: string;
  executive_summary?: string;
  raw_breakdown: {
    method?: string;
    model?: string;
    similarity?: number;
    vector_shape?: [number, number];
    [key: string]: any;
  };
}

export type ScoringMethod = 'gemini_ai' | 'gemini_strict' | 'gemini_holistic';

export interface ScreeningParams {
  tier1_min: number;
  tier2_min: number;
  method: ScoringMethod;
  top_k: number;
  ollama_model?: string;
}

export interface CandidateCV {
  id: string;
  name: string;
  size: number;
  content?: string;
  file?: File;
  isSample?: boolean;
}
