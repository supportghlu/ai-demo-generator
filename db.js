import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'demo-generator.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    website_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    demo_url TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    step TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );
`);

// Prepared statements
const stmts = {
  insertJob: db.prepare(`
    INSERT INTO jobs (id, name, email, phone, website_url, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
  `),

  updateJobStatus: db.prepare(`
    UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?
  `),

  updateJobDemoUrl: db.prepare(`
    UPDATE jobs SET demo_url = ?, status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?
  `),

  updateJobError: db.prepare(`
    UPDATE jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?
  `),

  incrementRetry: db.prepare(`
    UPDATE jobs SET retry_count = retry_count + 1, status = 'queued', updated_at = ? WHERE id = ?
  `),

  getJob: db.prepare(`SELECT * FROM jobs WHERE id = ?`),

  getQueuedJobs: db.prepare(`
    SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
  `),

  getAllJobs: db.prepare(`
    SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50
  `),

  getJobStats: db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status NOT IN ('completed', 'failed') THEN 1 ELSE 0 END) as pending
    FROM jobs
  `),

  insertLog: db.prepare(`
    INSERT INTO job_logs (job_id, step, message, created_at) VALUES (?, ?, ?, ?)
  `),

  getJobLogs: db.prepare(`
    SELECT * FROM job_logs WHERE job_id = ? ORDER BY created_at ASC
  `)
};

export function createJob(id, name, email, phone, websiteUrl) {
  const now = new Date().toISOString();
  stmts.insertJob.run(id, name, email, phone, websiteUrl, now, now);
  return stmts.getJob.get(id);
}

export function updateStatus(id, status) {
  stmts.updateJobStatus.run(status, new Date().toISOString(), id);
}

export function setDemoUrl(id, demoUrl) {
  const now = new Date().toISOString();
  stmts.updateJobDemoUrl.run(demoUrl, now, now, id);
}

export function setError(id, message) {
  stmts.updateJobError.run(message, new Date().toISOString(), id);
}

export function retryJob(id) {
  stmts.incrementRetry.run(new Date().toISOString(), id);
}

export function getJob(id) {
  return stmts.getJob.get(id);
}

export function getNextQueuedJob() {
  return stmts.getQueuedJobs.get();
}

export function getAllJobs() {
  return stmts.getAllJobs.all();
}

export function getJobStats() {
  return stmts.getJobStats.get();
}

export function addLog(jobId, step, message) {
  stmts.insertLog.run(jobId, step, message, new Date().toISOString());
}

export function getJobLogs(jobId) {
  return stmts.getJobLogs.all(jobId);
}

export default db;
