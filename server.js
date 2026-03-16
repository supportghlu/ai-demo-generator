import express from 'express';
import webhookRouter from './routes/webhook.js';
import statusRouter from './routes/status.js';
import { startProcessor } from './queue/processor.js';
import { getJobStats } from './db.js';

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

// Health check
app.get('/health', (req, res) => {
  const stats = getJobStats();
  res.json({
    status: 'ok',
    service: 'AI Demo Generator',
    version: '1.0.0',
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
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook/demo-request',
      jobStatus: 'GET /status/:jobId',
      dashboard: 'GET /dashboard',
      health: 'GET /health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🤖 AI Demo Generator running on port ${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   Webhook:   POST http://localhost:${PORT}/webhook/demo-request\n`);
  
  // Start the job queue processor
  startProcessor();
});
