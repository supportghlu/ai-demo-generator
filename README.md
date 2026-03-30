# AI Demo Generator

Automated service that takes a prospect's website URL, generates a premium AI-enhanced version with chat and voice widgets, and delivers it via SMS and email. Built for GHLU.

## How It Works

```
Prospect submits URL via GHL form
        |
        v
  POST /webhook/demo-request
        |
        v
  Job queued in SQLite (polls every 10s)
        |
        v
  1. Validate URL
  2. Scrape website (Puppeteer — JS rendering, screenshot, styles)
  3. Generate enhanced site (Claude Sonnet 4 — two-pass with vision)
     + Generate site analysis (in parallel — issues & improvements)
  4. Inject GHL chat & voice widgets
  5. Download images locally (avoids hotlink protection)
  6. Deploy to /demos/{slug}/
  7. Update GHL CRM contact
  8. Send SMS + HTML email with analysis
```

## Project Structure

```
server.js                          Express app, routes, static file serving
db.js                              SQLite setup — jobs + job_logs tables
nixpacks.toml                      Railway build config (Chromium deps)

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
  deployer.js                      Writes demo to disk, downloads images locally,
                                   rewrites HTML to use local image paths
  validator.js                     URL reachability check
  ghl.js                           GoHighLevel CRM API (contacts, custom fields)
  email.js                         HTML email with site analysis (issues/improvements)
  sms.js                           SMS with top issue + AI widget mention

queue/
  enhanced-processor.js            Polls SQLite every 10s, runs orchestrator

demos/                             Generated demo sites (served by Express)
```

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/demo-request` | Receive GHL form submission, create job |
| GET | `/status/:jobId` | Job status, logs, demo URL |
| GET | `/status/dashboard` | Visual monitoring dashboard |
| GET | `/health` | Health check + job stats |
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
- Deployer scans HTML for external image URLs
- Downloads each image locally to `demos/{slug}/images/`
- Rewrites `src` attributes to local paths
- Supports extensionless CDN URLs (Google Sites, Cloudinary, etc.)

### Widget Injection
- Scans for `</body>` tag, injects GHL widget scripts before it
- `ensureClosingTags()` adds `</body></html>` if AI output was truncated
- `verifyWidgets()` confirms scripts are present after injection
- Pre-deploy log confirms: HTML length, `</body>` present, widget script present

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: production) |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key (Claude Sonnet 4) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (GPT-4o fallback) |
| `GHL_API_KEY` | Yes | GoHighLevel API key |
| `GHL_LOCATION_ID` | Yes | GHL location ID for contact management |
| `AI_MODEL` | No | Override model (default: claude-sonnet-4-20250514) |
| `ENABLE_REFINEMENT` | No | Enable two-pass generation (default: true) |
| `PUPPETEER_EXECUTABLE_PATH` | No | Path to system Chromium (Railway) |

*At least one AI provider key is required. Anthropic is primary, OpenAI is fallback.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

## Deployment (Railway)

The app deploys on Railway via GitHub auto-deploy.

- `nixpacks.toml` provides Chromium system dependencies for Puppeteer
- Environment variables are configured in the Railway dashboard
- **Important**: Demos are stored on the filesystem (`/app/demos/`). Without a Railway Volume mounted at `/app/demos`, demos are lost on each deploy. Volumes require the Railway Hobby plan ($5/mo).

## Database

SQLite (`demo-generator.db`, auto-created) with WAL mode:

- **`jobs`** — id, status, website_url, demo_url, error, retry_count, timestamps
- **`job_logs`** — job_id, step, message, timestamp

Job statuses: `queued` → `processing` → `completed` | `failed` (max 2 retries)

## Costs Per Demo

| Component | Cost |
|-----------|------|
| Claude Sonnet 4 (generation, 2 passes) | ~$0.10 |
| Claude Sonnet 4 (analysis) | ~$0.01 |
| GHL SMS | Per your GHL plan |
| GHL Email | Per your GHL plan |
| **Total AI cost** | **~$0.11/demo** |
