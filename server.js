import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import webhookRouter from './routes/webhook.js';
import statusRouter from './routes/status.js';
import { startProcessor } from './queue/processor.js';
import { getJobStats } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = join(__dirname, 'demos');

// Ensure demos directory exists
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

// Routes
app.use('/webhook', webhookRouter);
app.use('/status', statusRouter);

// Serve demo sites — /demo/:slug/file serves static files
app.get('/demo/:slug/*', (req, res) => {
  const slug = req.params.slug;
  const filePath = req.params[0] || 'index.html';
  const fullPath = join(DEMOS_DIR, slug, filePath);
  
  if (existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  res.status(404).json({ error: 'File not found' });
});

// Serve demo index — /demo/:slug
app.get('/demo/:slug', (req, res) => {
  const slug = req.params.slug;
  const indexPath = join(DEMOS_DIR, slug, 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).json({ error: 'Demo not found', slug });
});

// Health check
app.get('/health', (req, res) => {
  const stats = getJobStats();
  res.json({
    status: 'ok',
    service: 'AI Demo Generator',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    jobs: stats
  });
});

// Dashboard redirect
app.get('/dashboard', (req, res) => res.redirect('/status/dashboard'));

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'AI Demo Generator',
    version: '2.0.0',
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
  console.log(`\n🤖 AI Demo Generator v2.0 running on port ${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   Webhook:   POST http://localhost:${PORT}/webhook/demo-request`);
  console.log(`   Demos:     http://localhost:${PORT}/demo/:slug\n`);
  
  // Start the job queue processor
  startProcessor();
});
