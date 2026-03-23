import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createJob, addLog } from '../db.js';

const router = Router();

/**
 * POST /webhook/demo-request
 * Receives form submissions from GHL and queues demo generation jobs
 */
router.post('/demo-request', (req, res) => {
  try {
    const body = req.body;
    console.log('[webhook] Received demo request:', JSON.stringify(body, null, 2));

    // Extract fields flexibly — GHL sends data in various formats
    const name = body.name 
      || body.contact?.name
      || [body.first_name || body.firstName, body.last_name || body.lastName].filter(Boolean).join(' ')
      || 'Unknown';

    const email = body.email 
      || body.contact?.email 
      || body.Email
      || null;

    const phone = body.phone 
      || body.contact?.phone 
      || body.Phone
      || null;

    const websiteUrl = body.website_url 
      || body.websiteUrl 
      || body.website 
      || body.contact?.website
      || body.customData?.website_url
      || null;

    // Extract GHL contact ID for direct messaging
    const contactId = body.contact_id 
      || body.contactId 
      || body.contact?.id
      || body.id
      || null;

    const companyName = body.company_name 
      || body.companyName 
      || body.company
      || null;

    // Validate required fields
    if (!websiteUrl) {
      console.log('[webhook] Rejected: no website URL provided');
      return res.status(400).json({ 
        status: 'error', 
        message: 'website_url is required' 
      });
    }

    // Normalize URL
    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Create job with additional data for enhanced processing
    const jobId = uuidv4();
    const job = createJob(jobId, name, email, phone, normalizedUrl, contactId, companyName);
    addLog(jobId, 'created', `Job created for ${normalizedUrl} (${name}, ${email}) - Contact ID: ${contactId || 'none'}`);

    console.log(`[webhook] Job ${jobId} created for ${normalizedUrl} - Contact ID: ${contactId || 'none'}`);

    res.status(200).json({
      status: 'queued',
      jobId: jobId,
      message: 'Demo generation queued'
    });

  } catch (err) {
    console.error('[webhook] Error processing request:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
});

export default router;
