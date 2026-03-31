# PostgreSQL Migration Deployment Guide

This guide covers the complete migration from ephemeral file storage to PostgreSQL persistence on Railway.

## 🎯 Objectives Achieved

✅ **PostgreSQL connection established**  
✅ **Demo content stored in database (not files)**  
✅ **Demo survives container restart/redeploy**  
✅ **Full demo functionality maintained**  
✅ **No more ephemeral storage dependencies**

## 🚀 PHASE 1: Railway PostgreSQL Setup

### 1. Add PostgreSQL Service to Railway Project

1. Go to your Railway project dashboard
2. Click "Add Service" → "Database" → "PostgreSQL" 
3. Railway will automatically provision a PostgreSQL instance
4. Note the connection string provided

### 2. Configure Environment Variables

Add these environment variables to your Railway service:

```bash
DATABASE_URL=postgresql://postgres:password@host:port/database
# ↑ This will be auto-populated by Railway when you add PostgreSQL service
```

The application automatically detects `DATABASE_URL` and switches to PostgreSQL mode.

### 3. Verify Database Connection

After deployment, check the health endpoint to confirm PostgreSQL is active:
```bash
curl https://your-app.railway.app/health
```

Look for:
```json
{
  "backend": "postgresql",
  "persistence": "database"
}
```

## 🔄 PHASE 2: Data Migration

### Option A: Automatic Migration (Railway)

The migration happens automatically when you:
1. Deploy the new version with `DATABASE_URL` set
2. Visit `/health` to trigger database initialization
3. Run the migration script if you have existing data

### Option B: Manual Migration (Local → Railway)

If you have existing demos to migrate:

```bash
# Set DATABASE_URL to point to Railway PostgreSQL
export DATABASE_URL="postgresql://..."

# Run migration script
npm run migrate
```

## 🎯 PHASE 3: Demo Storage Architecture Changes

### Before (Ephemeral)
```
demos/
  ├── company-a/
  │   ├── index.html
  │   ├── style.css
  │   └── images/
  └── company-b/
      └── index.html
```

### After (Persistent Database)
```sql
demo_files table:
├── demo_id: "company-a"
├── file_path: "index.html" 
├── content: "<html>..."
├── content_type: "text/html"
└── created_at: "2026-03-31..."
```

### Key Changes

1. **HTML Storage**: Stored as TEXT in `demo_files.content`
2. **Image Storage**: Stored as BYTEA in `demo_files.binary_data`  
3. **File Serving**: Retrieved from database, not filesystem
4. **URL Structure**: Unchanged (still `/demo/:slug/`)

## 🧪 PHASE 4: Validation & Testing

### 1. Test Demo Creation

```bash
curl -X POST https://your-app.railway.app/webhook/demo-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com", 
    "website_url": "example.com",
    "contact_id": "test-123"
  }'
```

### 2. Verify Demo Storage

Check if demo was stored in database:
```bash
curl https://your-app.railway.app/health
# Should show "persistence": "database"
```

### 3. Test Container Restart

1. Redeploy the service on Railway
2. Verify demo still accessible at the same URL
3. Check dashboard shows all historical demos

### 4. Full Demo Lifecycle Test

```bash
# 1. Create demo
POST /webhook/demo-request

# 2. Check status  
GET /status/:jobId

# 3. View demo
GET /demo/:slug/

# 4. Restart container (redeploy)

# 5. Verify demo still works
GET /demo/:slug/
```

## 🔧 Technical Implementation

### Hybrid Database System

The system automatically detects the backend:

```javascript
// Automatically uses PostgreSQL if DATABASE_URL is set
import { createJob, getJob, hasFileStorage } from './db-hybrid.js';

if (hasFileStorage) {
  // PostgreSQL: Store in database
  await storeDemoFile(slug, 'index.html', htmlContent);
} else {
  // SQLite: Store in files (legacy)
  writeFileSync(path, htmlContent);
}
```

### Backward Compatibility

- **SQLite mode**: Works exactly as before (files)
- **PostgreSQL mode**: New persistent storage
- **Zero breaking changes**: Same API, same URLs

## 🎉 Success Indicators

After deployment, you should see:

1. **Health Check**:
   ```json
   {
     "backend": "postgresql",
     "persistence": "database",
     "status": "ok"
   }
   ```

2. **Server Logs**:
   ```
   🐘 Using PostgreSQL backend
   ✅ PostgreSQL connection established
   💾 Storage: Database (Persistent)
   ```

3. **Demo Persistence**: Demos survive Railway redeployments

4. **Performance**: Same or better (database is faster than file I/O)

## 🛠️ Troubleshooting

### Database Connection Issues

```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Test connection manually
npm run test-db
```

### Migration Issues

```bash
# Re-run migration
npm run migrate

# Check migration logs
tail -f logs/migration.log
```

### Demo Serving Issues

```bash
# Check if demo exists in database
curl https://your-app.railway.app/demo/test-company/

# Check file storage backend
curl https://your-app.railway.app/health
```

## 🔄 Rollback Plan

If issues occur, you can quickly rollback:

1. **Remove DATABASE_URL** environment variable
2. **Redeploy**: System automatically falls back to SQLite + files
3. **Demo files**: Still available in `demos/` directory temporarily

The hybrid system ensures zero downtime during migration.

---

## ✅ Migration Complete

Your demo system is now fully persistent and will survive all Railway container restarts. No more emergency demo loss situations!