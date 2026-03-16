# AI Website Demo Generator

Orchestration service that automatically generates AI-enabled demo websites for GHLU prospects.

## How It Works

1. Prospect submits website URL through GHL opt-in form
2. GHL triggers webhook to this service
3. Service validates the URL
4. Replit clones the website (browser automation — pending setup)
5. AI chat/voice widgets are injected
6. Demo is deployed with a public URL
7. GHL CRM is updated with the demo link
8. Prospect receives email with their demo

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/demo-request` | Receive GHL form submissions |
| GET | `/status/:jobId` | Get job details + logs |
| GET | `/dashboard` | Visual monitoring dashboard |
| GET | `/health` | Service health check |

## Webhook Payload

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+441234567890",
  "website_url": "https://example.com"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `GHL_API_KEY` | GoHighLevel API key |
| `REPLIT_EMAIL` | Replit login email |
| `REPLIT_PASSWORD` | Replit login password |

## Pipeline Status Values

`queued` → `validating` → `cloning` → `injecting` → `deploying` → `updating_crm` → `emailing` → `completed`

On failure: `failed` (after 2 retries)
Awaiting config: `awaiting_replit`

## Deploy to Railway

```bash
railway login
railway init
railway up
```

The `Procfile` is included for Railway's buildpack.
