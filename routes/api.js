import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAllJobs, getJobStats, getJob, getJobLogs, retryJob, deleteDemoFiles, createJob, addLog, pool, hasFileStorage } from '../db-hybrid.js';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Set();

/**
 * GET /api/jobs
 * Returns all jobs for the dashboard
 */
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await getAllJobs();
    res.json(jobs);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * GET /api/stats
 * Returns comprehensive job statistics with real data
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getJobStats();
    let todayCompleted = 0;
    let avgGenerationTime = 0;

    // Extended stats from PostgreSQL
    if (pool) {
      try {
        const client = await pool.connect();
        try {
          const todayResult = await client.query(
            `SELECT COUNT(*) as count FROM jobs WHERE status = 'completed' AND created_at >= (NOW() - INTERVAL '24 hours')`
          );
          todayCompleted = parseInt(todayResult.rows[0]?.count) || 0;

          const avgResult = await client.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (updated_at::timestamp - created_at::timestamp))) as avg_seconds
             FROM jobs WHERE status = 'completed'`
          );
          avgGenerationTime = Math.round(parseFloat(avgResult.rows[0]?.avg_seconds) || 0);
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.error('[api] Extended stats query failed:', pgErr.message);
      }
    }

    res.json({
      jobs: stats,
      todayCompleted,
      avgGenerationTime
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/jobs/:jobId
 * Returns job details with logs
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const logs = await getJobLogs(req.params.jobId);
    res.json({ job, logs });
  } catch (error) {
    console.error('Failed to fetch job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * POST /api/jobs/:jobId/retry
 * Retry a failed job
 */
router.post('/jobs/:jobId/retry', async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed jobs can be retried' });
    }
    await retryJob(req.params.jobId);
    broadcastSSE({ type: 'job_updated', jobId: req.params.jobId });
    res.json({ success: true, message: 'Job queued for retry' });
  } catch (error) {
    console.error('Failed to retry job:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

/**
 * DELETE /api/jobs/:jobId/demo
 * Delete a demo's files from the database
 */
router.delete('/jobs/:jobId/demo', async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!job.demo_url) {
      return res.status(400).json({ error: 'No demo associated with this job' });
    }
    // Extract slug from demo URL
    const slug = job.demo_url.split('/demo/').pop()?.replace(/\/$/, '');
    if (slug && hasFileStorage && deleteDemoFiles) {
      await deleteDemoFiles(slug);
      res.json({ success: true, message: `Demo '${slug}' deleted` });
    } else {
      res.status(400).json({ error: 'Demo deletion not available' });
    }
  } catch (error) {
    console.error('Failed to delete demo:', error);
    res.status(500).json({ error: 'Failed to delete demo' });
  }
});

/**
 * POST /api/demo/generate
 * Quick demo generation from dashboard — no email/SMS/CRM
 */
router.post('/demo/generate', async (req, res) => {
  try {
    const { website_url, company_name } = req.body;

    if (!website_url) {
      return res.status(400).json({ error: 'website_url is required' });
    }

    let normalizedUrl = website_url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const jobId = uuidv4();
    // No email/phone/contactId — orchestrator will skip notifications
    await createJob(jobId, company_name || 'Quick Demo', null, null, normalizedUrl, null, company_name || null);
    await addLog(jobId, 'created', `Quick demo from dashboard for ${normalizedUrl}`);

    console.log(`[api] Quick demo job ${jobId} created for ${normalizedUrl}`);
    broadcastSSE({ type: 'job_created', jobId });

    res.json({ success: true, jobId });
  } catch (error) {
    console.error('Failed to create quick demo:', error);
    res.status(500).json({ error: 'Failed to create demo job' });
  }
});

/**
 * GET /api/events
 * Server-Sent Events stream for real-time dashboard updates
 */
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  sseClients.add(res);
  console.log(`[sse] Client connected (${sseClients.size} total)`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[sse] Client disconnected (${sseClients.size} total)`);
  });
});

/**
 * Broadcast an event to all SSE clients
 */
export function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

export default router;
