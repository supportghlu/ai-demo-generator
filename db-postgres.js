import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection established');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

// Create tables if they don't exist
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        website_url TEXT NOT NULL,
        contact_id TEXT,
        company_name TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        demo_url TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        demo_html TEXT,
        demo_assets JSONB
      );
    `);

    // Create job_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_logs (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL,
        step TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );
    `);

    // Create demo_url_mappings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_url_mappings (
        demo_id TEXT PRIMARY KEY,
        legacy_url TEXT,
        persistent_url TEXT NOT NULL,
        redirect_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // Create demo_files table for storing HTML content and assets
    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_files (
        id SERIAL PRIMARY KEY,
        demo_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'text/html',
        is_binary BOOLEAN DEFAULT FALSE,
        binary_data BYTEA,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(demo_id, file_path)
      );
    `);

    // Create demo_views table for link tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_views (
        id SERIAL PRIMARY KEY,
        demo_id TEXT NOT NULL,
        viewed_at TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_demo_views_demo_id ON demo_views(demo_id);
    `);

    // Allow website_url to be NULL (no-website flow)
    await client.query(`ALTER TABLE jobs ALTER COLUMN website_url DROP NOT NULL`).catch(() => {});

    // Add no-website flow columns (safe — IF NOT EXISTS)
    const newCols = [
      ['has_website', 'BOOLEAN DEFAULT TRUE'],
      ['business_type', 'TEXT'],
      ['location', 'TEXT'],
      ['ideal_customers', 'TEXT'],
      ['services_offered', 'TEXT']
    ];
    for (const [col, type] of newCols) {
      await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => {});
    }

    console.log('✅ PostgreSQL tables initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Database operations
export async function createJob(id, name, email, phone, websiteUrl, contactId = null, companyName = null, extras = {}) {
  const now = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO jobs (id, name, email, phone, website_url, contact_id, company_name, status, created_at, updated_at,
        has_website, business_type, location, ideal_customers, services_offered)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9, $10, $11, $12, $13, $14)
    `, [id, name, email, phone, websiteUrl, contactId, companyName, now, now,
        extras.hasWebsite ?? true, extras.businessType || null, extras.location || null,
        extras.idealCustomers || null, extras.servicesOffered || null]);

    const result = await client.query('SELECT * FROM jobs WHERE id = $1', [id]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateStatus(id, status) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE jobs SET status = $1, updated_at = $2 WHERE id = $3
    `, [status, new Date().toISOString(), id]);
  } finally {
    client.release();
  }
}

export async function setDemoUrl(id, demoUrl) {
  const now = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE jobs SET demo_url = $1, status = 'completed', completed_at = $2, updated_at = $3 WHERE id = $4
    `, [demoUrl, now, now, id]);
  } finally {
    client.release();
  }
}

export async function setError(id, message) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE jobs SET status = 'failed', error_message = $1, updated_at = $2 WHERE id = $3
    `, [message, new Date().toISOString(), id]);
  } finally {
    client.release();
  }
}

export async function retryJob(id) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE jobs SET retry_count = retry_count + 1, status = 'queued', updated_at = $1 WHERE id = $2
    `, [new Date().toISOString(), id]);
  } finally {
    client.release();
  }
}

export async function getJob(id) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM jobs WHERE id = $1', [id]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getNextQueuedJob() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
    `);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getAllJobs() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getJobStats() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status NOT IN ('completed', 'failed') THEN 1 ELSE 0 END) as pending
      FROM jobs
    `);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function addLog(jobId, step, message) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO job_logs (job_id, step, message, created_at) VALUES ($1, $2, $3, $4)
    `, [jobId, step, message, new Date().toISOString()]);
  } finally {
    client.release();
  }
}

export async function getJobLogs(jobId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM job_logs WHERE job_id = $1 ORDER BY created_at ASC
    `, [jobId]);
    return result.rows;
  } finally {
    client.release();
  }
}

// Demo file storage functions
export async function storeDemoFile(demoId, filePath, content, contentType = 'text/html', isBinary = false, binaryData = null) {
  const now = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO demo_files (demo_id, file_path, content, content_type, is_binary, binary_data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (demo_id, file_path) 
      DO UPDATE SET content = $3, content_type = $4, is_binary = $5, binary_data = $6, updated_at = $8
    `, [demoId, filePath, content, contentType, isBinary, binaryData, now, now]);
  } finally {
    client.release();
  }
}

export async function getDemoFile(demoId, filePath) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM demo_files WHERE demo_id = $1 AND file_path = $2
    `, [demoId, filePath]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getDemoFiles(demoId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM demo_files WHERE demo_id = $1 ORDER BY file_path
    `, [demoId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function deleteDemoFiles(demoId) {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM demo_files WHERE demo_id = $1`, [demoId]);
  } finally {
    client.release();
  }
}

// --- Demo View Tracking ---

export async function recordDemoView(demoId, ip, userAgent) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO demo_views (demo_id, viewed_at, ip, user_agent) VALUES ($1, $2, $3, $4)`,
      [demoId, new Date().toISOString(), ip || null, userAgent || null]
    );
  } finally {
    client.release();
  }
}

export async function getDemoViewStats(demoId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as total_views, MIN(viewed_at) as first_viewed, MAX(viewed_at) as last_viewed
       FROM demo_views WHERE demo_id = $1`,
      [demoId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getAllDemoViewCounts() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT demo_id, COUNT(*) as views, MIN(viewed_at) as first_viewed
       FROM demo_views GROUP BY demo_id`
    );
    const map = {};
    for (const row of result.rows) {
      map[row.demo_id] = { views: parseInt(row.views), firstViewed: row.first_viewed };
    }
    return map;
  } finally {
    client.release();
  }
}

// Initialize database on import
await testConnection();
await initializeDatabase();

export { pool };