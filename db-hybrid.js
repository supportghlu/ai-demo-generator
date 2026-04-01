import dotenv from 'dotenv';
dotenv.config();

// Dynamically import based on DATABASE_URL presence
const usePostgres = !!process.env.DATABASE_URL;

let db;
if (usePostgres) {
  console.log('🐘 Using PostgreSQL backend');
  const postgresModule = await import('./db-postgres.js');
  db = postgresModule;
} else {
  console.log('🗄️  Using SQLite backend (legacy)');
  const sqliteModule = await import('./db.js');
  db = sqliteModule;
}

// Re-export all functions
export const {
  createJob,
  updateStatus,
  setDemoUrl,
  setError,
  retryJob,
  getJob,
  getNextQueuedJob,
  getAllJobs,
  getJobStats,
  addLog,
  getJobLogs,
  // PostgreSQL-specific functions (will be undefined for SQLite)
  storeDemoFile,
  getDemoFile,
  getDemoFiles,
  deleteDemoFiles,
  recordDemoView,
  getDemoViewStats,
  getAllDemoViewCounts,
  pool
} = db;

// Feature detection
export const hasFileStorage = usePostgres;
export const backend = usePostgres ? 'postgresql' : 'sqlite';

export default db.default;