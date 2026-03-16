import { Router } from 'express';
import { getJob, getJobLogs, getAllJobs, getJobStats } from '../db.js';

const router = Router();

/**
 * GET /status/:jobId
 * Returns full job details with logs
 */
router.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'error', message: 'Job not found' });
  }

  const logs = getJobLogs(req.params.jobId);
  res.json({ job, logs });
});

/**
 * GET /health
 * Service health check
 */
router.get('/', (req, res) => {
  const stats = getJobStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    jobs: stats
  });
});

/**
 * GET /dashboard
 * Simple HTML dashboard for monitoring
 */
router.get('/dashboard', (req, res) => {
  const jobs = getAllJobs();
  const stats = getJobStats();

  const statusColor = (s) => {
    const colors = {
      completed: '#3fb950', failed: '#f85149', queued: '#6e7681',
      validating: '#58a6ff', cloning: '#58a6ff', injecting: '#58a6ff',
      deploying: '#58a6ff', updating_crm: '#58a6ff', emailing: '#58a6ff',
      awaiting_replit: '#d29922'
    };
    return colors[s] || '#6e7681';
  };

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Demo Generator — Dashboard</title>
<meta http-equiv="refresh" content="30">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0d1117; color: #e6edf3; padding: 32px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: #8b949e; font-size: 14px; margin-bottom: 32px; }
  .stats { display: flex; gap: 16px; margin-bottom: 32px; }
  .stat { background: #1c2128; border: 1px solid #30363d; border-radius: 8px; padding: 16px 24px; flex: 1; }
  .stat-value { font-size: 28px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #8b949e; text-transform: uppercase; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; background: #1c2128; border-radius: 8px; overflow: hidden; border: 1px solid #30363d; }
  th { text-align: left; padding: 12px 16px; background: #161b22; color: #8b949e; font-size: 12px; text-transform: uppercase; }
  td { padding: 12px 16px; border-top: 1px solid #30363d; font-size: 13px; }
  .badge { padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  a { color: #58a6ff; text-decoration: none; }
</style>
</head><body>
<h1>AI Demo Generator 🤖</h1>
<p class="subtitle">Auto-refreshes every 30s</p>
<div class="stats">
  <div class="stat"><div class="stat-value">${stats.total || 0}</div><div class="stat-label">Total Jobs</div></div>
  <div class="stat"><div class="stat-value" style="color:#3fb950">${stats.completed || 0}</div><div class="stat-label">Completed</div></div>
  <div class="stat"><div class="stat-value" style="color:#f85149">${stats.failed || 0}</div><div class="stat-label">Failed</div></div>
  <div class="stat"><div class="stat-value" style="color:#d29922">${stats.pending || 0}</div><div class="stat-label">Pending</div></div>
</div>
<table>
  <tr><th>ID</th><th>Name</th><th>Website</th><th>Status</th><th>Demo URL</th><th>Created</th></tr>
  ${jobs.map(j => `<tr>
    <td><a href="/status/${j.id}">${j.id.slice(0,8)}...</a></td>
    <td>${j.name || '-'}</td>
    <td><a href="${j.website_url}" target="_blank">${j.website_url}</a></td>
    <td><span class="badge" style="background:${statusColor(j.status)}22;color:${statusColor(j.status)}">${j.status}</span></td>
    <td>${j.demo_url ? `<a href="${j.demo_url}" target="_blank">View</a>` : '-'}</td>
    <td>${new Date(j.created_at).toLocaleString('en-GB')}</td>
  </tr>`).join('')}
</table>
</body></html>`;

  res.type('html').send(html);
});

export default router;
