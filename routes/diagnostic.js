/**
 * Diagnostic Routes - Environment and API Testing
 */

import express from 'express';
const router = express.Router();

/**
 * Environment Diagnostic Endpoint
 * Shows configuration status without exposing sensitive data
 */
router.get('/env-check', (req, res) => {
  const config = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    ghlApiKey: process.env.GHL_API_KEY ? 
      `${process.env.GHL_API_KEY.substring(0, 8)}...` : 'NOT SET',
    ghlLocationId: process.env.GHL_LOCATION_ID || 'NOT SET',
    openaiApiKey: process.env.OPENAI_API_KEY ? 
      `${process.env.OPENAI_API_KEY.substring(0, 8)}...` : 'NOT SET',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? 
      `${process.env.ANTHROPIC_API_KEY.substring(0, 8)}...` : 'NOT SET',
    aiModel: process.env.AI_MODEL || 'NOT SET',
    useOpenclaw: process.env.USE_OPENCLAW || 'NOT SET'
  };

  // Check critical configs
  const issues = [];
  if (!process.env.GHL_API_KEY) issues.push('GHL_API_KEY missing');
  if (!process.env.GHL_LOCATION_ID) issues.push('GHL_LOCATION_ID missing');
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    issues.push('No AI API keys configured');
  }

  res.json({
    status: issues.length === 0 ? 'OK' : 'CONFIGURATION ISSUES',
    config,
    issues,
    message: issues.length === 0 ? 
      'All critical environment variables configured' :
      'Missing required environment variables for full functionality'
  });
});

/**
 * Quick GHL API Test
 */
router.get('/ghl-test', async (req, res) => {
  try {
    if (!process.env.GHL_API_KEY) {
      return res.json({
        status: 'ERROR',
        message: 'GHL_API_KEY not configured'
      });
    }

    if (!process.env.GHL_LOCATION_ID) {
      return res.json({
        status: 'ERROR',
        message: 'GHL_LOCATION_ID not configured'
      });
    }

    // Test basic API connection
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        status: 'SUCCESS',
        message: 'GHL API authentication working',
        contactCount: data.contacts?.length || 0
      });
    } else {
      const errorText = await response.text();
      res.json({
        status: 'ERROR',
        message: `GHL API failed (${response.status}): ${errorText}`,
        httpStatus: response.status
      });
    }

  } catch (error) {
    res.json({
      status: 'ERROR',
      message: `GHL API test failed: ${error.message}`
    });
  }
});

/**
 * Quick Anthropic API Test — tests key validity and model access
 */
router.get('/anthropic-test', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ status: 'ERROR', message: 'ANTHROPIC_API_KEY not configured' });
    }

    const models = ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'];
    const results = [];

    for (const model of models) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          results.push({ model, status: 'OK', output: data.content?.[0]?.text });
        } else {
          const errText = await response.text();
          results.push({ model, status: `FAIL (${response.status})`, error: errText.substring(0, 200) });
        }
      } catch (err) {
        results.push({ model, status: 'ERROR', error: err.message });
      }
    }

    res.json({
      status: results.some(r => r.status === 'OK') ? 'PARTIAL_SUCCESS' : 'ALL_FAILED',
      keyPrefix: process.env.ANTHROPIC_API_KEY.substring(0, 12) + '...',
      results
    });
  } catch (error) {
    res.json({ status: 'ERROR', message: error.message });
  }
});

/**
 * API Docs — interactive browser UI for all endpoints
 */
