#!/usr/bin/env node
/**
 * COMPLETE POSTGRES MIGRATION: Migrate SQLite data & demo files to PostgreSQL
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'demo-generator.db');
const demosPath = join(__dirname, '..', 'demos');

console.log('🚀 COMPLETE POSTGRES MIGRATION: Starting...');

async function migrateToPostgres() {
  // Test SQLite first
  console.log('📊 Testing SQLite source database...');
  const sqlite = new Database(dbPath, { readonly: true });
  
  // PostgreSQL connection
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set!');
    return { success: false, error: 'DATABASE_URL not configured' };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  let pgClient;
  try {
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    pgClient = await pool.connect();
    console.log('✅ PostgreSQL connected');

    // Create tables
    console.log('🏗️  Creating PostgreSQL tables...');
    
    await pgClient.query(`
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

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS job_logs (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL,
        step TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS demo_url_mappings (
        demo_id TEXT PRIMARY KEY,
        legacy_url TEXT,
        persistent_url TEXT NOT NULL,
        redirect_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    await pgClient.query(`
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

    // Migrate jobs
    console.log('📋 Migrating jobs...');
    const jobs = sqlite.prepare('SELECT * FROM jobs').all();
    for (const job of jobs) {
      await pgClient.query(`
        INSERT INTO jobs (id, name, email, phone, website_url, contact_id, company_name, status, demo_url, error_message, retry_count, created_at, updated_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
        name = $2, email = $3, phone = $4, website_url = $5, contact_id = $6, company_name = $7,
        status = $8, demo_url = $9, error_message = $10, retry_count = $11, updated_at = $13, completed_at = $14
      `, [job.id, job.name, job.email, job.phone, job.website_url, job.contact_id, job.company_name, 
          job.status, job.demo_url, job.error_message, job.retry_count, job.created_at, job.updated_at, job.completed_at]);
    }

    // Migrate job_logs
    console.log('📝 Migrating job logs...');
    const logs = sqlite.prepare('SELECT * FROM job_logs').all();
    for (const log of logs) {
      await pgClient.query(`
        INSERT INTO job_logs (job_id, step, message, created_at) VALUES ($1, $2, $3, $4)
      `, [log.job_id, log.step, log.message, log.created_at]);
    }

    // Migrate demo_url_mappings
    console.log('🔗 Migrating URL mappings...');
    const mappings = sqlite.prepare('SELECT * FROM demo_url_mappings').all();
    for (const mapping of mappings) {
      await pgClient.query(`
        INSERT INTO demo_url_mappings (demo_id, legacy_url, persistent_url, redirect_count, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (demo_id) DO UPDATE SET
        legacy_url = $2, persistent_url = $3, redirect_count = $4
      `, [mapping.demo_id, mapping.legacy_url, mapping.persistent_url, mapping.redirect_count, mapping.created_at]);
    }

    // Migrate demo files
    console.log('📁 Migrating demo files...');
    let filesProcessed = 0;
    
    if (existsSync(demosPath)) {
      const demoDirs = readdirSync(demosPath).filter(item => {
        const fullPath = join(demosPath, item);
        return statSync(fullPath).isDirectory();
      });

      for (const demoId of demoDirs) {
        const demoDir = join(demosPath, demoId);
        const files = getAllFiles(demoDir, demoDir);
        
        for (const file of files) {
          const relativePath = file.path.replace(demoDir + '/', '');
          const content = readFileSync(file.fullPath, 'utf8');
          const contentType = getContentType(file.path);
          const now = new Date().toISOString();
          
          await pgClient.query(`
            INSERT INTO demo_files (demo_id, file_path, content, content_type, is_binary, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (demo_id, file_path) DO UPDATE SET
            content = $3, content_type = $4, updated_at = $7
          `, [demoId, relativePath, content, contentType, false, now, now]);
          
          filesProcessed++;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    
    return {
      success: true,
      stats: {
        totalJobs: jobs.length,
        totalLogs: logs.length,
        urlMappings: mappings.length,
        filesProcessed: filesProcessed,
        demoDirs: existsSync(demosPath) ? readdirSync(demosPath).filter(item => statSync(join(demosPath, item)).isDirectory()).length : 0
      }
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    sqlite.close();
    if (pgClient) pgClient.release();
    await pool.end();
  }
}

function getAllFiles(dir, baseDir) {
  const files = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push({
        path: fullPath,
        fullPath: fullPath
      });
    }
  }
  
  return files;
}

function getContentType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const types = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'txt': 'text/plain'
  };
  return types[ext] || 'application/octet-stream';
}

// Run migration
migrateToProd().then(result => {
  if (result.success) {
    console.log('🎯 POSTGRES MIGRATION COMPLETE!');
    console.log('📊 Migration Stats:', result.stats);
    console.log('✅ Ready to switch to PostgreSQL backend');
  } else {
    console.error('❌ Migration failed:', result.error);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});