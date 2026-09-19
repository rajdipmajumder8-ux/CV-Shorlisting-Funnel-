import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { cleanText, extractTextFromBuffer } from './server/parsers';
import { scoreCandidatesWithAI, CandidateInput, ScoreOutput } from './server/scoring';
import { buildExcelReportBuffer } from './server/export';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB per file
});

// Safe multer middleware that never throws or falls through into Vite
const safeUpload = (req: Request, res: Response, next: NextFunction) => {
  (upload.any() as any)(req, res, (err: any) => {
    if (err) {
      console.warn('[screen] Multer upload warning:', err?.message || err);
      return res.status(400).json({ error: `File upload error: ${err?.message || 'Upload failed'}` });
    }
    next();
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Health check & Ollama detection
  app.get('/api/health', async (_req: Request, res: Response) => {
    let ollamaAvailable = false;
    let ollamaModels: string[] = [];
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        ollamaAvailable = true;
        const data = (await response.json()) as { models?: { name: string }[] };
        ollamaModels = (data.models || []).map((m) => m.name);
      }
    } catch {
      ollamaAvailable = false;
    }

    res.json({
      status: 'ok',
      ollamaAvailable,
      ollamaModels
    });
  });

  // 2. Screening endpoint (handles both multipart and JSON payloads safely)
  const handleScreening = async (req: Request, res: Response) => {
    try {
      let jdText = '';
      const rawFiles = (req.files as Express.Multer.File[]) || [];
      const cvFilesToProcess: Express.Multer.File[] = [];

      // Check for JD file among uploaded files
      for (const file of rawFiles) {
        if (file.fieldname === 'jd_file' || file.originalname.toLowerCase().includes('job_description') || file.originalname.toLowerCase().includes('jd')) {
          jdText = await extractTextFromBuffer(file.buffer, file.originalname);
        } else {
          cvFilesToProcess.push(file);
        }
      }

      if (!jdText && req.body.jd_text) {
        jdText = req.body.jd_text;
      }

      const cleanedJd = cleanText(jdText);
      if (!cleanedJd.trim()) {
        return res.status(400).json({ error: 'Job description text or file is required.' });
      }

      // Parsing parameters
      const tier1Min = req.body.tier1_min ? parseFloat(req.body.tier1_min) : 0.75;
      const tier2Min = req.body.tier2_min ? parseFloat(req.body.tier2_min) : 0.50;
      const method = req.body.method || 'gemini_ai';
      const topK = req.body.top_k ? parseInt(req.body.top_k, 10) : 10;

      const thresholds = {
        tier1_min: Number.isNaN(tier1Min) ? 0.75 : tier1Min,
        tier2_min: Number.isNaN(tier2Min) ? 0.50 : tier2Min
      };

      const candidatesToScore: CandidateInput[] = [];

      // A) Process uploaded binary files (PDF, DOCX, TXT)
      for (const file of cvFilesToProcess) {
        try {
          const cvRaw = await extractTextFromBuffer(file.buffer, file.originalname);
          const cvClean = cleanText(cvRaw);
          const candidateName = path.parse(file.originalname).name.replace(/[-_]/g, ' ');
          if (cvClean.trim()) {
            candidatesToScore.push({
              candidateName,
              fileName: file.originalname,
              content: cvClean
            });
          }
        } catch (err) {
          console.warn(`[screen] Error processing ${file.originalname}:`, err);
        }
      }

      // B) Process inline/JSON CV list (sample data or client-extracted text)
      if (req.body.cv_list) {
        let cvList: Array<{ name?: string; content?: string }> = [];
        if (Array.isArray(req.body.cv_list)) {
          cvList = req.body.cv_list;
        } else if (typeof req.body.cv_list === 'string') {
          try {
            cvList = JSON.parse(req.body.cv_list);
          } catch (e) {
            console.warn('[screen] Failed to parse cv_list JSON string:', e);
          }
        }

        for (const cv of cvList) {
          const cvClean = cleanText(cv.content || '');
          const candidateName = cv.name ? path.parse(cv.name).name.replace(/[-_]/g, ' ') : 'Candidate';
          if (cvClean.trim()) {
            candidatesToScore.push({
              candidateName,
              fileName: cv.name || 'document.txt',
              content: cvClean
            });
          }
        }
      }

      if (candidatesToScore.length === 0) {
        return res.status(400).json({ error: 'No valid candidate CVs were provided or successfully extracted.' });
      }

      console.log(`[screen] Scoring ${candidatesToScore.length} candidate(s) using Gemini AI...`);
      const results = await scoreCandidatesWithAI(
        cleanedJd,
        candidatesToScore,
        method,
        thresholds,
        topK
      );

      // Sort results descending by score
      results.sort((a, b) => b.score - a.score);

      return res.json({
        success: true,
        count: results.length,
        results
      });
    } catch (err: any) {
      console.error('[screen] Internal error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error during screening' });
    }
  };

  app.post('/api/screen', safeUpload, handleScreening);
  app.post('/api/screen/', safeUpload, handleScreening);

  // 3. Export Excel endpoint
  const handleExport = async (req: Request, res: Response) => {
    try {
      const results: ScoreOutput[] = req.body.results || [];
      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ error: 'No screening results provided for export.' });
      }

      const excelBuffer = await buildExcelReportBuffer(results);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sunjet_talent_funnel_report.xlsx"');
      res.setHeader('Content-Length', excelBuffer.length);
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error('[export] Excel generation error:', err);
      return res.status(500).json({ error: err.message || 'Failed to generate Excel report' });
    }
  };

  app.post('/api/export', handleExport);
  app.post('/api/export/', handleExport);

  // Fallback for any unknown /api/* routes: ALWAYS return JSON, NEVER let it fall through to Vite HTML
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global API error handler ensuring JSON responses
  app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API error]:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  });

  // Vite middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunjet Talent Funnel server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