router.get('/docs', (req, res) => {
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Demo Generator — API Docs</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e4e4e7; line-height: 1.6; }
  .container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h1 span { color: #818cf8; }
  .subtitle { color: #71717a; margin-bottom: 2rem; }
  h2 { font-size: 1.2rem; color: #a1a1aa; margin: 2rem 0 1rem; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
  .endpoint { background: #18181b; border: 1px solid #27272a; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }
  .endpoint-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; }
  .endpoint-header:hover { background: #1f1f23; }
  .method { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace; }
  .get { background: #064e3b; color: #6ee7b7; }
  .post { background: #1e3a5f; color: #93c5fd; }
  .path { font-family: monospace; font-size: 0.9rem; color: #e4e4e7; }
  .desc { color: #71717a; font-size: 0.85rem; margin-left: auto; }
  .endpoint-body { padding: 0 1.25rem 1.25rem; display: none; border-top: 1px solid #27272a; }
  .endpoint.open .endpoint-body { display: block; padding-top: 1rem; }
  .try-btn { background: #4f46e5; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; margin-top: 0.75rem; }
  .try-btn:hover { background: #4338ca; }
  .try-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .result { margin-top: 1rem; background: #09090b; border: 1px solid #27272a; border-radius: 6px; padding: 1rem; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; max-height: 400px; overflow-y: auto; display: none; }
  .result.show { display: block; }
  .input-group { margin-top: 0.75rem; }
  .input-group label { display: block; font-size: 0.8rem; color: #a1a1aa; margin-bottom: 0.25rem; }
  .input-group input, .input-group textarea { width: 100%; background: #09090b; border: 1px solid #27272a; color: #e4e4e7; padding: 0.5rem; border-radius: 4px; font-family: monospace; font-size: 0.85rem; }
  .input-group textarea { min-height: 100px; resize: vertical; }
  .status-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
  .status-ok { background: #064e3b; color: #6ee7b7; }
  .status-fail { background: #450a0a; color: #fca5a5; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #4f46e5; border-top: 2px solid transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head><body>
<div class="container">
  <h1>AI Demo Generator <span>API</span></h1>
  <p class="subtitle">Base URL: <code>${baseUrl}</code></p>

  <h2>Diagnostics</h2>

  <div class="endpoint" id="ep-env">
    <div class="endpoint-header" onclick="toggle('ep-env')">
      <span class="method get">GET</span>
      <span class="path">/diagnostic/env-check</span>
      <span class="desc">Check environment configuration</span>
    </div>
    <div class="endpoint-body">
      <p>Shows which API keys and config vars are set (masked).</p>
      <button class="try-btn" onclick="tryGet('/diagnostic/env-check', 'ep-env')">Run</button>
      <pre class="result" id="result-ep-env"></pre>
    </div>
  </div>

  <div class="endpoint" id="ep-anthropic">
    <div class="endpoint-header" onclick="toggle('ep-anthropic')">
      <span class="method get">GET</span>
      <span class="path">/diagnostic/anthropic-test</span>
      <span class="desc">Test Anthropic API key against multiple models</span>
    </div>
    <div class="endpoint-body">
      <p>Sends a minimal request to each Claude model to check access. Takes ~10s.</p>
      <button class="try-btn" onclick="tryGet('/diagnostic/anthropic-test', 'ep-anthropic')">Run Test</button>
      <pre class="result" id="result-ep-anthropic"></pre>
    </div>
  </div>

  <div class="endpoint" id="ep-ghl">
    <div class="endpoint-header" onclick="toggle('ep-ghl')">
      <span class="method get">GET</span>
      <span class="path">/diagnostic/ghl-test</span>
      <span class="desc">Test GoHighLevel API connection</span>
    </div>
    <div class="endpoint-body">
      <p>Verifies GHL API key and location ID.</p>
      <button class="try-btn" onclick="tryGet('/diagnostic/ghl-test', 'ep-ghl')">Run Test</button>
      <pre class="result" id="result-ep-ghl"></pre>
    </div>
  </div>

  <h2>Core API</h2>

  <div class="endpoint" id="ep-webhook">
    <div class="endpoint-header" onclick="toggle('ep-webhook')">
      <span class="method post">POST</span>
      <span class="path">/webhook/demo-request</span>
      <span class="desc">Submit a new demo generation job</span>
    </div>
    <div class="endpoint-body">
      <p>Creates a demo generation job. Returns a job ID for status tracking.</p>
      <div class="input-group">
        <label>Request Body (JSON)</label>
        <textarea id="webhook-body">{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+44123456789",
  "website_url": "https://example.com",
  "company_name": "Test Company"
}</textarea>
      </div>
      <button class="try-btn" onclick="tryPost('/webhook/demo-request', 'ep-webhook', 'webhook-body')">Submit Job</button>
      <pre class="result" id="result-ep-webhook"></pre>
    </div>
  </div>

  <div class="endpoint" id="ep-status">
    <div class="endpoint-header" onclick="toggle('ep-status')">
      <span class="method get">GET</span>
      <span class="path">/status/:jobId</span>
      <span class="desc">Check job status</span>
    </div>
    <div class="endpoint-body">
      <p>Returns job status, demo URL, and execution logs.</p>
      <div class="input-group">
        <label>Job ID</label>
        <input type="text" id="status-jobid" placeholder="e.g. 4ee9a51a-bd41-44e9-bd36-115a40849c80">
      </div>
      <button class="try-btn" onclick="tryGetDynamic('/status/', 'ep-status', 'status-jobid')">Check Status</button>
      <pre class="result" id="result-ep-status"></pre>
    </div>
  </div>

  <div class="endpoint" id="ep-health">
    <div class="endpoint-header" onclick="toggle('ep-health')">
      <span class="method get">GET</span>
      <span class="path">/health</span>
      <span class="desc">Health check and job stats</span>
    </div>
    <div class="endpoint-body">
      <p>Returns service status, uptime, and job queue stats.</p>
      <button class="try-btn" onclick="tryGet('/health', 'ep-health')">Check Health</button>
      <pre class="result" id="result-ep-health"></pre>
    </div>
  </div>

  <div class="endpoint" id="ep-dashboard">
    <div class="endpoint-header" onclick="toggle('ep-dashboard')">
      <span class="method get">GET</span>
      <span class="path">/dashboard</span>
      <span class="desc">Visual job monitoring dashboard</span>
    </div>
    <div class="endpoint-body">
      <p>HTML dashboard with real-time job stats.</p>
      <a href="/dashboard" target="_blank" class="try-btn" style="display:inline-block;text-decoration:none;">Open Dashboard</a>
    </div>
  </div>
</div>

<script>
function toggle(id) {
  document.getElementById(id).classList.toggle('open');
}

async function tryGet(path, epId) {
  const el = document.getElementById('result-' + epId);
  el.className = 'result show';
  el.innerHTML = '<span class="spinner"></span> Loading...';
  try {
    const res = await fetch(path);
    const data = await res.json();
    el.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el.textContent = 'Error: ' + e.message;
  }
}

async function tryGetDynamic(basePath, epId, inputId) {
  const val = document.getElementById(inputId).value.trim();
  if (!val) { alert('Please enter a value'); return; }
  await tryGet(basePath + val, epId);
}

async function tryPost(path, epId, bodyId) {
  const el = document.getElementById('result-' + epId);
  el.className = 'result show';
  el.innerHTML = '<span class="spinner"></span> Submitting...';
  try {
    const body = document.getElementById(bodyId).value;
    JSON.parse(body); // validate
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const data = await res.json();
    el.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el.textContent = 'Error: ' + e.message;
  }
}
</script>
</body></html>`);
});

export default router;