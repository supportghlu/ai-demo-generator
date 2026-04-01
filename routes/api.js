import { Router } from 'express';
import { getAllJobs, getJobStats } from '../db-hybrid.js';

const router = Router();

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
 * Returns job statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getJobStats();
    res.json({ jobs: stats });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;