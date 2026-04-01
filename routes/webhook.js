import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createJob, addLog } from '../db-hybrid.js';

const router = Router();

/**
 * POST /webhook/demo-request
 * Receives form submissions from GHL and queues demo generation jobs
 */
router.post('/demo-request', async (req, res) => {
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

    // No-website flow fields
    const businessType = body.business_type || body.businessType || body.customData?.business_type || null;
    const location = body.location || body.city || body.customData?.location || null;
    const idealCustomers = body.ideal_customers || body.idealCustomers || body.customData?.ideal_customers || null;
    const servicesOffered = body.services_offered || body.servicesOffered || body.customData?.services_offered || null;

    // Determine flow: has website or no website
    const hasWebsite = (body.has_website !== false && body.has_website !== 'false') && !!websiteUrl;

    // Validate: need either website_url OR (business_type + location)
    if (!hasWebsite && !businessType) {
      console.log('[webhook] Rejected: no website URL and no business type');
      return res.status(400).json({
        status: 'error',
        message: 'Provide website_url or business_type + location'
      });
    }

    // Normalize URL if present
    let normalizedUrl = null;
    if (websiteUrl) {
      normalizedUrl = websiteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
    }

    // Create job with additional data for enhanced processing
    const jobId = uuidv4();
    const job = await createJob(jobId, name, email, phone, normalizedUrl, contactId, companyName, {
      hasWebsite,
      businessType,
      location,
      idealCustomers,
      servicesOffered
    });
    const flowType = hasWebsite ? 'website improvement' : 'new website (no-website flow)';
    await addLog(jobId, 'created', `Job created: ${flowType} — ${normalizedUrl || `${businessType} in ${location}`} (${name}, ${email}) - Contact ID: ${contactId || 'none'}`);

    console.log(`[webhook] Job ${jobId} created (${flowType}) for ${normalizedUrl || `${businessType} in ${location}`} - Contact ID: ${contactId || 'none'}`);

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
