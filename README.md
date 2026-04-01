# AI Demo Generator

Automated service that takes a prospect's website URL, generates a premium AI-enhanced version with chat and voice widgets, and delivers it via SMS and email with a personalised site analysis. Built for GHLU.

## How It Works

```
Prospect submits URL via GHL form
        |
        v
  POST /webhook/demo-request
        |
        v
  Job queued in PostgreSQL (polls every 10s)
        |
        v
  1. Validate URL
  2. Scrape website (Puppeteer — JS rendering, screenshot, styles)
  3. Generate enhanced site (Claude Sonnet 4 — two-pass with vision)
     + Generate site analysis (in parallel — issues & improvements)
  4. Inject GHL chat & voice widgets
  5. Download images + store demo in PostgreSQL
  6. Update GHL CRM contact
  7. Send SMS + HTML email with analysis
```

## Project Structure

```
server-postgres.js                 Express app (main entry point)
db-hybrid.js                       Database abstraction — auto-selects PostgreSQL or SQLite
db-postgres.js                     PostgreSQL driver, connection pool, demo_files table
db.js                              SQLite fallback (legacy)
nixpacks.toml                      Railway build config (Chromium deps for Puppeteer)

routes/
  webhook.js                       POST /webhook/demo-request — receives leads
  status.js                        GET /status/:jobId — job details + dashboard
  diagnostic.js                    GET /diagnostic/* — env check, API tests, docs UI

services/
  enhanced-orchestrator.js         Main pipeline — coordinates all steps
  scraper.js                       Puppeteer scraper — JS rendering, screenshot,
                                   computed styles, footer, CTAs
  ai-generator.js                  Claude Sonnet 4 website generation (two-pass
                                   with vision) + site analysis for email/SMS
  injector.js                      Injects GHL chat + voice widget scripts
  deployer-postgres.js             Downloads images, stores demo in PostgreSQL
                                   (falls back to filesystem if no PostgreSQL)
  deployer.js                      Legacy filesystem deployer (SQLite mode only)
  validator.js                     URL reachability check
  ghl.js                           GoHighLevel CRM API (contacts, custom fields)
  email.js                         HTML email with site analysis (issues/improvements)
  sms.js                           SMS with top issue + AI widget mention

queue/
  enhanced-processor-postgres.js   Async job queue processor (PostgreSQL)
  enhanced-processor.js            Legacy sync processor (SQLite)

scripts/
  migrate-to-production.js         Migrates SQLite data + filesystem demos to PostgreSQL
```

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/demo-request` | Receive GHL form submission, create job |
| GET | `/status/:jobId` | Job status, logs, demo URL |
| GET | `/status/dashboard` | Visual monitoring dashboard |
| GET | `/health` | Health check + job stats + backend info |
| GET | `/demo/:slug` | Serve a generated demo site |
| GET | `/diagnostic/docs` | Interactive API docs (browser UI) |
| GET | `/diagnostic/env-check` | Check environment config |
| GET | `/diagnostic/anthropic-test` | Test Anthropic API key + models |
| GET | `/diagnostic/ghl-test` | Test GHL API connection |

## Webhook Payload

The webhook accepts flexible field names from GHL forms:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+441234567890",
  "website_url": "https://example.com",
  "company_name": "Jane's Salon"
}
```

## Database Architecture

### Backend Selection

`db-hybrid.js` auto-selects the backend based on environment:

- `DATABASE_URL` set → **PostgreSQL** (persistent, demos survive deploys)
- `DATABASE_URL` not set → **SQLite** fallback (demos lost on deploy)

### PostgreSQL Tables

| Table | Purpose |
|-------|---------|
| `jobs` | Job metadata — id, status, website_url, demo_url, retry_count, timestamps |
| `job_logs` | Audit trail — step-by-step logs for each job |
| `demo_files` | Demo storage — HTML, CSS, JS, and images stored in the database |
| `demo_url_mappings` | Tracks demo URL history |

### Demo Storage (`demo_files` table)

Demos are stored entirely in the database to survive container restarts:

| Column | Type | Example |
|--------|------|---------|
| `demo_id` | text | `love-nails` |
| `file_path` | text | `index.html` or `images/d168ecf0af.jpg` |
| `content` | text | HTML/CSS/JS content |
| `binary_content` | bytea | Raw image bytes |
| `content_type` | text | `text/html` or `image/jpeg` |

### How Demos Are Saved

1. AI generates HTML → widget scripts injected
2. `deployer-postgres.js` scans HTML for external image URLs
3. Each image is downloaded and stored as **binary (BYTEA)** in `demo_files`
4. HTML `src` attributes rewritten to local paths (`images/{hash}.jpg`)
5. Final HTML stored as text in `demo_files`

### How Demos Are Served

