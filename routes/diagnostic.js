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

export default router;