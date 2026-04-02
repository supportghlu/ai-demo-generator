import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Import hybrid database module
import {
  getJobStats, hasFileStorage, backend,
  getDemoFile, getDemoFiles, recordDemoView
} from './db-hybrid.js';

import webhookRouter from './routes/webhook.js';
import statusRouter from './routes/status.js';
import diagnosticRouter from './routes/diagnostic.js';
import apiRouter from './routes/api.js';
import { startEnhancedProcessor, getProcessorStats } from './queue/enhanced-processor-postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = join(__dirname, 'demos');

// Ensure demos directory exists (for fallback/local dev)
if (!existsSync(DEMOS_DIR)) {
  mkdirSync(DEMOS_DIR, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Static files
app.use(express.static(join(__dirname, 'public')));

// Routes
app.use('/webhook', webhookRouter);
app.use('/status', statusRouter);
app.use('/diagnostic', diagnosticRouter);
app.use('/api', apiRouter);

// Track demo page views (only for index.html, not assets)
async function trackView(slug, filePath, req) {
  if ((!filePath || filePath === 'index.html') && recordDemoView) {
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      await recordDemoView(slug, ip, req.headers['user-agent']);
    } catch {}
  }
}

// Database-based demo serving (PostgreSQL)
async function serveDemoFromDatabase(slug, filePath, res) {
  try {
    const demoFile = await getDemoFile(slug, filePath || 'index.html');
    
    if (!demoFile) {
      return res.status(404).json({ error: 'File not found', slug, filePath });
    }

    // Set appropriate content type
    res.set('Content-Type', demoFile.content_type || 'text/html');
    
    if (demoFile.is_binary && demoFile.binary_data) {
      res.send(Buffer.from(demoFile.binary_data));
    } else if (demoFile.content) {
      res.send(demoFile.content);
    } else {
      res.status(404).json({ error: 'File content not found' });
    }
  } catch (error) {
    console.error('Database demo serving error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

// File-based demo serving (SQLite/legacy)
function serveDemoFromFiles(slug, filePath, res) {
  const fullPath = join(DEMOS_DIR, slug, filePath || 'index.html');
  
  if (existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  res.status(404).json({ error: 'File not found' });
}

// Serve demo sites — /demo/:slug/file serves static files
app.get('/demo/:slug/*', async (req, res) => {
  const slug = req.params.slug;
  const filePath = req.params[0] || 'index.html';
  trackView(slug, filePath, req);

  if (hasFileStorage) {
    await serveDemoFromDatabase(slug, filePath, res);
  } else {
    serveDemoFromFiles(slug, filePath, res);
  }
});

// Serve demo index — /demo/:slug (redirect to ensure trailing slash)
app.get('/demo/:slug', async (req, res) => {
  const slug = req.params.slug;
  // Don't track here — the redirect to /demo/:slug/ will track via the /* route

  if (hasFileStorage) {
    // Check if demo exists in database
    try {
      const indexFile = await getDemoFile(slug, 'index.html');
      if (indexFile) {
        // Redirect to ensure trailing slash for proper relative path resolution
        if (!req.path.endsWith('/')) {
          return res.redirect(301, req.path + '/');
        }
        
        res.set('Content-Type', 'text/html');
        return res.send(indexFile.content);
      }
    } catch (error) {
      console.error('Database demo check error:', error);
    }
  } else {
    // File-based check
    const indexPath = join(DEMOS_DIR, slug, 'index.html');
    if (existsSync(indexPath)) {
      if (!req.path.endsWith('/')) {
        return res.redirect(301, req.path + '/');
      }
      return res.sendFile(indexPath);
    }
  }
  
  res.status(404).json({ error: 'Demo not found', slug });
});

// Health check
app.get('/health', async (req, res) => {
  const jobStats = await getJobStats();
  const processorStats = getProcessorStats();
  res.json({
    status: 'ok',
    service: 'AI Demo Generator Enhanced',
    version: '4.0.0',
    uptime: Math.floor(process.uptime()),
    backend: backend,
    persistence: hasFileStorage ? 'database' : 'ephemeral-files',
    jobs: jobStats,
    processor: processorStats
  });
});

// Enhanced dashboard (direct serve)
app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'monitoring-dashboard.html'));
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'AI Demo Generator Enhanced',
    version: '4.0.0',
    backend: backend,
    persistence: hasFileStorage ? 'database' : 'ephemeral-files',
    features: [
      'Industry Analysis & Optimization',
      'Conversion-Focused Website Generation', 
      'AI Widget Integration',
      'CRM & Email Automation',
      hasFileStorage ? 'Persistent Demo Storage' : 'Ephemeral Demo Storage'
    ],
    endpoints: {
      webhook: 'POST /webhook/demo-request',
      jobStatus: 'GET /status/:jobId',
      dashboard: 'GET /dashboard',
      demo: 'GET /demo/:slug',
      health: 'GET /health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 AI Demo Generator Enhanced v4.0 running on port ${PORT}`);
  console.log(`   ✨ Backend: ${backend.toUpperCase()}`);
  console.log(`   💾 Storage: ${hasFileStorage ? 'Database (Persistent)' : 'Files (Ephemeral)'}`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   Webhook:   POST http://localhost:${PORT}/webhook/demo-request`);
  console.log(`   Demos:     http://localhost:${PORT}/demo/:slug\n`);
  
  // Start the enhanced job queue processor
  console.log('🔄 Starting Enhanced Queue Processor...');
  startEnhancedProcessor();
});

console.log('Deployment timestamp:', new Date().toISOString());