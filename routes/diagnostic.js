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

    const models = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'];
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

export default router;