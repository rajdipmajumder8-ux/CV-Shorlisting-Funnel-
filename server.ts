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
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB per file
    fieldSize: 20 * 1024 * 1024 // 20MB for text fields like cv_list / jd_text
  }
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
      let jdText = (req.body.jd_text && typeof req.body.jd_text === 'string') ? req.body.jd_text.trim() : '';
      const rawFiles = (req.files as Express.Multer.File[]) || [];
      const cvFilesToProcess: Express.Multer.File[] = [];

      // Check uploaded files for JD vs CVs
      for (const file of rawFiles) {
        const isExplicitCvField = file.fieldname === 'cv_files' || file.fieldname === 'cv' || file.fieldname === 'cvs' || file.fieldname === 'resumes';
        const isExplicitJdField = file.fieldname === 'jd_file' || file.fieldname === 'jd';
        const isJdByName =
          !isExplicitCvField &&
          !jdText &&
          (file.originalname.toLowerCase().includes('job_description') ||
            file.originalname.toLowerCase().startsWith('job_desc') ||
            file.originalname.toLowerCase().startsWith('jd_') ||
            file.originalname.toLowerCase().startsWith('jd-'));

        if (isExplicitJdField || isJdByName) {
          const extractedJd = await extractTextFromBuffer(file.buffer, file.originalname);
          if (extractedJd.trim()) {
            jdText = extractedJd;
          }
        } else {
          cvFilesToProcess.push(file);
        }
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

      // A) Process uploaded binary files (PDF, DOCX, TXT, Images)
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
          } else {
            console.warn(`[screen] No text extracted from candidate file: ${file.originalname}`);
          }
        } catch (err) {
          console.warn(`[screen] Error processing candidate file ${file.originalname}:`, err);
        }
      }

      // B) Process inline/JSON CV list (sample data or client-extracted text)
      const rawCvList = req.body.cv_list || req.body.candidates || req.body.resumes || req.body.cvs;
      if (rawCvList) {
        let cvList: any[] = [];
        if (Array.isArray(rawCvList)) {
          cvList = rawCvList;
        } else if (typeof rawCvList === 'string') {
          try {
            cvList = JSON.parse(rawCvList);
          } catch (e) {
            console.warn('[screen] Failed to parse cv_list JSON string:', e);
          }
        }

        for (const cv of cvList) {
          if (!cv) continue;
          const fileName = cv.name || cv.fileName || 'document.txt';
          // Skip if candidate already added from uploaded binary files
          if (candidatesToScore.some((c) => c.fileName.toLowerCase() === fileName.toLowerCase())) {
            continue;
          }
          const rawContent = cv.content || cv.text || cv.resume || cv.body || cv.cv_text || (typeof cv === 'string' ? cv : '');
          const cvClean = cleanText(rawContent);
          const nameStr = cv.name || cv.candidate_name || cv.candidateName || cv.title || 'Candidate';
          const candidateName = path.parse(nameStr).name.replace(/[-_]/g, ' ');
          if (cvClean.trim()) {
            candidatesToScore.push({
              candidateName,
              fileName,
              content: cvClean
            });
          }
        }
      }

      if (candidatesToScore.length === 0) {
        if (cvFilesToProcess.length > 0) {
          const fileNames = cvFilesToProcess.map((f) => f.originalname).join(', ');
          return res.status(400).json({
            error: `Unable to extract readable text from uploaded CV file(s): ${fileNames}. Please ensure files are valid PDF, DOCX, or text documents.`
          });
        }
        return res.status(400).json({
          error: 'No valid candidate CVs were provided or successfully extracted. Please upload CV files (PDF, DOCX, TXT) or click "Reset Sample Data".'
        });
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

  // Fallback for any unmatched /api routes: ALWAYS return JSON, NEVER let it fall through to Vite HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global server error handler ensuring /api requests always receive structured JSON
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Server error]:', err);
    if (res.headersSent) {
      return next(err);
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
      return res.status(err.status || 500).json({
        error: err?.message || 'Internal server error during API processing'
      });
    }
    next(err);
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunjet Talent Funnel server running on http://0.0.0.0:${PORT}`);
  });

  // Keep-alive timeouts aligned with nginx proxy timeouts
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

// Global safety catchers to prevent process exits on transient errors
process.on('uncaughtException', (err) => {
  console.error('[Process uncaughtException]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process unhandledRejection]:', reason);
});

startServer();