1. `GET /demo/love-nails/` → server queries `getDemoFile('love-nails', 'index.html')`
2. `GET /demo/love-nails/images/abc123.jpg` → queries `getDemoFile('love-nails', 'images/abc123.jpg')`
3. Correct `Content-Type` header set based on stored MIME type
4. Binary content (images) served directly from database

### Scaling Note

Storing images as BYTEA in PostgreSQL works well up to ~100-200 demos. Each demo is roughly 1-5MB (HTML + images). If you start generating at higher volume and notice the database growing large, the next step would be moving images to Cloudflare R2 (free tier, 10GB) and keeping only HTML + metadata in PostgreSQL.

## AI Generation Pipeline

### Scraping (Puppeteer)
- Launches headless Chromium, waits for JS rendering (`networkidle2`)
- Captures viewport screenshot (1280x800, JPEG) — sent to Claude as visual reference
- Extracts computed styles via `getComputedStyle` (fonts, colors from external CSS)
- Extracts headings, sections, images, navigation, footer, CTA buttons
- Falls back to `fetch` + regex if Puppeteer fails

### Generation (Claude Sonnet 4)
- **Pass 1**: Generates complete HTML from scraped content + screenshot (vision)
- **Pass 2** (refinement): Reviews pass 1 output against original data, fixes issues
- System prompt enforces using real content, real images, real contact details
- Images provided as pre-built `<img>` tags at end of prompt (recency bias)
- `max_tokens: 16384` — avoids truncation
- Falls back to OpenAI GPT-4o if Anthropic fails

### Site Analysis (parallel)
- Separate Claude call that returns structured JSON
- Identifies specific issues with the current site
- Lists improvements made in the demo (always includes AI chat + voice widgets)
- Fed into email and SMS for personalised outreach

### Image Handling
- Many sites block hotlinking (403 with foreign Referer header)
- Deployer downloads each external image during deployment
- Images stored as binary in PostgreSQL (or filesystem in SQLite mode)
- HTML rewritten to reference local paths
- Supports extensionless CDN URLs (Google Sites, Cloudinary, etc.)

### Widget Injection
- Scans for `</body>` tag, injects GHL chat + voice widget scripts before it
- `ensureClosingTags()` adds `</body></html>` if AI output was truncated
- `verifyWidgets()` confirms scripts are present after injection
- Pre-deploy log confirms: HTML length, `</body>` present, widget script present

## Notifications

### Email
- Rich HTML email with personalised site analysis
- Red box: issues found on their current site
- Green box: improvements made in the demo
- Purple CTA button linking to the demo
- AI features highlight (chat + voice assistants)
- Falls back to generic email if analysis unavailable

### SMS
- Mentions the top issue found and total issue count
- Links to the demo
- Mentions AI chat and voice assistants

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes* | PostgreSQL connection string (enables persistent storage) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: production) |
| `ANTHROPIC_API_KEY` | Yes** | Anthropic API key (Claude Sonnet 4) |
| `OPENAI_API_KEY` | Yes** | OpenAI API key (GPT-4o fallback) |
| `GHL_API_KEY` | Yes | GoHighLevel API key |
| `GHL_LOCATION_ID` | Yes | GHL location ID for contact management |
| `AI_MODEL` | No | Override model (default: claude-sonnet-4-20250514) |
| `ENABLE_REFINEMENT` | No | Enable two-pass generation (default: true) |
| `PUPPETEER_EXECUTABLE_PATH` | No | Path to system Chromium (Railway) |

*Without `DATABASE_URL`, falls back to SQLite (demos lost on deploy).
**At least one AI provider key is required. Anthropic is primary, OpenAI is fallback.

## Setup

### Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

### Migration from SQLite to PostgreSQL

```bash
# Set DATABASE_URL in your environment, then:
npm run migrate
```

This migrates existing jobs, logs, and filesystem demos into PostgreSQL.

## Deployment (Railway)

The app deploys on Railway via GitHub auto-deploy.

- `nixpacks.toml` provides Chromium system dependencies for Puppeteer
- Environment variables are configured in the Railway dashboard
- Add a Railway PostgreSQL plugin and set `DATABASE_URL` — demos will persist across deploys automatically
- No Railway Volume needed (demos live in the database)

## Job Lifecycle

```
queued → processing → completed (with demo_url)
                   → failed (after 2 retries, with error message)
```

Each step is logged in `job_logs` for debugging.

## Costs Per Demo

| Component | Cost |
|-----------|------|
| Claude Sonnet 4 (generation, 2 passes) | ~$0.10 |
| Claude Sonnet 4 (site analysis) | ~$0.01 |
| GHL SMS | Per your GHL plan |
| GHL Email | Per your GHL plan |
| **Total AI cost** | **~$0.11/demo** |
