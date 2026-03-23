import { getNextQueuedJob, updateStatus, setError, retryJob, addLog, setDemoUrl } from '../db.js';
import { validateUrl } from '../services/validator.js';
import { cloneWebsite } from '../services/cloner.js';
// import { triggerDemoEmail } from '../services/email.js'; // Disabled - using SMS
import { upsertContactWithDemo } from '../services/ghl.js';

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 2;

let processing = false;

async function processJob(job) {
  console.log(`[processor] Starting job ${job.id} for ${job.website_url}`);

  try {
    // Step 1: Validate URL
    updateStatus(job.id, 'validating');
    addLog(job.id, 'validating', `Validating URL: ${job.website_url}`);

    const validation = await validateUrl(job.website_url);
    if (!validation.valid) {
      addLog(job.id, 'validation_failed', validation.error);
      if (job.retry_count < MAX_RETRIES) {
        addLog(job.id, 'retry', `Retrying (attempt ${job.retry_count + 1}/${MAX_RETRIES})`);
        retryJob(job.id);
        return;
      }
      setError(job.id, `URL validation failed: ${validation.error}`);
      return;
    }
    addLog(job.id, 'validated', 'URL is valid and reachable');

    // Step 2: Clone website via Replit
    updateStatus(job.id, 'cloning');
    addLog(job.id, 'cloning', 'Sending to Replit for cloning...');

    const cloneResult = await cloneWebsite(job.id, job.website_url, job.name);
    if (!cloneResult.success) {
      if (cloneResult.pending) {
        updateStatus(job.id, 'awaiting_replit');
        addLog(job.id, 'awaiting_replit', cloneResult.message);
        return; // Don't retry — waiting for config
      }
      if (job.retry_count < MAX_RETRIES) {
        addLog(job.id, 'retry', `Clone failed, retrying (${job.retry_count + 1}/${MAX_RETRIES})`);
        retryJob(job.id);
        return;
      }
      setError(job.id, `Cloning failed: ${cloneResult.message}`);
      return;
    }

    const demoUrl = cloneResult.demoUrl;
    addLog(job.id, 'cloned', `Clone deployed at: ${demoUrl}`);

    // Step 3: Update GHL CRM
    updateStatus(job.id, 'updating_crm');
    addLog(job.id, 'updating_crm', 'Updating contact in GoHighLevel...');

    try {
      await upsertContactWithDemo({
        name: job.name,
        email: job.email,
        phone: job.phone,
        demoUrl: demoUrl
      });
      addLog(job.id, 'crm_updated', 'Contact updated with demo URL');
    } catch (err) {
      addLog(job.id, 'crm_warning', `CRM update failed (non-fatal): ${err.message}`);
    }

    // Step 4: Send demo via SMS (standard processor fallback)
    updateStatus(job.id, 'delivering');
    addLog(job.id, 'delivering', `Sending demo to contact...`);

    try {
      if (job.contact_id) {
        // Send SMS to original contact
        const firstName = job.name?.split(' ')[0] || 'there';
        const smsMessage = `🎯 ${firstName}, your AI website demo is ready!

Your personalized demo is now live and ready to test.

👉 View Demo: ${demoUrl}

Try asking the AI questions as if you were a customer visiting your site!

Questions? Reply to this message.

- GHLU Team`;

        await sendGHLSMS(job.contact_id, smsMessage);
        addLog(job.id, 'sms_sent', `Demo SMS sent to original contact ${job.contact_id}`);
      } else {
        addLog(job.id, 'delivery_logged', `Demo URL: ${demoUrl} for ${job.name} (${job.email})`);
      }
    } catch (err) {
      addLog(job.id, 'delivery_warning', `Delivery failed (non-fatal): ${err.message}`);
    }

    // Step 5: Complete
    setDemoUrl(job.id, demoUrl);
    addLog(job.id, 'completed', `Demo generation complete: ${demoUrl}`);
    console.log(`[processor] Job ${job.id} completed: ${demoUrl}`);

  } catch (err) {
    console.error(`[processor] Job ${job.id} failed:`, err);
    addLog(job.id, 'error', err.message);
    if (job.retry_count < MAX_RETRIES) {
      retryJob(job.id);
    } else {
      setError(job.id, err.message);
    }
  }
}

async function poll() {
  if (processing) return;
  processing = true;

  try {
    const job = getNextQueuedJob();
    if (job) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[processor] Poll error:', err);
  } finally {
    processing = false;
  }
}

export function startProcessor() {
  console.log('[processor] Queue processor started (polling every 10s)');
  setInterval(poll, POLL_INTERVAL);
  poll(); // Run immediately
}

export function getProcessorStats() {
  return {
    processing,
    pollInterval: POLL_INTERVAL,
    maxRetries: MAX_RETRIES
  };
}

/**
 * Send SMS via GHL API
 */
async function sendGHLSMS(contactId, message) {
  const BASE_URL = 'https://services.leadconnectorhq.com';
  const apiKey = process.env.GHL_API_KEY;
  
  if (!apiKey) throw new Error('GHL_API_KEY not configured');

  const response = await fetch(`${BASE_URL}/conversations/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL SMS API failed (${response.status}): ${text}`);
  }

  return response.json();
}
